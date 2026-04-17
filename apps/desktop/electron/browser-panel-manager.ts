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

  currentUrl(): string | undefined {
    const url = this.view?.webContents.getURL();
    return url || undefined;
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

  async click(selector: string): Promise<void> {
    await this.runDomAction("click", { selector });
  }

  async type(selector: string, text: string): Promise<void> {
    await this.runDomAction("type", { selector, text });
  }

  async submit(selector: string): Promise<void> {
    await this.runDomAction("submit", { selector });
  }

  async scroll(target: "up" | "down" | "top" | "bottom"): Promise<void> {
    await this.runDomAction("scroll", { target });
  }

  async select(selector: string, value: string): Promise<void> {
    await this.runDomAction("select", { selector, value });
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

  private async runDomAction(
    kind: "click" | "type" | "submit" | "scroll" | "select",
    payload: Record<string, string>,
  ): Promise<void> {
    if (!this.view) {
      throw new Error("Browser companion is not open.");
    }

    const script = `(() => {
      const payload = ${JSON.stringify(payload)};
      const kind = ${JSON.stringify(kind)};

      const getElement = () => {
        const selector = payload.selector;
        if (!selector) {
          throw new Error("Browser action requires a selector.");
        }
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error("No element matches selector: " + selector);
        }
        if (element instanceof HTMLElement) {
          element.scrollIntoView({ block: "center", inline: "center" });
          element.focus();
        }
        return element;
      };

      if (kind === "click") {
        const element = getElement();
        if (element instanceof HTMLElement) {
          element.click();
          return true;
        }
        throw new Error("Matched element is not clickable.");
      }

      if (kind === "type") {
        const element = getElement();
        const text = payload.text ?? "";
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.value = text;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        if (element instanceof HTMLElement && element.isContentEditable) {
          element.textContent = text;
          element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        throw new Error("Matched element is not typable.");
      }

      if (kind === "submit") {
        const element = getElement();
        const form = element instanceof HTMLFormElement ? element : element.closest("form");
        if (form instanceof HTMLFormElement) {
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
          } else {
            form.submit();
          }
          return true;
        }
        if (element instanceof HTMLElement) {
          element.click();
          return true;
        }
        throw new Error("Matched element cannot be submitted.");
      }

      if (kind === "scroll") {
        const target = payload.target;
        if (target === "top") {
          window.scrollTo({ top: 0, behavior: "auto" });
          return true;
        }
        if (target === "bottom") {
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
          return true;
        }
        const amount = Math.max(window.innerHeight * 0.8, 240);
        window.scrollBy({ top: target === "up" ? -amount : amount, behavior: "auto" });
        return true;
      }

      if (kind === "select") {
        const element = getElement();
        if (!(element instanceof HTMLSelectElement)) {
          throw new Error("Matched element is not a <select>.");
        }
        const value = payload.value ?? "";
        const option = [...element.options].find((entry) => entry.value === value || entry.label === value || entry.text === value);
        if (!option) {
          throw new Error("No option matches value: " + value);
        }
        element.value = option.value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      throw new Error("Unsupported browser DOM action: " + kind);
    })();`;

    await this.view.webContents.executeJavaScript(script, true);
  }
}
