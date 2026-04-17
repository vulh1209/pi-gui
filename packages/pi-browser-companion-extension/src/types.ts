export type BrowserWebTaskRoutingMode = "auto" | "prefer-browser-companion" | "prefer-runtime-tools";

export type BrowserHostActionName =
  | "open"
  | "focus"
  | "navigate"
  | "back"
  | "forward"
  | "reload"
  | "click"
  | "type"
  | "submit"
  | "scroll"
  | "select";

export type BrowserScrollTarget = "up" | "down" | "top" | "bottom";

export type BrowserHostAction =
  | { readonly name: "open" | "navigate"; readonly url: string }
  | { readonly name: "focus" | "back" | "forward" | "reload" }
  | { readonly name: "click"; readonly selector: string }
  | { readonly name: "type"; readonly selector: string; readonly text: string }
  | { readonly name: "submit"; readonly selector: string }
  | { readonly name: "scroll"; readonly target: BrowserScrollTarget }
  | { readonly name: "select"; readonly selector: string; readonly value: string };

export interface BrowserHostActionSequence {
  readonly actions: readonly BrowserHostAction[];
  readonly label: string;
}

export interface BrowserBridgeSettings {
  readonly routingMode: BrowserWebTaskRoutingMode;
}

export type BrowserBridgeRequest =
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

export type BrowserBridgeResponse =
  | {
      readonly ok: true;
      readonly kind: "settings";
      readonly settings: BrowserBridgeSettings;
    }
  | {
      readonly ok: true;
      readonly kind: "action";
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export const BROWSER_BRIDGE_REQUEST_EVENT = "desktop:browser:request";

export function browserBridgeResponseEvent(requestId: string): string {
  return `desktop:browser:response:${requestId}`;
}
