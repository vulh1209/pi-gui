import { existsSync } from "node:fs";
import path from "node:path";
import { app } from "electron";

export interface MemoryHelperLaunchSpec {
  readonly helperPath: string;
  readonly helperArgs: readonly string[];
}

const MEMORY_HELPER_HOST_EXECUTABLE_ENV = "PI_MEMORY_HOST_EXECUTABLE";

function resolveLauncherFileName(): string {
  return process.platform === "win32" ? "launch-memory-helper.cmd" : "launch-memory-helper.sh";
}

function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

function resolveVendoredLaunchSpec(resourceRoot: string): MemoryHelperLaunchSpec | undefined {
  const launcherPath = path.join(resourceRoot, resolveLauncherFileName());
  const helperEntryPath = path.join(resourceRoot, "dist", "memory", "helper-entry.js");
  const helperPackageJsonPath = path.join(resourceRoot, "package.json");
  const schemaPath = path.join(resourceRoot, "sql", "001_graphiti_lite_memory.sql");
  if (!fileExists(launcherPath) || !fileExists(helperEntryPath) || !fileExists(helperPackageJsonPath) || !fileExists(schemaPath)) {
    return undefined;
  }

  return {
    helperPath: launcherPath,
    helperArgs: [helperEntryPath],
  };
}

function resolveDevLaunchSpec(): MemoryHelperLaunchSpec | undefined {
  return resolveVendoredLaunchSpec(path.resolve(app.getAppPath(), "resources", "memory-helper"));
}

function resolvePackagedLaunchSpec(): MemoryHelperLaunchSpec | undefined {
  return resolveVendoredLaunchSpec(path.join(process.resourcesPath, "memory-helper"));
}

function parseHelperArgs(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function resolveMemoryHelperLaunchSpec(): MemoryHelperLaunchSpec | undefined {
  const explicitPath = process.env.PI_MEMORY_HELPER_PATH?.trim();
  if (explicitPath) {
    return {
      helperPath: explicitPath,
      helperArgs: parseHelperArgs(process.env.PI_MEMORY_HELPER_ARGS),
    };
  }

  return app.isPackaged ? resolvePackagedLaunchSpec() : resolveDevLaunchSpec();
}

export function applyMemoryHelperEnv(): MemoryHelperLaunchSpec | undefined {
  const launchSpec = resolveMemoryHelperLaunchSpec();
  if (!launchSpec) {
    delete process.env.PI_MEMORY_HELPER_PATH;
    delete process.env.PI_MEMORY_HELPER_ARGS;
    delete process.env[MEMORY_HELPER_HOST_EXECUTABLE_ENV];
    return undefined;
  }

  process.env.PI_MEMORY_HELPER_PATH = launchSpec.helperPath;
  process.env.PI_MEMORY_HELPER_ARGS = JSON.stringify(launchSpec.helperArgs);
  process.env[MEMORY_HELPER_HOST_EXECUTABLE_ENV] = process.execPath;
  return launchSpec;
}
