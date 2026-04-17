import type { RuntimeExtensionRecord } from "@pi-gui/session-driver/runtime-types";

export interface ExtensionPackageGroup {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly sourceLabel: string;
  readonly scopeLabel: string;
  readonly extensions: readonly RuntimeExtensionRecord[];
}

export function buildExtensionPackageGroups(
  extensions: readonly RuntimeExtensionRecord[],
): readonly ExtensionPackageGroup[] {
  const groups = new Map<string, RuntimeExtensionRecord[]>();

  for (const extension of extensions) {
    const key = packageGroupKey(extension);
    const current = groups.get(key) ?? [];
    groups.set(key, [...current, extension]);
  }

  return [...groups.entries()]
    .map(([id, entries]) => ({
      id,
      title: packageGroupTitle(entries[0]),
      subtitle: packageGroupSubtitle(entries[0], entries.length),
      sourceLabel: entries[0]?.sourceInfo.source ?? "extension",
      scopeLabel: entries[0]?.sourceInfo.scope ?? "user",
      extensions: [...entries].sort((left, right) => left.displayName.localeCompare(right.displayName)),
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function packageGroupKey(extension: RuntimeExtensionRecord): string {
  if (extension.sourceInfo.origin === "package") {
    return `package:${extension.sourceInfo.source}`;
  }

  return `top-level:${extension.sourceInfo.scope}:${extension.sourceInfo.baseDir ?? extension.sourceInfo.path}`;
}

function packageGroupTitle(extension: RuntimeExtensionRecord | undefined): string {
  if (!extension) {
    return "Extensions";
  }

  if (extension.sourceInfo.origin === "package") {
    return extension.sourceInfo.source.replace(/^npm:/, "").replace(/^extension:/, "");
  }

  return extension.sourceInfo.scope === "project" ? "Project-local extensions" : "User extensions";
}

function packageGroupSubtitle(
  extension: RuntimeExtensionRecord | undefined,
  count: number,
): string {
  if (!extension) {
    return `${count} ${count === 1 ? "extension" : "extensions"}`;
  }

  if (extension.sourceInfo.origin === "package") {
    return `${count} ${count === 1 ? "extension" : "extensions"} from package`;
  }

  return `${count} ${count === 1 ? "top-level extension" : "top-level extensions"}`;
}
