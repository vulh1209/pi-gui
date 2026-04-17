import { useEffect, useMemo, useState } from "react";
import type { RuntimeExtensionRecord, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type {
  ExtensionCommandCompatibilityRecord,
  ExtensionCommandVisibility,
  ExtensionCommandVisibilityOverrideRecord,
  WorkspaceRecord,
} from "./desktop-state";
import { RefreshIcon } from "./icons";
import { buildExtensionPackageGroups } from "./extensions-accordion-model";
import { ExtensionsSurface } from "./extensions-surface";

interface ExtensionsViewProps {
  readonly workspace?: WorkspaceRecord;
  readonly runtime?: RuntimeSnapshot;
  readonly commandCompatibility?: readonly ExtensionCommandCompatibilityRecord[];
  readonly visibilityOverrides?: readonly ExtensionCommandVisibilityOverrideRecord[];
  readonly onRefresh: () => void;
  readonly onOpenExtensionFolder: (filePath: string) => void;
  readonly onToggleExtension: (filePath: string, enabled: boolean) => void;
  readonly onSetSurfaceField: (extensionPath: string, fieldKey: string, value: string | boolean) => void;
  readonly onSetVisibilityOverride: (extensionPath: string, commandName: string, visibility: ExtensionCommandVisibility) => void;
  readonly onClearVisibilityOverride: (extensionPath: string, commandName: string) => void;
}

export function ExtensionsView({
  workspace,
  runtime,
  commandCompatibility = [],
  visibilityOverrides = [],
  onRefresh,
  onOpenExtensionFolder,
  onToggleExtension,
  onSetSurfaceField,
  onSetVisibilityOverride,
  onClearVisibilityOverride,
}: ExtensionsViewProps) {
  const [query, setQuery] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | undefined>();
  const [expandedExtensionPath, setExpandedExtensionPath] = useState<string | undefined>();
  const extensions = runtime?.extensions ?? [];
  const filteredExtensions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return extensions;
    }

    return extensions.filter((extension) =>
      [
        extension.displayName,
        extension.path,
        extension.sourceInfo.source,
        extension.sourceInfo.scope,
        extension.sourceInfo.origin,
        ...extension.commands,
        ...extension.tools,
        ...extension.flags,
        ...extension.shortcuts,
        ...extension.surfaces.map((surface) => surface.title),
        ...extension.diagnostics.map((diagnostic) => diagnostic.message),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [extensions, query]);
  const packageGroups = useMemo(() => buildExtensionPackageGroups(filteredExtensions), [filteredExtensions]);
  const activeGroup = packageGroups.find((group) => group.id === expandedGroupId) ?? packageGroups[0];

  useEffect(() => {
    if (packageGroups.length === 0) {
      if (expandedGroupId !== undefined) {
        setExpandedGroupId(undefined);
      }
      if (expandedExtensionPath !== undefined) {
        setExpandedExtensionPath(undefined);
      }
      return;
    }

    if (!expandedGroupId || !packageGroups.some((group) => group.id === expandedGroupId)) {
      setExpandedGroupId(packageGroups[0]?.id);
    }
  }, [expandedExtensionPath, expandedGroupId, packageGroups]);

  useEffect(() => {
    if (!activeGroup) {
      return;
    }

    const activePaths = new Set(activeGroup.extensions.map((extension) => extension.path));
    if (!expandedExtensionPath || !activePaths.has(expandedExtensionPath)) {
      setExpandedExtensionPath(activeGroup.extensions[0]?.path);
    }
  }, [activeGroup, expandedExtensionPath]);

  if (!workspace) {
    return (
      <section className="canvas canvas--empty">
        <div className="empty-panel">
          <div className="session-header__eyebrow">Extensions</div>
          <h1>Select a workspace</h1>
          <p>Extensions are discovered from the selected workspace plus your user-level extension directories.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="canvas">
      <div className="conversation skills-view">
        <header className="view-header">
          <div>
            <div className="chat-header__eyebrow">Extensions</div>
            <h1 className="view-header__title">Extensions</h1>
            <p className="view-header__body">Inspect and manage first-class runtime extensions for this workspace.</p>
          </div>
          <div className="view-header__actions">
            <button className="button button--secondary" type="button" onClick={onRefresh}>
              <RefreshIcon />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <div className="skills-toolbar">
          <input
            aria-label="Search extensions"
            className="skills-search"
            placeholder="Search extensions"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>

        <div className="extensions-accordion" data-testid="extensions-accordion">
          {packageGroups.length === 0 ? (
            <ExtensionsEmptyState message="Refresh runtime discovery to load workspace and user-level extensions." />
          ) : (
            packageGroups.map((group) => {
              const groupExpanded = group.id === activeGroup?.id;
              return (
                <section className="skill-detail__meta-list" key={group.id}>
                  <button
                    aria-expanded={groupExpanded}
                    className={`skill-card ${groupExpanded ? "skill-card--active" : ""}`}
                    type="button"
                    onClick={() => {
                      if (groupExpanded) {
                        setExpandedGroupId(undefined);
                        return;
                      }

                      setExpandedGroupId(group.id);
                      setExpandedExtensionPath(group.extensions[0]?.path);
                    }}
                  >
                    <span className="skill-card__title-row">
                      <span className="skill-card__title">{group.title}</span>
                      <span className="skill-card__badge">{group.extensions.length} extensions</span>
                    </span>
                    <span className="skill-card__description">{group.subtitle}</span>
                    <span className="skill-card__meta">
                      <span>{group.sourceLabel}</span>
                      <span>{group.scopeLabel}</span>
                    </span>
                  </button>

                  {groupExpanded ? (
                    <div className="skill-detail__meta-list" data-testid="extensions-list">
                      {group.extensions.map((extension) => {
                        const rowExpanded = expandedExtensionPath === extension.path;
                        const extensionCompatibilityRecords = commandCompatibility
                          .filter((record) => record.extensionPath === extension.path)
                          .sort((left, right) => left.commandName.localeCompare(right.commandName));
                        const extensionOverrides = visibilityOverrides.filter(
                          (entry) => entry.extensionPath === extension.path,
                        );

                        return (
                          <div key={extension.path}>
                            <button
                              aria-expanded={rowExpanded}
                              className={`skill-card ${rowExpanded ? "skill-card--active" : ""}`}
                              type="button"
                              onClick={() => setExpandedExtensionPath((current) => (current === extension.path ? undefined : extension.path))}
                            >
                              <span className="skill-card__title-row">
                                <span className="skill-card__title">{extension.displayName}</span>
                                <span className={`skill-card__badge ${extension.enabled ? "skill-card__badge--enabled" : ""}`}>
                                  {extension.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </span>
                              <span className="skill-card__description">{describeExtensionRow(extension)}</span>
                              <span className="skill-card__meta">
                                <span>{extension.surfaces.length > 0 ? `${extension.surfaces.length} surfaces` : "No native surface"}</span>
                                {extension.commands.length > 0 ? <span>{extension.commands.length} commands</span> : null}
                                {extension.tools.length > 0 ? <span>{extension.tools.length} tools</span> : null}
                                {extension.diagnostics.length > 0 ? <span>{extension.diagnostics.length} issues</span> : null}
                              </span>
                            </button>

                            {rowExpanded ? (
                              <div className="skill-detail__meta-list">
                                <ExtensionsSurface
                                  compatibilityRecords={extensionCompatibilityRecords}
                                  extension={extension}
                                  visibilityOverrides={extensionOverrides}
                                  onOpenExtensionFolder={onOpenExtensionFolder}
                                  onToggleExtension={onToggleExtension}
                                  onSetSurfaceField={onSetSurfaceField}
                                  onSetVisibilityOverride={(commandName, visibility) =>
                                    onSetVisibilityOverride(extension.path, commandName, visibility)
                                  }
                                  onClearVisibilityOverride={(commandName) =>
                                    onClearVisibilityOverride(extension.path, commandName)
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function describeExtensionRow(extension: RuntimeExtensionRecord): string {
  const parts = [
    extension.sourceInfo.scope === "project" ? "Project-local" : "User-level",
    extension.surfaces.length > 0 ? "Native surface" : undefined,
    extension.commandRecords.some((command) => command.visibility === "extensions-page") ? "Extensions-page commands" : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : extension.sourceInfo.origin;
}

function ExtensionsEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state">
      <h2>No extensions found</h2>
      <p>{message}</p>
    </div>
  );
}
