import { SettingsManager, type PackageSource } from "@mariozechner/pi-coding-agent";

export interface NpmCommandAttempt {
  readonly command: readonly string[];
  readonly error: string;
}

export interface NpmCommandRecoveryFailure {
  readonly attemptedCommands: readonly NpmCommandAttempt[];
  readonly configuredCommand?: readonly string[];
}

export function formatNpmRecoveryWarning(workspacePath: string, failure: NpmCommandRecoveryFailure): string {
  const configured = failure.configuredCommand ? failure.configuredCommand.join(" ") : "<none>";
  const attempted = failure.attemptedCommands
    .map((attempt) => `${attempt.command.join(" ")} => ${attempt.error}`)
    .join("; ");
  return (
    `[pi-gui] Falling back to runtime resource loading without npm package sources for ${workspacePath}. ` +
    `Configured npmCommand: ${configured}. Attempted commands: ${attempted || "<none>"}. ` +
    `Set npmCommand in settings.json if automatic recovery still fails.`
  );
}

export function hasNpmPackageSources(settingsManager: SettingsManager): boolean {
  return settingsManager.getPackages().some((source: PackageSource) => {
    const value = typeof source === "string" ? source : source.source;
    return value.startsWith("npm:");
  });
}

function candidateStringsForPlatform(platform: NodeJS.Platform): readonly string[] {
  if (platform === "darwin") {
    return [
      "npm",
      "/opt/homebrew/bin/npm",
      "/opt/homebrew/opt/node/bin/npm",
      "/opt/homebrew/opt/node@22/bin/npm",
      "/opt/homebrew/opt/node@20/bin/npm",
      "/usr/local/bin/npm",
    ];
  }

  if (platform === "win32") {
    return [
      "npm.cmd",
      "C:\\Program Files\\nodejs\\npm.cmd",
      "C:\\Program Files (x86)\\nodejs\\npm.cmd",
    ];
  }

  return ["npm", "/usr/bin/npm", "/usr/local/bin/npm"];
}

export function buildNpmCommandCandidates(
  settingsManager: SettingsManager,
  platform: NodeJS.Platform = process.platform,
): readonly (readonly string[])[] {
  const seen = new Set<string>();
  const candidates: string[][] = [];

  const push = (value: readonly string[] | undefined) => {
    if (!value || value.length === 0) {
      return;
    }

    const normalized = value.map((entry) => entry.trim()).filter(Boolean);
    if (normalized.length === 0) {
      return;
    }

    const key = normalized.join("\0");
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push(normalized);
  };

  push(settingsManager.getNpmCommand());
  for (const command of candidateStringsForPlatform(platform)) {
    push([command]);
  }

  return candidates;
}

export function cloneSettingsManagerWithNpmCommand(
  settingsManager: SettingsManager,
  command: readonly string[],
): SettingsManager {
  const globalSettings = {
    ...settingsManager.getGlobalSettings(),
  };
  const projectSettings = {
    ...settingsManager.getProjectSettings(),
  };

  const cloned = SettingsManager.fromStorage({
    withLock(scope, fn) {
      const current = scope === "global" ? globalSettings : projectSettings;
      fn(JSON.stringify(current));
    },
  });
  cloned.applyOverrides({ npmCommand: [...command] });
  return cloned;
}

export async function retryWithRecoveredNpmCommand<T>(options: {
  readonly settingsManager: SettingsManager;
  readonly run: (settingsManager: SettingsManager, command: readonly string[]) => Promise<T>;
}): Promise<
  | { readonly ok: true; readonly value: T; readonly command: readonly string[] }
  | { readonly ok: false; readonly failure: NpmCommandRecoveryFailure }
> {
  const attempts: NpmCommandAttempt[] = [];
  const configuredCommand = options.settingsManager.getNpmCommand();

  for (const command of buildNpmCommandCandidates(options.settingsManager)) {
    try {
      const candidateSettings = cloneSettingsManagerWithNpmCommand(options.settingsManager, command);
      const value = await options.run(candidateSettings, command);
      return {
        ok: true,
        value,
        command,
      };
    } catch (error) {
      attempts.push({
        command,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: false,
    failure: {
      attemptedCommands: attempts,
      ...(configuredCommand ? { configuredCommand } : {}),
    },
  };
}
