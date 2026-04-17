import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { BrowserWebTaskRoutingMode } from "../src/desktop-state";

interface BrowserRuntimeExtensionOptions {
  readonly getRoutingMode: () => BrowserWebTaskRoutingMode;
}

export function createBrowserRuntimeExtension(options: BrowserRuntimeExtensionOptions) {
  return function browserRuntimeExtension(pi: ExtensionAPI): void {
    pi.on("before_agent_start", async (event) => {
      const mode = options.getRoutingMode();
      if (mode === "auto") {
        return undefined;
      }

      const guidance =
        mode === "prefer-browser-companion"
          ? [
              "When the user asks to open a website or perform a visible web search, prefer the browser.open, browser.search, and browser.focus tools over external-browser tools or generic web-search tools.",
              "Only avoid browser.open/browser.search when the user explicitly asks for runtime search tools or when in-app browsing is clearly inappropriate.",
            ].join("\n")
          : [
              "Prefer generic runtime web-search tools over browser.open/browser.search for ordinary research requests unless the user explicitly asks to use the browser companion.",
              "Use browser.open/browser.search when the user explicitly requests browser companion behavior or visible in-app browsing.",
            ].join("\n");

      return {
        systemPrompt: `${event.systemPrompt}\n\n[Desktop web-task routing preference]\n${guidance}`,
      };
    });

    pi.on("tool_call", async (event) => {
      const mode = options.getRoutingMode();
      if (mode !== "prefer-browser-companion") {
        return undefined;
      }

      if (event.toolName === "WebSearch") {
        return {
          block: true,
          reason: "Use browser.search for visible in-app web searches when browser companion is preferred.",
        };
      }

      if (event.toolName === "shell") {
        const command = typeof event.input?.command === "string" ? event.input.command : "";
        if (/\bopen\s+['"]?https?:\/\//i.test(command)) {
          return {
            block: true,
            reason: "Use browser.open instead of opening external browser URLs when browser companion is preferred.",
          };
        }
      }

      return undefined;
    });
  };
}
