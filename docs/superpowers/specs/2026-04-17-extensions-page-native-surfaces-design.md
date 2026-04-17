# Extensions page native surfaces design

## Problem

`pi-gui` currently treats the Extensions page as a mostly read-only inspection surface: users can see extension metadata, commands, tools, compatibility, and diagnostics, but not interact with structured extension-specific settings inside the page. At the same time, some extensions — such as `@tungthedev/pi-extensions` `settings` / `pi-mode` — expose configuration through terminal-oriented `ctx.ui.custom(...)` flows. In `pi-gui`, those commands are detected as terminal-only custom UI and fail with a message telling the user to use the terminal.

This creates the wrong UX for configuration-first extension flows:
- config commands clutter the composer slash menu
- the Extensions page cannot host the settings UI users actually need
- `pi-gui` has no structured contract for extension-native detail surfaces

## Goal

Refactor the existing Extensions page so it can host structured, native extension surfaces in the right-side detail panel, and allow extension authors to control whether commands appear in chat, in the Extensions page, or nowhere by default.

The intended first concrete example is `@tungthedev/pi-extensions` `settings` / `pi-mode`, which should appear as a native settings surface in the Extensions page rather than as a terminal-only slash command flow.

## Decisions already made

### Scope of the UI host

Use the **existing Extensions page**, not a new app page or modal-first design.

### Visibility ownership

- Extension author defines the default visibility when using the new API.
- If the author does **not** define visibility on the new structured API, the command defaults to **not visible in chat**.
- The user may override visibility globally in `pi-gui`.
- Override scope is **global app-wide**, not per workspace.

### Product direction

Commands that are primarily configuration/UI entry points should be able to live in the Extensions page and not appear in the chat slash menu by default.

## Non-goals

- Do not attempt to generically render arbitrary `ctx.ui.custom(...)` terminal UIs inside `pi-gui`.
- Do not redesign the app around a new top-level page for extension settings.
- Do not add per-workspace command-visibility overrides in this change.
- Do not solve every possible extension UI shape in phase 1.

## Why not support `custom()` directly?

`ctx.ui.custom(...)` is an arbitrary TUI render loop. It does not provide a stable semantic schema that `pi-gui` can map to native controls. Trying to reverse-engineer custom TUI output would create a brittle compatibility layer with poor long-term maintainability.

Instead, `pi-gui` should support a **structured extension-surface schema** with explicit field types and explicit command visibility semantics.

## Proposed architecture

## 1. Extend extension runtime metadata with native surfaces and command visibility

Introduce new structured runtime metadata for extensions.

### Command visibility

Each extension command can declare a default visibility:

- `chat` — visible in the composer slash menu
- `extensions-page` — not visible in chat, but represented in the Extensions page as a page action/surface entry
- `hidden` — not shown by default in either place as a direct command affordance

For the **new structured API** only, if an author does not define visibility, the default is `hidden`.

### Extension surfaces

An extension may declare one or more structured surfaces that `pi-gui` can render inside the Extensions detail panel.

Phase 1 should support one surface kind:
- `settings-form`

Additional surface kinds can come later.

## 2. Refactor the existing Extensions detail panel into a native surface host

Keep the left rail largely the same:
- search
- extension cards
- enabled/disabled state
- command/tool counts
- diagnostics indicators

Refactor the right-side detail panel to support:

1. **Header**
   - extension name
   - source label
   - enabled/disabled badge
   - open folder / enable-disable actions

2. **Summary block**
   - scope
   - origin
   - path
   - surface availability summary
   - command visibility summary

3. **Surface tabs**
   - Overview
   - Configure
   - Commands
   - Diagnostics

4. **Native surface renderer**
   - renders `settings-form` surfaces directly in the detail panel

This keeps the current information architecture while making the existing page truly interactive.

## 3. `settings-form` schema for phase 1

A first-pass structured settings surface should support fields that map cleanly to native desktop controls.

```ts
type RuntimeExtensionSurfaceRecord = {
  id: string;
  title: string;
  description?: string;
  kind: "settings-form";
  fields: RuntimeExtensionSurfaceFieldRecord[];
};

type RuntimeExtensionSurfaceFieldRecord =
  | {
      kind: "enum";
      key: string;
      label: string;
      description?: string;
      value: string;
      options: Array<{
        value: string;
        label: string;
        description?: string;
      }>;
    }
  | {
      kind: "boolean";
      key: string;
      label: string;
      description?: string;
      value: boolean;
    };
```

The renderer maps:
- `enum` → segmented control, pills, or radio-card group
- `boolean` → toggle / on-off segmented control

This is enough for the initial `pi-mode` experience.

## 4. Concrete Tungdev example

`@tungthedev/pi-extensions` includes a `settings` extension that currently exposes `/pi-mode` and uses `ctx.ui.custom(...)` with `SettingsList`.

Today, the underlying settings are:
- `toolSet`: `pi | codex | droid`
- `systemMdPrompt`: boolean
- `includePiPromptSection`: boolean

Under the new structured-surface model, the extension should expose a surface similar to:

```ts
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
      value: true,
    },
    {
      kind: "boolean",
      key: "includePiPromptSection",
      label: "Include Pi prompt section",
      value: false,
    },
  ],
}
```

And the `pi-mode` command should default to `extensions-page` rather than `chat`.

## 5. Command visibility model

### Effective visibility

`pi-gui` computes command visibility as:

```ts
effectiveVisibility = userOverride ?? authorVisibility ?? legacyFallback
```

### Global user override

Users can override command visibility globally from the Extensions page. For each command, the detail panel should offer choices like:
- Chat visible
- Extensions page only
- Hidden

This override is global app state, not per-repo.

### Default behavior for new vs legacy APIs

This is the most important compatibility decision.

If we apply the new default (`hidden` when author does not define visibility) to all existing commands immediately, many legacy extension commands would disappear from chat unexpectedly.

Therefore the design should distinguish:

#### New structured extension API
- author visibility missing → default `hidden`

#### Legacy extension commands
- preserve current behavior for backward compatibility
- practical default: keep them chat-visible unless future migration explicitly changes them

This allows a safe rollout:
- new surfaces/commands use the new rules
- legacy extensions do not regress

## 6. Renderer behavior in the Extensions page

For `settings-form` surfaces, the Configure tab should show:
- field label
- description/help text
- current value control
- immediate feedback or save/apply confirmation

The Commands tab should show:
- commands contributed by the extension
- author default visibility
- user override state
- effective visibility

The Diagnostics tab should keep current diagnostics and compatibility content.

The Overview tab should summarize:
- what the extension does
- what surfaces it exposes
- whether it contributes chat commands, extension-page-only commands, or both

## 7. Slash menu filtering behavior

The composer slash menu should only include extension commands whose **effective visibility** resolves to `chat`.

Commands with `extensions-page` should not appear in slash suggestions.

For `pi-mode`, that means:
- by default, no `/pi-mode` in chat
- the user finds and configures it from the Extensions page
- if the user globally overrides it to `chat`, then `/pi-mode` appears again in the slash menu

## 8. API direction

Do not overload command registration alone for everything.

Prefer an explicit separation between:
- command registration
- surface registration

For example, conceptually:

```ts
pi.registerCommand("pi-mode", {
  description: "Configure Pi Mode",
  visibility: "extensions-page",
  ...
});

pi.registerExtensionSurface({
  id: "pi-mode-settings",
  kind: "settings-form",
  ...
});
```

This separation makes the model clearer:
- commands are commands
- extension surfaces are UI surfaces

A command can deep-link to a surface if desired, but a surface does not need to be represented as a slash command.

## 9. Data flow

### Runtime side

When runtime loads extensions, it should collect and expose:
- extension commands
- command visibility metadata
- structured surfaces

and place them into the runtime snapshot.

### Desktop state

`RuntimeExtensionRecord` should grow to include:
- structured command visibility metadata
- structured surfaces

Desktop state should also include global user overrides for extension command visibility.

### Renderer side

`ExtensionsView` should use the selected extension’s runtime metadata to:
- render tabs
- render `settings-form` fields
- show effective command visibility
- allow editing global override state

### Composer side

Slash command building should read the effective visibility and exclude extension commands that are not chat-visible.

## 10. Backward compatibility

This change must not make legacy extension commands disappear unexpectedly.

Migration rules:
- legacy extension with no new metadata → preserve current command behavior
- new surface-aware extension with no explicit command visibility → default hidden
- global user overrides apply on top of either author or legacy fallback visibility

## 11. Testing strategy

### Runtime/desktop tests

Add coverage for:
1. structured extension surfaces appearing in the Extensions page
2. `settings-form` fields rendering correctly
3. field changes propagating through the intended extension/runtime path
4. command visibility filtering affecting slash menu suggestions
5. global override winning over author default
6. legacy commands remaining visible under compatibility fallback

### Tungdev example coverage

Use the Tungdev `settings` / `pi-mode` experience as the concrete end-to-end proof:
- `settings` extension exposes a native settings surface
- Configure tab shows `toolSet`, `systemMdPrompt`, `includePiPromptSection`
- `/pi-mode` is absent from chat by default when marked `extensions-page`
- user override can make `/pi-mode` appear in chat again

## 12. Risks

### Risk: scope explosion

Mitigation:
- phase 1 supports only `settings-form`
- keep all other surface kinds out of scope

### Risk: extension ecosystem breakage

Mitigation:
- preserve legacy command behavior
- make the new model opt-in

### Risk: trying to support too much of `custom()` indirectly

Mitigation:
- explicitly do not support generic `custom()` rendering
- require structured surfaces for GUI-native extension UI

## Success criteria

1. The existing Extensions page becomes a native host for structured extension surfaces.
2. `pi-mode`-style configuration is usable inside the Extensions page without terminal-only custom UI errors.
3. Extension authors can define default command visibility.
4. If a new structured extension command does not define visibility, it is hidden from chat by default.
5. Users can globally override command visibility in `pi-gui`.
6. Legacy extensions do not unexpectedly lose chat-visible commands.
