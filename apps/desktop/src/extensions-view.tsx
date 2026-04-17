import { useEffect, useMemo, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type {
  ExtensionCommandCompatibilityRecord,
  ExtensionCommandVisibility,
  ExtensionCommandVisibilityOverrideRecord,
  WorkspaceRecord,
} from "./desktop-state";
import { RefreshIcon } from "./icons";
import { buildExtensionPackageGroups, packageGroupKey } from "./extensions-accordion-model";
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
  const [selectedExtensionPath, setSelectedExtensionPath] = useState<string | undefined>();
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
  const selectedExtension =
    filteredExtensions.find((extension) => extension.path === selectedExtensionPath) ?? filteredExtensions[0];
  const selectedGroupId = selectedExtension ? packageGroupKey(selectedExtension) : packageGroups[0]?.id;
  const activeGroup = packageGroups.find((group) => group.id === (expandedGroupId ?? selectedGroupId)) ?? packageGroups[0];

  useEffect(() => {
    if (packageGroups.length === 0) {
      if (expandedGroupId !== undefined) {
        setExpandedGroupId(undefined);
      }
      return;
    }

    const nextGroupId = expandedGroupId ?? selectedGroupId ?? packageGroups[0]?.id;
    if (nextGroupId && packageGroups.some((group) => group.id === nextGroupId)) {
      if (expandedGroupId !== nextGroupId) {
        setExpandedGroupId(nextGroupId);
      }
      return;
    }

    if (packageGroups[0]?.id && expandedGroupId !== packageGroups[0].id) {
      setExpandedGroupId(packageGroups[0].id);
    }
  }, [expandedGroupId, packageGroups, selectedGroupId]);

  useEffect(() => {
    if (!activeGroup) {
      return;
    }

    const selectedInActiveGroup = selectedExtension
      ? activeGroup.extensions.some((extension) => extension.path === selectedExtension.path)
      : false;
    if (selectedInActiveGroup) {
      return;
    }

    const nextSelectedExtension = activeGroup.extensions[0];
    if (nextSelectedExtension && nextSelectedExtension.path !== selectedExtensionPath) {
      setSelectedExtensionPath(nextSelectedExtension.path);
    }
  }, [activeGroup, selectedExtension, selectedExtensionPath]);

  const selectedCompatibilityRecords = useMemo(
    () =>
      selectedExtension
        ? commandCompatibility
            .filter((record) => record.extensionPath === selectedExtension.path)
            .sort((left, right) => left.commandName.localeCompare(right.commandName))
        : [],
    [commandCompatibility, selectedExtension],
  );
  const selectedOverrides = useMemo(
    () =>
      selectedExtension
        ? visibilityOverrides.filter((entry) => entry.extensionPath === selectedExtension.path)
        : [],
    [selectedExtension, visibilityOverrides],
  );

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

        <div className="skills-layout">
          <div className="skills-grid" data-testid="extensions-list">
            {packageGroups.length === 0 ? (
              <ExtensionsEmptyState message="Refresh runtime discovery to load workspace and user-level extensions." />
            ) : (
              packageGroups.map((group) => {
                const isExpanded = group.id === activeGroup?.id;
                return (
                  <section className="skill-detail__meta-list" key={group.id}>
                    <button
                      className={`skill-card ${isExpanded ? "skill-card--active" : ""}`}
                      type="button"
                      onClick={() => {
                        setExpandedGroupId((current) => (current === group.id ? undefined : group.id));
                        const selectedInGroup = selectedExtension
                          ? group.extensions.some((extension) => extension.path === selectedExtension.path)
                          : false;
                        const nextSelectedExtension = selectedInGroup ? selectedExtension : group.extensions[0];
                        if (nextSelectedExtension && nextSelectedExtension.path !== selectedExtensionPath) {
                          setSelectedExtensionPath(nextSelectedExtension.path);
                        }
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

                    {isExpanded
                      ? group.extensions.map((extension) => (
                          <button
                            className={`skill-card ${selectedExtension?.path === extension.path ? "skill-card--active" : ""}`}
                            key={extension.path}
                            type="button"
                            onClick={() => {
                              setExpandedGroupId(group.id);
                              setSelectedExtensionPath(extension.path);
                            }}
                          >
                            <span className="skill-card__title-row">
                              <span className="skill-card__title">{extension.displayName}</span>
                              <span className={`skill-card__badge ${extension.enabled ? "skill-card__badge--enabled" : ""}`}>
                                {extension.enabled ? "Enabled" : "Disabled"}
                              </span>
                            </span>
                            <span className="skill-card__description">
                              {extension.sourceInfo.scope} · {extension.sourceInfo.origin}
                            </span>
                            <span className="skill-card__meta">
                              <span>{extension.sourceInfo.source}</span>
                              {extension.commands.length > 0 ? <span>{extension.commands.length} commands</span> : null}
                              {extension.surfaces.length > 0 ? <span>{extension.surfaces.length} surfaces</span> : null}
                              {extension.tools.length > 0 ? <span>{extension.tools.length} tools</span> : null}
                              {extension.diagnostics.length > 0 ? <span>{extension.diagnostics.length} issues</span> : null}
                            </span>
                          </button>
                        ))
                      : null}
                  </section>
                );
              })
            )}
          </div>

          {selectedExtension ? (
            <ExtensionsSurface
              compatibilityRecords={selectedCompatibilityRecords}
              extension={selectedExtension}
            visibilityOverrides={selectedOverrides}
            onOpenExtensionFolder={onOpenExtensionFolder}
            onToggleExtension={onToggleExtension}
            onSetSurfaceField={onSetSurfaceField}
            onSetVisibilityOverride={(commandName, visibility) =>
              onSetVisibilityOverride(selectedExtension.path, commandName, visibility)
            }
              onClearVisibilityOverride={(commandName) => onClearVisibilityOverride(selectedExtension.path, commandName)}
            />
          ) : (
            <div className="skill-detail">
              <ExtensionsEmptyState message="Refresh runtime discovery to inspect extension metadata and diagnostics." />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ExtensionsEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state">
      <h2>No extensions found</h2>
      <p>{message}</p>
    </div>
  );
}
