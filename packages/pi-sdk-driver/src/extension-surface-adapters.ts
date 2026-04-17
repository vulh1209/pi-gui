import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type RuntimeExtensionCommandVisibility = "chat" | "extensions-page" | "hidden";

export interface RuntimeExtensionCommandRecordLike {
  readonly name: string;
  readonly description?: string;
  readonly visibility?: RuntimeExtensionCommandVisibility;
}

export type RuntimeExtensionSurfaceRecordLike = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly kind: "settings-form";
  readonly fields: readonly (
    | {
        readonly kind: "enum";
        readonly key: string;
        readonly label: string;
        readonly description?: string;
        readonly value: string;
        readonly options: readonly {
          readonly value: string;
          readonly label: string;
          readonly description?: string;
        }[];
      }
    | {
        readonly kind: "boolean";
        readonly key: string;
        readonly label: string;
        readonly description?: string;
        readonly value: boolean;
      }
  )[];
};

export type KnownExtensionSurfaceFieldKey = "toolSet" | "systemMdPrompt" | "includePiPromptSection";

interface KnownExtensionSurfaceMetadataInput {
  readonly agentDir: string;
  readonly extensionPath: string;
  readonly commandRecords: readonly RuntimeExtensionCommandRecordLike[];
  readonly surfaces: readonly RuntimeExtensionSurfaceRecordLike[];
}

interface PiModeSettings {
  readonly toolSet: "pi" | "codex" | "droid";
  readonly systemMdPrompt: boolean;
  readonly includePiPromptSection: boolean;
}

const SETTINGS_FILE = "settings.json";
const PI_MODE_NAMESPACE = "pi-mode";
const DEFAULT_PI_MODE_SETTINGS: PiModeSettings = {
  toolSet: "pi",
  systemMdPrompt: false,
  includePiPromptSection: false,
};

export async function applyKnownExtensionSurfaceMetadata(
  input: KnownExtensionSurfaceMetadataInput,
): Promise<{
  readonly commandRecords: readonly RuntimeExtensionCommandRecordLike[];
  readonly surfaces: readonly RuntimeExtensionSurfaceRecordLike[];
}> {
  if (!isTungdevSettingsExtensionPath(input.extensionPath)) {
    return {
      commandRecords: input.commandRecords,
      surfaces: input.surfaces,
    };
  }

  const settings = await readPiModeSettings(input.agentDir);
  const commandRecords = input.commandRecords.map<RuntimeExtensionCommandRecordLike>((command) =>
    command.name === "pi-mode"
      ? {
          ...command,
          visibility: "extensions-page" as const,
        }
      : command,
  );
  const surfacesById = new Map(input.surfaces.map((surface) => [surface.id, surface] as const));
  surfacesById.set("pi-mode-settings", buildPiModeSettingsSurface(settings));

  return {
    commandRecords,
    surfaces: [...surfacesById.values()],
  };
}

export async function applyKnownExtensionSurfaceField(args: {
  readonly agentDir: string;
  readonly extensionPath: string;
  readonly fieldKey: string;
  readonly value: string | boolean;
}): Promise<boolean> {
  if (!isTungdevSettingsExtensionPath(args.extensionPath)) {
    return false;
  }

  if (!isKnownExtensionSurfaceFieldKey(args.fieldKey)) {
    throw new Error(`Unsupported extension surface field: ${args.fieldKey}`);
  }

  const nextSettings = normalizePiModeSettingsPatch(args.fieldKey, args.value);
  await mutateAgentSettings(args.agentDir, (root) => {
    const currentNamespace = root[PI_MODE_NAMESPACE];
    const namespace =
      currentNamespace && typeof currentNamespace === "object" && !Array.isArray(currentNamespace)
        ? { ...(currentNamespace as Record<string, unknown>) }
        : {};

    namespace[args.fieldKey] = nextSettings;
    root[PI_MODE_NAMESPACE] = namespace;
    return root;
  });
  return true;
}

function buildPiModeSettingsSurface(settings: PiModeSettings): RuntimeExtensionSurfaceRecordLike {
  return {
    id: "pi-mode-settings",
    title: "Pi Mode",
    description: "Configure mode behavior for the Tungdev settings extension.",
    kind: "settings-form",
    fields: [
      {
        kind: "enum",
        key: "toolSet",
        label: "Mode",
        description: "Selects the Pi, Codex, or Droid behavior pack for this package.",
        value: settings.toolSet,
        options: [
          { value: "pi", label: "Pi" },
          { value: "codex", label: "Codex" },
          { value: "droid", label: "Droid" },
        ],
      },
      {
        kind: "boolean",
        key: "systemMdPrompt",
        label: "Inject SYSTEM.md",
        description: "Inject the repo SYSTEM.md into the selected prompt stack.",
        value: settings.systemMdPrompt,
      },
      {
        kind: "boolean",
        key: "includePiPromptSection",
        label: "Include Pi prompt section",
        description: "Keep the incoming Pi environment prompt and append the selected prompt after it.",
        value: settings.includePiPromptSection,
      },
    ],
  };
}

async function readPiModeSettings(agentDir: string): Promise<PiModeSettings> {
  const root = await readAgentSettings(agentDir);
  const namespace = root[PI_MODE_NAMESPACE];
  const namespaceRecord =
    namespace && typeof namespace === "object" && !Array.isArray(namespace)
      ? (namespace as Record<string, unknown>)
      : undefined;

  return {
    toolSet: normalizeToolSet(namespaceRecord?.toolSet),
    systemMdPrompt: typeof namespaceRecord?.systemMdPrompt === "boolean" ? namespaceRecord.systemMdPrompt : false,
    includePiPromptSection:
      typeof namespaceRecord?.includePiPromptSection === "boolean"
        ? namespaceRecord.includePiPromptSection
        : false,
  };
}

async function readAgentSettings(agentDir: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(join(agentDir, SETTINGS_FILE), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? ({ ...parsed } as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function mutateAgentSettings(
  agentDir: string,
  update: (root: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const settingsPath = join(agentDir, SETTINGS_FILE);
  const current = await readAgentSettings(agentDir);
  const next = update({ ...current });
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function isTungdevSettingsExtensionPath(extensionPath: string): boolean {
  const normalizedPath = normalizeComparablePath(extensionPath);
  return (
    normalizedPath.includes("/@tungthedev/pi-extensions/") &&
    (
      normalizedPath.endsWith("/extensions/settings/index.ts") ||
      normalizedPath.endsWith("/extensions/pi-modes.ts")
    )
  );
}

function normalizeComparablePath(value: string): string {
  return resolve(value).replaceAll("\\", "/");
}

function normalizeToolSet(value: unknown): PiModeSettings["toolSet"] {
  return value === "codex" || value === "droid" || value === "pi" ? value : DEFAULT_PI_MODE_SETTINGS.toolSet;
}

function isKnownExtensionSurfaceFieldKey(value: string): value is KnownExtensionSurfaceFieldKey {
  return value === "toolSet" || value === "systemMdPrompt" || value === "includePiPromptSection";
}

function normalizePiModeSettingsPatch(
  fieldKey: KnownExtensionSurfaceFieldKey,
  value: string | boolean,
): PiModeSettings[KnownExtensionSurfaceFieldKey] {
  if (fieldKey === "toolSet") {
    if (value === "pi" || value === "codex" || value === "droid") {
      return value;
    }
    throw new Error(`Invalid tool set value: ${String(value)}`);
  }

  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean value for ${fieldKey}.`);
  }

  return value;
}
