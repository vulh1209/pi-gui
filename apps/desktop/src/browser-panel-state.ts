export type BrowserPanelMode = "hidden" | "opening" | "open" | "closing";

export type BrowserAutomationPolicy =
  | "ask-every-time"
  | "allow-navigation-read"
  | "allow-full-automation";

export interface BrowserPanelState {
  readonly mode: BrowserPanelMode;
  readonly workspaceId?: string;
  readonly url: string;
  readonly title: string;
  readonly loading: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly lastError?: string;
}

export function createHiddenBrowserPanelState(): BrowserPanelState {
  return {
    mode: "hidden",
    url: "",
    title: "",
    loading: false,
    canGoBack: false,
    canGoForward: false,
  };
}
