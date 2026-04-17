import type { RuntimeExtensionRecord, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type {
  ExtensionCommandCompatibilityRecord,
  ExtensionCommandVisibilityOverrideRecord,
  WorkspaceRecord,
} from "../desktop-state";

export const tungdevExtensionsFixture: readonly RuntimeExtensionRecord[] = [
  {
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
    commands: ["pi-mode", "pi-mode-status"],
    commandRecords: [
      { name: "pi-mode", description: "Configure Pi Mode", visibility: "extensions-page" },
      { name: "pi-mode-status", description: "Show Pi Mode status", visibility: "chat" },
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
            description: "Choose between Pi, Codex, and Droid behavior packs.",
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
            description: "Include repo SYSTEM.md in the selected prompt stack.",
            value: true,
          },
          {
            kind: "boolean",
            key: "includePiPromptSection",
            label: "Include Pi prompt section",
            description: "Preserve incoming Pi prompt before Codex/Droid instructions.",
            value: false,
          },
        ],
      },
    ],
    tools: ["WebSearch", "WebSummary", "FetchUrl"],
    flags: [],
    shortcuts: ["ctrl+shift+t"],
    diagnostics: [],
  },
  {
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
  },
  {
    path: "/mock/project/.pi/extensions/local-helper.ts",
    displayName: "local-helper",
    enabled: true,
    sourceInfo: {
      path: "/mock/project/.pi/extensions/local-helper.ts",
      source: "extension",
      scope: "project",
      origin: "top-level",
      baseDir: "/mock/project/.pi/extensions",
    },
    commands: ["local-helper"],
    commandRecords: [{ name: "local-helper", description: "Project-local helper", visibility: "chat" }],
    surfaces: [],
    tools: ["LocalTool"],
    flags: [],
    shortcuts: [],
    diagnostics: [],
  },
];

export const tungdevVisibilityOverridesFixture: readonly ExtensionCommandVisibilityOverrideRecord[] = [];

export const tungdevCompatibilityFixture: readonly ExtensionCommandCompatibilityRecord[] = [
  {
    commandName: "pi-mode",
    extensionPath: "/mock/node_modules/@tungthedev/pi-extensions/extensions/pi-modes.ts",
    status: "supported",
    message: "Observed working in pi-gui.",
    capability: "gui-safe",
    updatedAt: new Date().toISOString(),
  },
];

export const extensionsStoryWorkspace: WorkspaceRecord = {
  id: "workspace-1",
  name: "pi-gui",
  path: "/mock/pi-gui",
  lastOpenedAt: new Date().toISOString(),
  kind: "primary",
  sessions: [],
};

export const extensionsStoryRuntime: RuntimeSnapshot = {
  workspace: { workspaceId: "workspace-1", path: "/mock/pi-gui", displayName: "pi-gui" },
  providers: [],
  models: [],
  skills: [],
  extensions: tungdevExtensionsFixture,
  settings: { enableSkillCommands: true, enabledModelPatterns: [] },
};
