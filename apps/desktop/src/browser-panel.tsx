import type { BrowserPanelState } from "./browser-panel-state";

export function BrowserPanel({ panel }: { readonly panel: BrowserPanelState }) {
  return (
    <aside className="browser-panel" data-testid="browser-panel">
      <div className="browser-panel__header">
        <div>
          <div className="chat-header__eyebrow">Browser companion</div>
          <h2 className="browser-panel__title">{panel.title || "Ready to browse"}</h2>
        </div>
      </div>
      <div className="browser-panel__toolbar">
        <button aria-label="Back" className="icon-button" disabled type="button">←</button>
        <button aria-label="Forward" className="icon-button" disabled type="button">→</button>
        <button aria-label="Reload" className="icon-button" disabled type="button">↻</button>
        <input
          aria-label="Browser address"
          className="browser-panel__address"
          defaultValue={panel.url}
          placeholder="Paste a URL to start browsing"
          readOnly
        />
      </div>
      <div className="browser-panel__empty">Paste a URL to start browsing</div>
    </aside>
  );
}
