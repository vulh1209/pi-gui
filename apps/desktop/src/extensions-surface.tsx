import { useMemo, useState } from "react";
import type {
  RuntimeExtensionCommandRecord,
  RuntimeExtensionRecord,
  RuntimeExtensionSurfaceRecord,
} from "@pi-gui/session-driver/runtime-types";
import type {
  ExtensionCommandCompatibilityRecord,
  ExtensionCommandVisibility,
  ExtensionCommandVisibilityOverrideRecord,
} from "./desktop-state";

export type ExtensionDetailsTab = "overview" | "configure" | "commands" | "diagnostics";

interface ExtensionsSurfaceProps {
  readonly extension: RuntimeExtensionRecord;
  readonly compatibilityRecords: readonly ExtensionCommandCompatibilityRecord[];
  readonly visibilityOverrides: readonly ExtensionCommandVisibilityOverrideRecord[];
  readonly onOpenExtensionFolder: (filePath: string) => void;
  readonly onToggleExtension: (filePath: string, enabled: boolean) => void;
  readonly onSetSurfaceField: (extensionPath: string, fieldKey: string, value: string | boolean) => void;
  readonly onSetVisibilityOverride: (commandName: string, visibility: ExtensionCommandVisibility) => void;
  readonly onClearVisibilityOverride: (commandName: string) => void;
}

const TAB_LABELS: Readonly<Record<ExtensionDetailsTab, string>> = {
  overview: "Overview",
  configure: "Configure",
  commands: "Commands",
  diagnostics: "Diagnostics",
};

export function ExtensionsSurface({
  extension,
  compatibilityRecords,
  visibilityOverrides,
  onOpenExtensionFolder,
  onToggleExtension,
  onSetSurfaceField,
  onSetVisibilityOverride,
  onClearVisibilityOverride,
}: ExtensionsSurfaceProps) {
  const availableTabs = useMemo<readonly ExtensionDetailsTab[]>(() => {
    const tabs: ExtensionDetailsTab[] = ["overview"];
    if (extension.surfaces.length > 0) {
      tabs.push("configure");
    }
    tabs.push("commands", "diagnostics");
    return tabs;
  }, [extension.surfaces.length]);
  const [activeTab, setActiveTab] = useState<ExtensionDetailsTab>(availableTabs[0] ?? "overview");
  const selectedTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] ?? "overview";

  return (
    <div className="extension-inline-surface">

      <div className="extension-detail__tokens" role="tablist" aria-label={`${extension.displayName} details tabs`}>
        {availableTabs.map((tab) => (
          <button
            aria-selected={selectedTab === tab}
            className={`button button--secondary ${selectedTab === tab ? "button--primary" : ""}`}
            key={tab}
            role="tab"
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {selectedTab === "overview" ? (
        <OverviewTab
          extension={extension}
          onOpenExtensionFolder={onOpenExtensionFolder}
          onToggleExtension={onToggleExtension}
        />
      ) : null}
      {selectedTab === "configure" ? <ConfigureTab extension={extension} onSetSurfaceField={onSetSurfaceField} /> : null}
      {selectedTab === "commands" ? (
        <CommandsTab
          compatibilityRecords={compatibilityRecords}
          extension={extension}
          visibilityOverrides={visibilityOverrides}
          onSetVisibilityOverride={onSetVisibilityOverride}
          onClearVisibilityOverride={onClearVisibilityOverride}
        />
      ) : null}
      {selectedTab === "diagnostics" ? (
        <DiagnosticsTab compatibilityRecords={compatibilityRecords} extension={extension} />
      ) : null}
    </div>
  );
}

function OverviewTab({
  extension,
  onOpenExtensionFolder,
  onToggleExtension,
}: {
  readonly extension: RuntimeExtensionRecord;
  readonly onOpenExtensionFolder: (filePath: string) => void;
  readonly onToggleExtension: (filePath: string, enabled: boolean) => void;
}) {
  return (
    <div className="extension-inline-stack">
      <div>
        <div className="skill-detail__meta-label">{extension.displayName}</div>
        <div className="skill-detail__description">{extension.sourceInfo.source}</div>
        <div className="extension-detail__tokens">
          <span className={`slash-menu__skill-badge ${extension.enabled ? "" : "slash-menu__skill-badge--warning"}`}>
            {extension.enabled ? "Enabled" : "Disabled"}
          </span>
          <span className="slash-menu__skill-badge">{extension.sourceInfo.scope}</span>
          <span className="slash-menu__skill-badge">{extension.sourceInfo.origin}</span>
          {extension.surfaces.length > 0 ? (
            <span className="slash-menu__skill-badge">{extension.surfaces.length} surfaces</span>
          ) : null}
        </div>
      </div>
      <div>
        <div className="skill-detail__meta-label">Path</div>
        <div className="skill-detail__path">{extension.path}</div>
      </div>
      <div>
        <div className="skill-detail__actions">
          <button className="button button--secondary" type="button" onClick={() => onOpenExtensionFolder(extension.path)}>
            Open folder
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onToggleExtension(extension.path, !extension.enabled)}
          >
            {extension.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
      <div>
        <div className="skill-detail__meta-label">Surfaces</div>
        {extension.surfaces.length > 0 ? (
          <div className="extension-detail__tokens">
            {extension.surfaces.map((surface) => (
              <span className="slash-menu__skill-badge" key={surface.id}>
                {surface.title} · {surface.kind}
              </span>
            ))}
          </div>
        ) : (
          <div className="skill-detail__description">No native extension surfaces published.</div>
        )}
      </div>
      <InlineContributionSection title="Commands" items={extension.commands} emptyLabel="No commands contributed." />
      <InlineContributionSection title="Tools" items={extension.tools} emptyLabel="No tools contributed." />
      <InlineContributionSection title="Flags" items={extension.flags} emptyLabel="No flags contributed." />
      <InlineContributionSection title="Shortcuts" items={extension.shortcuts} emptyLabel="No shortcuts contributed." />
    </div>
  );
}

function ConfigureTab({
  extension,
  onSetSurfaceField,
}: {
  readonly extension: RuntimeExtensionRecord;
  readonly onSetSurfaceField: (extensionPath: string, fieldKey: string, value: string | boolean) => void;
}) {
  if (extension.surfaces.length === 0) {
    return (
      <div className="skill-detail__meta-list">
        <div>
          <div className="skill-detail__meta-label">Configure</div>
          <div className="skill-detail__description">This extension does not publish a native settings surface yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="extension-inline-stack">
      {extension.surfaces.map((surface) => (
        <div key={surface.id}>
          <div className="extension-detail__tokens">
            <span className="slash-menu__skill-badge">{surface.title}</span>
            <span className="slash-menu__skill-badge">{surface.kind}</span>
          </div>
          <ExtensionSurfacePanel extensionPath={extension.path} surface={surface} onSetSurfaceField={onSetSurfaceField} />
        </div>
      ))}
    </div>
  );
}

function ExtensionSurfacePanel({
  extensionPath,
  surface,
  onSetSurfaceField,
}: {
  readonly extensionPath: string;
  readonly surface: RuntimeExtensionSurfaceRecord;
  readonly onSetSurfaceField: (extensionPath: string, fieldKey: string, value: string | boolean) => void;
}) {
  return (
    <div>
      {surface.description ? <div className="skill-detail__description">{surface.description}</div> : null}
      <div className="extension-inline-stack">
        {surface.fields.map((field) => (
          <div className="extension-inline-field" key={field.key}>
            <div className="skill-detail__meta-label">{field.label}</div>
            {field.description ? <div className="skill-detail__description">{field.description}</div> : null}
            {field.kind === "enum" ? (
              <div className="extension-detail__tokens">
                {field.options.map((option) => (
                  <button
                    className={`button button--secondary ${option.value === field.value ? "button--primary" : ""}`}
                    key={option.value}
                    type="button"
                    onClick={() => onSetSurfaceField(extensionPath, field.key, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="extension-detail__tokens">
                <button
                  className={`button button--secondary ${field.value ? "button--primary" : ""}`}
                  type="button"
                  onClick={() => onSetSurfaceField(extensionPath, field.key, !field.value)}
                >
                  {field.value ? "Enabled" : "Disabled"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandsTab({
  extension,
  compatibilityRecords,
  visibilityOverrides,
  onSetVisibilityOverride,
  onClearVisibilityOverride,
}: {
  readonly extension: RuntimeExtensionRecord;
  readonly compatibilityRecords: readonly ExtensionCommandCompatibilityRecord[];
  readonly visibilityOverrides: readonly ExtensionCommandVisibilityOverrideRecord[];
  readonly onSetVisibilityOverride: (commandName: string, visibility: ExtensionCommandVisibility) => void;
  readonly onClearVisibilityOverride: (commandName: string) => void;
}) {
  const commands =
    extension.commandRecords.length > 0
      ? extension.commandRecords
      : extension.commands.map<RuntimeExtensionCommandRecord>((commandName) => ({ name: commandName }));

  if (commands.length === 0) {
    return (
      <div className="skill-detail__meta-list">
        <div>
          <div className="skill-detail__meta-label">Commands</div>
          <div className="skill-detail__description">This extension does not publish commands.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="extension-inline-stack">
      {commands.map((command) => {
        const override = visibilityOverrides.find(
          (entry) => entry.extensionPath === extension.path && entry.commandName === command.name,
        );
        const authorDefault = command.visibility ?? "chat";
        const effectiveVisibility = override?.visibility ?? authorDefault;
        const compatibility = compatibilityRecords.find((record) => record.commandName === command.name);
        return (
          <div className="extension-inline-command" key={command.name}>
            <div className="skill-detail__meta-label">/{command.name}</div>
            <div className="skill-detail__description">{command.description ?? "No description provided."}</div>
            <div className="extension-detail__tokens">
              <span className="slash-menu__skill-badge">Default · {formatVisibilityLabel(authorDefault)}</span>
              <span className="slash-menu__skill-badge">Effective · {formatVisibilityLabel(effectiveVisibility)}</span>
              {override ? (
                <span className="slash-menu__skill-badge">Override · {formatVisibilityLabel(override.visibility)}</span>
              ) : null}
              {compatibility ? (
                <span
                  className={`slash-menu__skill-badge ${compatibility.status === "terminal-only" ? "slash-menu__skill-badge--warning" : ""}`}
                >
                  {compatibility.status === "terminal-only" ? "Terminal-only" : "GUI-compatible"}
                </span>
              ) : null}
            </div>
            <div className="extension-detail__tokens">
              {(["chat", "extensions-page", "hidden"] as const).map((visibility) => (
                <button
                  className={`button button--secondary ${effectiveVisibility === visibility ? "button--primary" : ""}`}
                  key={visibility}
                  type="button"
                  onClick={() => onSetVisibilityOverride(command.name, visibility)}
                >
                  {formatVisibilityLabel(visibility)}
                </button>
              ))}
              {override ? (
                <button className="button button--secondary" type="button" onClick={() => onClearVisibilityOverride(command.name)}>
                  Use default
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiagnosticsTab({
  extension,
  compatibilityRecords,
}: {
  readonly extension: RuntimeExtensionRecord;
  readonly compatibilityRecords: readonly ExtensionCommandCompatibilityRecord[];
}) {
  return (
    <div className="extension-inline-stack">
      <ExtensionCompatibilitySection commands={extension.commands} compatibilityRecords={compatibilityRecords} />
      <ExtensionDiagnostics diagnostics={extension.diagnostics} />
    </div>
  );
}

function formatVisibilityLabel(value: ExtensionCommandVisibility): string {
  if (value === "extensions-page") {
    return "Extensions page";
  }

  return value === "chat" ? "Chat" : "Hidden";
}

function InlineContributionSection({
  title,
  items,
  emptyLabel,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly emptyLabel: string;
}) {
  return (
    <div>
      <div className="skill-detail__meta-label">{title}</div>
      {items.length > 0 ? (
        <div className="extension-detail__tokens">
          {items.map((item) => (
            <span className="slash-menu__skill-badge" key={item}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="skill-detail__description">{emptyLabel}</div>
      )}
    </div>
  );
}

function ExtensionDiagnostics({
  diagnostics,
}: {
  readonly diagnostics: RuntimeExtensionRecord["diagnostics"];
}) {
  return (
    <div>
      <div className="skill-detail__meta-label">Diagnostics</div>
      {diagnostics.length > 0 ? (
        <div className="extension-detail__diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <div className={`activity-item activity-item--${diagnostic.type === "error" ? "error" : "info"}`} key={`${diagnostic.message}:${index}`}>
              <div className="activity-item__text">{diagnostic.message}</div>
              {diagnostic.path ? <div className="activity-item__meta">{diagnostic.path}</div> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="skill-detail__description">No diagnostics reported.</div>
      )}
    </div>
  );
}

function ExtensionCompatibilitySection({
  commands,
  compatibilityRecords,
}: {
  readonly commands: readonly string[];
  readonly compatibilityRecords: readonly ExtensionCommandCompatibilityRecord[];
}) {
  const supported = compatibilityRecords.filter((record) => record.status === "supported");
  const terminalOnly = compatibilityRecords.filter((record) => record.status === "terminal-only");
  const unknown = commands.filter((commandName) =>
    compatibilityRecords.every(
      (record) => record.commandName !== commandName && !record.commandName.startsWith(`${commandName}:`),
    ),
  );

  return (
    <div>
      <div className="skill-detail__meta-label">Command compatibility</div>
      <div className="skill-detail__description">
        Learned from real GUI execution. Unlisted commands remain unknown until exercised.
      </div>
      <div className="extension-detail__tokens">
        {supported.map((record) => (
          <span className="slash-menu__skill-badge" key={`supported:${record.commandName}`}>
            {record.commandName} · GUI-compatible
          </span>
        ))}
        {terminalOnly.map((record) => (
          <span className="slash-menu__skill-badge slash-menu__skill-badge--warning" key={`terminal:${record.commandName}`}>
            {record.commandName} · Terminal-only
          </span>
        ))}
        {unknown.map((commandName) => (
          <span className="slash-menu__skill-badge" key={`unknown:${commandName}`}>
            {commandName} · Unknown
          </span>
        ))}
      </div>
    </div>
  );
}
