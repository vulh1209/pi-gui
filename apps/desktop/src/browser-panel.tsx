import { useEffect, useState } from "react";
import type { BrowserAutomationConfirmation, BrowserPanelState } from "./browser-panel-state";

interface BrowserPanelProps {
  readonly panel: BrowserPanelState;
  readonly onNavigate: (url: string) => void;
  readonly onBack: () => void;
  readonly onForward: () => void;
  readonly onReload: () => void;
  readonly viewportRef: (node: HTMLDivElement | null) => void;
}

export function BrowserPanel({
  panel,
  onNavigate,
  onBack,
  onForward,
  onReload,
  viewportRef,
}: BrowserPanelProps) {
  const [draft, setDraft] = useState(panel.url);

  useEffect(() => {
    setDraft(panel.url);
  }, [panel.url]);

  return (
    <aside className={`browser-panel browser-panel--${panel.mode}`} data-testid="browser-panel">
      <div className="browser-panel__header">
        <div>
          <div className="chat-header__eyebrow">Browser companion</div>
          <h2 className="browser-panel__title">{panel.title || (panel.loading ? "Loading…" : "Ready to browse")}</h2>
        </div>
      </div>
      <form
        className="browser-panel__toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          const next = draft.trim();
          if (!next) {
            return;
          }
          onNavigate(next);
        }}
      >
        <button aria-label="Back" className="icon-button" disabled={!panel.canGoBack} type="button" onClick={onBack}>←</button>
        <button aria-label="Forward" className="icon-button" disabled={!panel.canGoForward} type="button" onClick={onForward}>→</button>
        <button aria-label="Reload" className="icon-button" type="button" onClick={onReload}>↻</button>
        <input
          aria-label="Browser address"
          className="browser-panel__address"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Paste a URL to start browsing"
        />
      </form>
      <div className="browser-panel__viewport" ref={viewportRef}>
        {!panel.url ? <div className="browser-panel__empty">Paste a URL to start browsing</div> : null}
      </div>
    </aside>
  );
}

export function BrowserAutomationDialog({
  confirmation,
  onRespond,
}: {
  readonly confirmation: BrowserAutomationConfirmation;
  readonly onRespond: (approved: boolean) => void;
}) {
  return (
    <div className="extension-dialog-backdrop">
      <div className="extension-dialog" data-testid="browser-automation-dialog">
        <div className="extension-dialog__title">Browser automation approval</div>
        <p className="extension-dialog__body">{confirmation.message}</p>
        <div className="browser-automation-dialog__details">
          <div><strong>Action:</strong> {confirmation.actionLabel}</div>
          {confirmation.site ? <div><strong>Site:</strong> {confirmation.site}</div> : null}
          {confirmation.detail ? <div><strong>Detail:</strong> {confirmation.detail}</div> : null}
        </div>
        <div className="extension-dialog__actions">
          <button className="button button--secondary" type="button" onClick={() => onRespond(false)}>
            Cancel
          </button>
          <button className="button button--primary" type="button" onClick={() => onRespond(true)}>
            Allow once
          </button>
        </div>
      </div>
    </div>
  );
}
