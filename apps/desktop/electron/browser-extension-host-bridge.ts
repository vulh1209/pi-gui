import type { EventBus } from "@mariozechner/pi-coding-agent";
import type { BrowserWebTaskRoutingMode } from "../src/desktop-state";
import { BrowserAutomationBridge } from "./browser-automation-bridge";

type BrowserHostAction =
  | { readonly name: "open" | "navigate"; readonly url: string }
  | { readonly name: "focus" | "back" | "forward" | "reload" }
  | { readonly name: "click"; readonly selector: string }
  | { readonly name: "type"; readonly selector: string; readonly text: string }
  | { readonly name: "submit"; readonly selector: string }
  | { readonly name: "scroll"; readonly target: "up" | "down" | "top" | "bottom" }
  | { readonly name: "select"; readonly selector: string; readonly value: string };

type BrowserBridgeRequest =
  | {
      readonly kind: "settings";
      readonly requestId: string;
    }
  | {
      readonly kind: "action";
      readonly requestId: string;
      readonly cwd: string;
      readonly sessionId: string;
      readonly action: BrowserHostAction;
    };

type BrowserBridgeResponse =
  | {
      readonly ok: true;
      readonly kind: "settings";
      readonly settings: {
        readonly routingMode: BrowserWebTaskRoutingMode;
      };
    }
  | {
      readonly ok: true;
      readonly kind: "action";
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

const REQUEST_EVENT = "desktop:browser:request";

function responseEvent(requestId: string): string {
  return `desktop:browser:response:${requestId}`;
}

interface BrowserExtensionHostBridgeOptions {
  readonly eventBus: EventBus;
  readonly browserAutomationBridge: BrowserAutomationBridge;
  readonly getRoutingMode: () => BrowserWebTaskRoutingMode;
  readonly resolveSessionRef: (input: { readonly cwd: string; readonly sessionId: string }) =>
    | { readonly workspaceId: string; readonly sessionId: string }
    | undefined;
}

export function registerBrowserExtensionHostBridge(options: BrowserExtensionHostBridgeOptions): () => void {
  return options.eventBus.on(REQUEST_EVENT, async (raw) => {
    const payload = raw as BrowserBridgeRequest;
    if (!payload || typeof payload !== "object" || typeof payload.requestId !== "string") {
      return;
    }

    try {
      if (payload.kind === "settings") {
        options.eventBus.emit(responseEvent(payload.requestId), {
          ok: true,
          kind: "settings",
          settings: {
            routingMode: options.getRoutingMode(),
          },
        } satisfies BrowserBridgeResponse);
        return;
      }

      if (payload.kind !== "action") {
        throw new Error("Unsupported browser bridge request.");
      }

      const sessionRef = options.resolveSessionRef({
        cwd: payload.cwd,
        sessionId: payload.sessionId,
      });
      if (!sessionRef) {
        throw new Error("Browser companion requires an active desktop session.");
      }

      await options.browserAutomationBridge.runForSession(sessionRef, payload.action);
      options.eventBus.emit(responseEvent(payload.requestId), {
        ok: true,
        kind: "action",
      } satisfies BrowserBridgeResponse);
    } catch (error) {
      options.eventBus.emit(responseEvent(payload.requestId), {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies BrowserBridgeResponse);
    }
  });
}
