import { BrowserWindow, WebContentsView } from "electron";
import type { BrowserPanelState } from "../src/browser-panel-state";
import { createHiddenBrowserPanelState } from "../src/browser-panel-state";
import { BrowserProfileRegistry } from "./browser-profile-registry";

export class BrowserPanelManager {
  private view: WebContentsView | null = null;
  private activeWorkspaceId: string | null = null;
  private activeWindow: BrowserWindow | null = null;
  private lastBounds: Electron.Rectangle | null = null;

  constructor(
    private readonly profileRegistry: BrowserProfileRegistry,
    private readonly publish: (state: BrowserPanelState) => Promise<void> | void,
  ) {}

  hasView(): boolean {
    return Boolean(this.view);
  }

  getBounds(): Electron.Rectangle | null {
    return this.view?.getBounds() ?? this.lastBounds;
  }

  setBounds(bounds: Electron.Rectangle): void {
    this.lastBounds = bounds;
    this.view?.setBounds(bounds);
  }

  async show(window: BrowserWindow, workspaceId: string, bounds?: Electron.Rectangle): Promise<void> {
    if (!this.view || this.activeWorkspaceId !== workspaceId) {
      await this.destroyView();
      this.view = new WebContentsView({
        webPreferences: {
          session: this.profileRegistry.getSession(workspaceId),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      this.activeWorkspaceId = workspaceId;
      this.activeWindow = window;
      window.contentView.addChildView(this.view);
      this.wireEvents(this.view);
    }

    const nextBounds = bounds ?? this.lastBounds;
    if (nextBounds) {
      this.lastBounds = nextBounds;
      this.view.setBounds(nextBounds);
    }
    this.view.setVisible(true);
    await this.publishSnapshot();
  }

  async syncWorkspace(window: BrowserWindow, workspaceId: string, bounds: Electron.Rectangle): Promise<void> {
    if (!this.view || this.activeWorkspaceId !== workspaceId) {
      await this.show(window, workspaceId, bounds);
      return;
    }

    this.setBounds(bounds);
    this.view.setVisible(true);
    await this.publishSnapshot();
  }

  async navigate(url: string): Promise<void> {
    if (!this.view) {
      throw new Error("Browser companion is not open.");
    }
    await this.view.webContents.loadURL(url);
  }

  goBack(): void {
    if (this.view?.webContents.canGoBack()) {
      this.view.webContents.goBack();
    }
  }

  goForward(): void {
    if (this.view?.webContents.canGoForward()) {
      this.view.webContents.goForward();
    }
  }

  reload(): void {
    this.view?.webContents.reload();
  }

  focus(): void {
    this.activeWindow?.focus();
    this.view?.webContents.focus();
  }

  async close(): Promise<void> {
    this.view?.setVisible(false);
    await this.publish({
      ...createHiddenBrowserPanelState(),
      mode: "hidden",
      workspaceId: this.activeWorkspaceId ?? undefined,
    });
  }

  private wireEvents(view: WebContentsView): void {
    const wc = view.webContents;
    const publishSnapshot = () => {
      void this.publishSnapshot(view);
    };

    wc.on("did-start-loading", publishSnapshot);
    wc.on("did-stop-loading", publishSnapshot);
    wc.on("page-title-updated", publishSnapshot);
    wc.on("did-navigate", publishSnapshot);
    wc.on("did-navigate-in-page", publishSnapshot);
    wc.on("did-fail-load", (_event, _errorCode, errorDescription) => {
      void this.publish({
        mode: "open",
        workspaceId: this.activeWorkspaceId ?? undefined,
        url: wc.getURL(),
        title: wc.getTitle(),
        loading: wc.isLoading(),
        canGoBack: wc.canGoBack(),
        canGoForward: wc.canGoForward(),
        lastError: errorDescription,
      });
    });
  }

  private async publishSnapshot(view = this.view): Promise<void> {
    if (!view) {
      return;
    }

    const wc = view.webContents;
    await this.publish({
      mode: "open",
      workspaceId: this.activeWorkspaceId ?? undefined,
      url: wc.getURL(),
      title: wc.getTitle(),
      loading: wc.isLoading(),
      canGoBack: wc.canGoBack(),
      canGoForward: wc.canGoForward(),
      ...(wc.getURL() ? {} : { lastError: undefined }),
    });
  }

  private async destroyView(): Promise<void> {
    if (!this.view) {
      return;
    }

    try {
      this.activeWindow?.contentView.removeChildView(this.view);
    } catch {
      // Best-effort cleanup when the child view was already detached.
    }

    this.view.webContents.close();
    this.view = null;
    this.activeWorkspaceId = null;
    this.activeWindow = null;
  }
}
