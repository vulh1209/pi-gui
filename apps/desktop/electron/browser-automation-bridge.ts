import { randomUUID } from "node:crypto";
import type { SessionRef } from "@pi-gui/session-driver";
import type { BrowserAutomationConfirmation, BrowserAutomationPolicy } from "../src/browser-panel-state";
import type { BrowserHostAction } from "../src/browser-command-routing";
import type { TranscriptMessage } from "../src/desktop-state";
import { makeActivityItem, makeToolItem } from "./app-store-utils";
import { BrowserPanelManager } from "./browser-panel-manager";

export class BrowserAutomationBridge {
  private readonly pendingConfirmations = new Map<string, (approved: boolean) => void>();

  constructor(
    private readonly panel: BrowserPanelManager,
    private readonly appendTimelineRow: (sessionRef: SessionRef, item: TranscriptMessage) => void,
    private readonly getSelectedSessionRef: () => SessionRef | undefined,
    private readonly getMainWindow: () => Electron.BrowserWindow | null,
    private readonly getPolicy: () => BrowserAutomationPolicy,
    private readonly publishConfirmation: (confirmation: BrowserAutomationConfirmation | undefined) => Promise<void> | void,
  ) {}

  async run(action: BrowserHostAction): Promise<void> {
    const sessionRef = this.getSelectedSessionRef();
    if (!sessionRef) {
      throw new Error("Browser companion requires an active session.");
    }

    await this.runForSession(sessionRef, action);
  }

  async runForSession(sessionRef: SessionRef, action: BrowserHostAction): Promise<void> {
    const window = this.getMainWindow();
    if (!window) {
      throw new Error("Browser companion requires a main window.");
    }

    const workspaceId = sessionRef.workspaceId;

    if (action.name === "open") {
      await this.runStep(sessionRef, "Open browser companion", async () => {
        await this.panel.show(window, workspaceId, this.panel.getBounds() ?? undefined);
        this.panel.focus();
      });
      await this.maybeNavigateAfterOpen(sessionRef, action.url);
      return;
    }

    if (action.name === "navigate") {
      await this.panel.show(window, workspaceId, this.panel.getBounds() ?? undefined);
      await this.runStep(sessionRef, "Navigate browser companion", async () => {
        await this.panel.navigate(action.url);
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

    if (isInteractiveAction(action)) {
      await this.confirmIfNeeded(sessionRef, action);
    }

    switch (action.name) {
      case "back":
        await this.runStep(sessionRef, "Go back in browser companion", async () => {
          this.panel.goBack();
        });
        return;
      case "forward":
        await this.runStep(sessionRef, "Go forward in browser companion", async () => {
          this.panel.goForward();
        });
        return;
      case "reload":
        await this.runStep(sessionRef, "Reload browser companion", async () => {
          this.panel.reload();
        });
        return;
      case "click":
        await this.runStep(sessionRef, "Click browser companion element", async () => {
          await this.panel.click(action.selector);
        }, action.selector);
        return;
      case "type":
        await this.runStep(sessionRef, "Type in browser companion element", async () => {
          await this.panel.type(action.selector, action.text);
        }, `${action.selector} ← ${action.text}`);
        return;
      case "submit":
        await this.runStep(sessionRef, "Submit browser companion form", async () => {
          await this.panel.submit(action.selector);
        }, action.selector);
        return;
      case "scroll":
        await this.runStep(sessionRef, "Scroll browser companion page", async () => {
          await this.panel.scroll(action.target);
        }, action.target);
        return;
      case "select":
        await this.runStep(sessionRef, "Select browser companion option", async () => {
          await this.panel.select(action.selector, action.value);
        }, `${action.selector} ← ${action.value}`);
        return;
      default:
        return;
    }
  }

  async respond(requestId: string, approved: boolean): Promise<void> {
    const resolve = this.pendingConfirmations.get(requestId);
    if (!resolve) {
      throw new Error("Browser automation confirmation is no longer pending.");
    }
    this.pendingConfirmations.delete(requestId);
    await this.publishConfirmation(undefined);
    resolve(approved);
  }

  private async maybeNavigateAfterOpen(sessionRef: SessionRef, url?: string): Promise<void> {
    if (!url) {
      return;
    }
    await this.runStep(sessionRef, "Navigate browser companion", async () => {
      await this.panel.navigate(url);
    }, url);
  }

  private async confirmIfNeeded(sessionRef: SessionRef, action: InteractiveBrowserAction): Promise<void> {
    if (!requiresInteractiveConfirmation(this.getPolicy())) {
      return;
    }

    const confirmation = buildConfirmation(action, this.panel.currentUrl());
    this.appendTimelineRow(
      sessionRef,
      makeActivityItem(`Waiting for confirmation: ${confirmation.actionLabel}`, {
        ...(confirmation.detail ? { detail: confirmation.detail } : {}),
        ...(confirmation.site ? { metadata: confirmation.site } : {}),
      }),
    );
    await this.publishConfirmation(confirmation);
    const approved = await new Promise<boolean>((resolve) => {
      this.pendingConfirmations.set(confirmation.requestId, resolve);
    });
    if (!approved) {
      this.appendTimelineRow(
        sessionRef,
        makeActivityItem(`Cancelled browser action: ${confirmation.actionLabel}`, {
          ...(confirmation.detail ? { detail: confirmation.detail } : {}),
          tone: "warning",
        }),
      );
      throw new Error("Browser action cancelled.");
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

type InteractiveBrowserAction = Extract<
  BrowserHostAction,
  { readonly name: "click" | "type" | "submit" | "scroll" | "select" }
>;

function isInteractiveAction(action: BrowserHostAction): action is InteractiveBrowserAction {
  return (
    action.name === "click" ||
    action.name === "type" ||
    action.name === "submit" ||
    action.name === "scroll" ||
    action.name === "select"
  );
}

function requiresInteractiveConfirmation(policy: BrowserAutomationPolicy): boolean {
  return policy === "ask-every-time" || policy === "allow-navigation-read";
}

function buildConfirmation(
  action: InteractiveBrowserAction,
  currentUrl: string | undefined,
): BrowserAutomationConfirmation {
  const site = siteLabelForUrl(currentUrl);
  if (action.name === "click") {
    return {
      requestId: randomUUID(),
      actionLabel: "Click browser element",
      detail: action.selector,
      site,
      message: "Allow the browser companion to click the selected page element?",
    };
  }
  if (action.name === "type") {
    return {
      requestId: randomUUID(),
      actionLabel: "Type in browser element",
      detail: `${action.selector} ← ${action.text}`,
      site,
      message: "Allow the browser companion to type into the selected page element?",
    };
  }
  if (action.name === "submit") {
    return {
      requestId: randomUUID(),
      actionLabel: "Submit browser form",
      detail: action.selector,
      site,
      message: "Allow the browser companion to submit the selected form or button?",
    };
  }
  if (action.name === "scroll") {
    return {
      requestId: randomUUID(),
      actionLabel: "Scroll browser page",
      detail: action.target,
      site,
      message: "Allow the browser companion to scroll the current page?",
    };
  }
  return {
    requestId: randomUUID(),
    actionLabel: "Select browser option",
    detail: `${action.selector} ← ${action.value}`,
    site,
    message: "Allow the browser companion to change the selected option?",
  };
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

function siteLabelForUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    return parsed.host || parsed.protocol.replace(/:$/, "");
  } catch {
    return undefined;
  }
}
