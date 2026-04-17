import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { parsePreferredBrowserWebIntent } from "../src/browser-command-routing";
import type { BrowserHostAction } from "../src/browser-command-routing";
import type { BrowserWebTaskRoutingMode } from "../src/desktop-state";

interface BrowserRuntimeExtensionOptions {
  readonly getRoutingMode: () => BrowserWebTaskRoutingMode;
  readonly runBrowserActionSequence: (context: BrowserRuntimeContext, actions: readonly BrowserHostAction[]) => Promise<void>;
  readonly resolveContext: (ctx: { readonly cwd: string; readonly sessionManager: { getSessionId(): string } }) => BrowserRuntimeContext | undefined;
}

interface BrowserRuntimeContext {
  readonly cwd: string;
  readonly sessionId: string;
}

export function createBrowserRuntimeExtension(options: BrowserRuntimeExtensionOptions) {
  return function browserRuntimeExtension(pi: ExtensionAPI): void {
    pi.on("input", async (event, ctx) => {
      const mode = options.getRoutingMode();
      if (mode !== "prefer-browser-companion" || (event.images?.length ?? 0) > 0) {
        return undefined;
      }

      const preferredIntent = parsePreferredBrowserWebIntent(event.text);
      if (!preferredIntent) {
        return undefined;
      }

      const runtimeContext = options.resolveContext(ctx);
      if (!runtimeContext) {
        return undefined;
      }

      await options.runBrowserActionSequence(runtimeContext, preferredIntent.actions);
      return { action: "handled" };
    });

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

    pi.on("tool_call", async (event, ctx) => {
      const mode = options.getRoutingMode();
      if (mode !== "prefer-browser-companion") {
        return undefined;
      }

      const runtimeContext = options.resolveContext(ctx);

      if (event.toolName === "WebSearch") {
        const query = extractWebSearchQuery(event.input);
        if (runtimeContext && query) {
          await options.runBrowserActionSequence(runtimeContext, [
            { name: "open", url: "https://www.google.com" },
            { name: "type", selector: defaultSearchSelector(), text: query },
            { name: "submit", selector: defaultSearchSelector() },
          ]);
        }
        return {
          block: true,
          reason: "Handled with browser companion search because browser companion is preferred.",
        };
      }

      if (event.toolName === "shell") {
        const command = typeof event.input?.command === "string" ? event.input.command : "";
        const url = extractOpenUrl(command);
        if (url) {
          if (runtimeContext) {
            await options.runBrowserActionSequence(runtimeContext, [{ name: "open", url }]);
          }
          return {
            block: true,
            reason: "Handled with browser.open because browser companion is preferred.",
          };
        }
      }

      return undefined;
    });
  };
}

function defaultSearchSelector(): string {
  return "textarea[name='q'], input[name='q'], input[type='search'], input[type='text'], textarea";
}

function extractOpenUrl(command: string): string | undefined {
  const match = command.match(/\bopen\s+['"]?(https?:\/\/[^'"\s]+)['"]?/i);
  return match?.[1]?.trim();
}

function extractWebSearchQuery(input: Record<string, unknown>): string | undefined {
  const query = typeof input.query === "string" ? input.query.trim() : undefined;
  if (query) {
    return query;
  }

  const searchQueries = Array.isArray(input.search_queries)
    ? input.search_queries.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  if (searchQueries.length > 0) {
    return searchQueries.join(" ");
  }

  const objective = typeof input.objective === "string" ? input.objective.trim() : undefined;
  return objective || undefined;
}
