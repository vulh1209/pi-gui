import type { RuntimeSnapshot, RuntimeExtensionRecord } from "@pi-gui/session-driver/runtime-types";
import type {
  ExtensionCommandCompatibilityRecord,
  ExtensionCommandVisibilityOverrideRecord,
  WorkspaceRecord,
} from "../desktop-state";

export const workspaceFixture: WorkspaceRecord = {
  id: "workspace-1",
  name: "pi-gui",
  path: "/mock/pi-gui",
  lastOpenedAt: new Date("2026-04-17T10:00:00.000Z").toISOString(),
  kind: "primary",
  sessions: [],
};

export const tungdevPiModesExtensionFixture: RuntimeExtensionRecord = {
  path: "/mock/node_modules/@tungthedev/pi-extensions/extensions/pi-modes.ts",
  displayName: "pi-modes",
  enabled: true,
  sourceInfo: {
    path: "/mock/node_modules/@tungthedev/pi-extensions/extensions/pi-modes.ts",
    source: "npm:@tungthedev/pi-extensions",
    scope: "user",
    origin: "package",
    baseDir: "/mock/node_modules/@tungthedev/pi-extensions",
  },
  commands: ["pi-mode", "settings"],
  commandRecords: [
    {
      name: "pi-mode",
      description: "Open Pi Mode settings or update a package setting",
      visibility: "extensions-page",
    },
    {
      name: "settings",
      description: "Open package settings",
      visibility: "hidden",
    },
  ],
  surfaces: [
    {
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
          value: "codex",
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
          value: true,
        },
        {
          kind: "boolean",
          key: "includePiPromptSection",
          label: "Include Pi prompt section",
          description: "Keep the incoming Pi environment prompt and append the selected prompt after it.",
          value: false,
        },
      ],
    },
  ],
  tools: Array.from({ length: 3 }, (_, index) => `tool-${index + 1}`),
  flags: [],
  shortcuts: ["ctrl+shift+t"],
  diagnostics: [],
};

export const tungdevEditorExtensionFixture: RuntimeExtensionRecord = {
  path: "/mock/node_modules/@tungthedev/pi-extensions/extensions/editor.ts",
  displayName: "editor",
  enabled: true,
  sourceInfo: {
    path: "/mock/node_modules/@tungthedev/pi-extensions/extensions/editor.ts",
    source: "npm:@tungthedev/pi-extensions",
    scope: "user",
    origin: "package",
    baseDir: "/mock/node_modules/@tungthedev/pi-extensions",
  },
  commands: [],
  commandRecords: [],
  surfaces: [],
  tools: [],
  flags: [],
  shortcuts: [],
  diagnostics: [],
};

export const localWorkspaceExtensionFixture: RuntimeExtensionRecord = {
  path: "/mock/pi-gui/.pi/extensions/local-checks.ts",
  displayName: "local-checks",
  enabled: true,
  sourceInfo: {
    path: "/mock/pi-gui/.pi/extensions/local-checks.ts",
    source: "extension:/mock/pi-gui/.pi/extensions/local-checks.ts",
    scope: "project",
    origin: "top-level",
    baseDir: "/mock/pi-gui/.pi/extensions",
  },
  commands: ["local-checks"],
  commandRecords: [
    {
      name: "local-checks",
      description: "Run project-local validation checks",
      visibility: "chat",
    },
  ],
  surfaces: [],
  tools: ["lint", "typecheck"],
  flags: [],
  shortcuts: [],
  diagnostics: [
    {
      type: "warning",
      message: "One optional dependency is unavailable in the current workspace.",
    },
  ],
};

export const runtimeFixture: RuntimeSnapshot = {
  workspace: {
    workspaceId: workspaceFixture.id,
    path: workspaceFixture.path,
    displayName: workspaceFixture.name,
  },
  providers: [],
  models: [],
  skills: [],
  extensions: [tungdevPiModesExtensionFixture, tungdevEditorExtensionFixture, localWorkspaceExtensionFixture],
  settings: {
    enableSkillCommands: true,
    enabledModelPatterns: [],
  },
};

export const compatibilityFixture: readonly ExtensionCommandCompatibilityRecord[] = [
  {
    commandName: "pi-mode",
    extensionPath: tungdevPiModesExtensionFixture.path,
    status: "supported",
    message: "Observed working in pi-gui.",
    capability: "gui-safe",
    updatedAt: new Date("2026-04-17T10:05:00.000Z").toISOString(),
  },
  {
    commandName: "settings",
    extensionPath: tungdevPiModesExtensionFixture.path,
    status: "terminal-only",
    message: "Settings command still depends on terminal-only UI in legacy mode.",
    capability: "custom-ui",
    updatedAt: new Date("2026-04-17T10:05:30.000Z").toISOString(),
  },
];

export const noVisibilityOverridesFixture: readonly ExtensionCommandVisibilityOverrideRecord[] = [];

export const chatVisibilityOverrideFixture: readonly ExtensionCommandVisibilityOverrideRecord[] = [
  {
    extensionPath: tungdevPiModesExtensionFixture.path,
    commandName: "pi-mode",
    visibility: "chat",
  },
];
