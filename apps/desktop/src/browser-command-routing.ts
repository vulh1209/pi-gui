// Desktop host code only needs the shared browser action payload types.
// Command parsing and natural-language routing now live in the proper
// `pi-browser-companion-extension` package.

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
