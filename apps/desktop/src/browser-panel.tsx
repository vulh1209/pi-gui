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
  const siteLabel = browserPanelSiteLabel(panel.url);
  const sessionLabel = panel.loading ? "Loading" : panel.url ? "Live session" : "Ready";
  const title = panel.title || (panel.loading ? "Loading…" : "Ready to browse");

  useEffect(() => {
    setDraft(panel.url);
  }, [panel.url]);

  return (
    <aside className={`browser-panel browser-panel--${panel.mode}`} data-testid="browser-panel">
      <div className="browser-panel__header">
        <div className="browser-panel__eyebrow-row">
          <div className="chat-header__eyebrow">Browser companion</div>
          <div className="browser-panel__session-chip">{sessionLabel}</div>
        </div>
        <div className="browser-panel__title-row">
          <div>
            <h2 className="browser-panel__title">{title}</h2>
            <div className="browser-panel__subtitle">{siteLabel || "Use the same workspace browser session for search, login, and follow-up actions."}</div>
          </div>
          <div className="browser-panel__meta-chips">
            {siteLabel ? <div className="browser-panel__site-chip">{siteLabel}</div> : null}
            <div className="browser-panel__trust-chip">Workspace scoped</div>
          </div>
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
        {!panel.url ? (
          <div className="browser-panel__empty">
            <div className="browser-panel__empty-card">
              <div className="browser-panel__empty-title">Open a page in the companion browser</div>
              <div className="browser-panel__empty-body">
                Paste a URL, run <code>/browser open https://example.com</code>, or ask pi to search in the same visible browser session.
              </div>
            </div>
          </div>
        ) : null}
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

function browserPanelSiteLabel(url: string): string {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "data:") {
      return "In-app page";
    }
    return parsed.host || parsed.protocol.replace(/:$/, "");
  } catch {
    return url;
  }
}
