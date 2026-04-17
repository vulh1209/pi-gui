import { randomUUID } from "node:crypto";
import type { SessionRef } from "@pi-gui/session-driver";
import type { BrowserHostAction } from "../src/browser-command-routing";
import type { TranscriptMessage } from "../src/desktop-state";
import { makeToolItem } from "./app-store-utils";
import { BrowserPanelManager } from "./browser-panel-manager";

export class BrowserAutomationBridge {
  constructor(
    private readonly panel: BrowserPanelManager,
    private readonly appendTimelineRow: (sessionRef: SessionRef, item: TranscriptMessage) => void,
    private readonly getSelectedSessionRef: () => SessionRef | undefined,
    private readonly getMainWindow: () => Electron.BrowserWindow | null,
  ) {}

  async run(action: BrowserHostAction): Promise<void> {
    const sessionRef = this.getSelectedSessionRef();
    const window = this.getMainWindow();
    if (!sessionRef || !window) {
      throw new Error("Browser companion requires an active session.");
    }

    const workspaceId = sessionRef.workspaceId;

    if (action.name === "open") {
      await this.runStep(sessionRef, "Open browser companion", async () => {
        await this.panel.show(window, workspaceId, this.panel.getBounds() ?? undefined);
        this.panel.focus();
      });
      if (action.url) {
        await this.runStep(sessionRef, "Navigate browser companion", async () => {
          await this.panel.navigate(action.url as string);
        }, action.url);
      }
      return;
    }

    if (action.name === "navigate") {
      await this.panel.show(window, workspaceId, this.panel.getBounds() ?? undefined);
      await this.runStep(sessionRef, "Navigate browser companion", async () => {
        await this.panel.navigate(action.url as string);
      }, action.url);
      return;
    }

    if (action.name === "focus") {
      await this.runStep(sessionRef, "Focus browser companion", async () => {
        await this.panel.show(window, workspaceId, this.panel.getBounds() ?? undefined);
        this.panel.focus();
      });
      return;
    }

    await this.panel.show(window, workspaceId, this.panel.getBounds() ?? undefined);
    if (action.name === "back") {
      await this.runStep(sessionRef, "Go back in browser companion", async () => {
        this.panel.goBack();
      });
      return;
    }
    if (action.name === "forward") {
      await this.runStep(sessionRef, "Go forward in browser companion", async () => {
        this.panel.goForward();
      });
      return;
    }
    if (action.name === "reload") {
      await this.runStep(sessionRef, "Reload browser companion", async () => {
        this.panel.reload();
      });
    }
  }

  private async runStep(
    sessionRef: SessionRef,
    label: string,
    execute: () => Promise<void> | void,
    detail?: string,
  ): Promise<void> {
    try {
      await execute();
      this.appendTimelineRow(sessionRef, makeBrowserToolItem("success", label, detail));
    } catch (error) {
      this.appendTimelineRow(sessionRef, makeBrowserToolItem("error", label, formatBrowserError(error, detail)));
      throw error;
    }
  }
}

function makeBrowserToolItem(
  status: "success" | "error",
  label: string,
  detail?: string,
): TranscriptMessage {
  return makeToolItem(randomUUID(), "browser", status, label, {
    ...(detail ? { detail } : {}),
  });
}

function formatBrowserError(error: unknown, detail?: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return detail ? `${detail} · ${message}` : message;
}
