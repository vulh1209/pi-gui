import { DefaultResourceLoader, SettingsManager, createAgentSession, getAgentDir, type CreateAgentSessionOptions } from "@mariozechner/pi-coding-agent";
import {
  formatNpmRecoveryWarning,
  hasNpmPackageSources,
  retryWithRecoveredNpmCommand,
} from "./npm-command-recovery.js";

export function isGlobalNpmLookupError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("npm root -g");
}

export function createSettingsManagerWithoutNpmPackages(current: SettingsManager): SettingsManager | null {
  const globalSettings = current.getGlobalSettings() as Record<string, unknown>;
  const projectSettings = current.getProjectSettings() as Record<string, unknown>;
  const nextGlobalPackages = filterOutNpmPackageSources(globalSettings.packages);
  const nextProjectPackages = filterOutNpmPackageSources(projectSettings.packages);

  const globalChanged = nextGlobalPackages !== globalSettings.packages;
  const projectChanged = nextProjectPackages !== projectSettings.packages;
  if (!globalChanged && !projectChanged) {
    return null;
  }

  const nextGlobalSettings = globalChanged ? { ...globalSettings, packages: nextGlobalPackages } : globalSettings;
  const nextProjectSettings = projectChanged ? { ...projectSettings, packages: nextProjectPackages } : projectSettings;
  return SettingsManager.fromStorage({
    withLock(scope, fn) {
      const currentJson =
        scope === "global"
          ? JSON.stringify(nextGlobalSettings)
          : JSON.stringify(nextProjectSettings);
      fn(currentJson);
    },
  });
}

export async function createAgentSessionWithNpmFallback(options?: CreateAgentSessionOptions) {
  try {
    return await createAgentSession(options);
  } catch (error) {
    if (!isGlobalNpmLookupError(error)) {
      throw error;
    }

    const cwd = options?.cwd ?? process.cwd();
    const agentDir = options?.agentDir ?? getAgentDir();
    const currentSettingsManager = options?.settingsManager ?? SettingsManager.create(cwd, agentDir);
    if (hasNpmPackageSources(currentSettingsManager)) {
      const recovered = await retryWithRecoveredNpmCommand({
        settingsManager: currentSettingsManager,
        run: (candidateSettingsManager) =>
          createAgentSession({
            ...options,
            cwd,
            agentDir,
            settingsManager: candidateSettingsManager,
          }),
      });
      if (recovered.ok) {
        return recovered.value;
      }

      console.warn(formatNpmRecoveryWarning("session resource loading", cwd, recovered.failure));
    }

    const fallbackSettingsManager = createSettingsManagerWithoutNpmPackages(currentSettingsManager);
    if (!fallbackSettingsManager) {
      throw error;
    }

    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager: fallbackSettingsManager,
    });
    await resourceLoader.reload();

    return createAgentSession({
      ...options,
      cwd,
      agentDir,
      settingsManager: fallbackSettingsManager,
      resourceLoader,
    });
  }
}

function filterOutNpmPackageSources(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const filtered = value.filter((entry) => !isNpmPackageSource(entry));
  return filtered.length === value.length ? value : filtered;
}

function isNpmPackageSource(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().startsWith("npm:");
  }

  if (typeof value !== "object" || value === null || !("source" in value)) {
    return false;
  }

  return typeof value.source === "string" && value.source.trim().startsWith("npm:");
}
