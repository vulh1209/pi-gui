import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  BROWSER_BRIDGE_REQUEST_EVENT,
  browserBridgeResponseEvent,
  type BrowserBridgeRequest,
  type BrowserBridgeResponse,
  type BrowserBridgeSettings,
  type BrowserHostAction,
} from "./types";

const BRIDGE_TIMEOUT_MS = 15_000;

export async function requestBrowserAction(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  action: BrowserHostAction,
): Promise<void> {
  await requestBridge(pi, {
    kind: "action",
    requestId: randomUUID(),
    cwd: ctx.cwd,
    sessionId: ctx.sessionManager.getSessionId(),
    action,
  });
}

export async function requestBrowserSettings(pi: ExtensionAPI): Promise<BrowserBridgeSettings> {
  const response = await requestBridge(pi, {
    kind: "settings",
    requestId: randomUUID(),
  });
  if (response.kind !== "settings") {
    throw new Error("Unexpected browser bridge response.");
  }
  return response.settings;
}

async function requestBridge(pi: ExtensionAPI, payload: BrowserBridgeRequest): Promise<BrowserBridgeResponse> {
  const responseChannel = browserBridgeResponseEvent(payload.requestId);
  return await new Promise<BrowserBridgeResponse>((resolve, reject) => {
    const cleanup = pi.events.on(responseChannel, (raw) => {
      clearTimeout(timeout);
      cleanup();
      const response = raw as BrowserBridgeResponse;
      if (response.ok) {
        resolve(response);
        return;
      }
      reject(new Error(response.error));
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Browser companion host bridge timed out."));
    }, BRIDGE_TIMEOUT_MS);

    pi.events.emit(BROWSER_BRIDGE_REQUEST_EVENT, payload);
  });
}
