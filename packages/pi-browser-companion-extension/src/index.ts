import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { requestBrowserAction, requestBrowserSettings } from "./browser-client";
import {
  BROWSER_COMMAND_USAGE,
  normalizeBrowserUrl,
  parseBrowserCommandArgs,
  parseNaturalLanguageBrowserIntent,
  parseNaturalLanguageBrowserIntentSequence,
  parsePreferredBrowserWebIntent,
} from "./routing";
import type { BrowserHostAction } from "./types";

export default function browserCompanionExtension(pi: ExtensionAPI): void {
  pi.registerCommand("browser", {
    description: "Open, focus, and control the desktop browser companion",
    handler: async (args, ctx) => {
      const action = parseBrowserCommandArgs(args);
      if (!action) {
        ctx.ui.notify(`Usage: /browser ${BROWSER_COMMAND_USAGE}`, "error");
        return;
      }

      await requestBrowserAction(pi, ctx, action);
    },
  });

  pi.registerTool({
    name: "browser.open",
    label: "Browser Open",
    description: "Open a URL in the visible browser companion instead of an external browser window.",
    promptSnippet: "browser.open(url): open a URL in the visible browser companion.",
    promptGuidelines: [
      "Prefer browser.open for visible in-app browsing when the user explicitly asks for browser companion behavior.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "The URL to open in the browser companion." }),
    }) as never,
    async execute(_toolCallId, params: { url: string }, _signal, _onUpdate, ctx) {
      await requestBrowserAction(pi, ctx, { name: "open", url: params.url });
      return {
        content: [{ type: "text", text: `Opened ${params.url} in the browser companion.` }],
        details: { url: params.url },
      };
    },
  });

  pi.registerTool({
    name: "browser.search",
    label: "Browser Search",
    description: "Search the web in the visible browser companion, using Google by default.",
    promptSnippet: "browser.search(query): search in the visible browser companion.",
    promptGuidelines: [
      "Use browser.search for live web searches the user should see in the browser companion.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "The search query to run." }),
      engine: Type.Optional(Type.String({ description: "Search engine to use. Defaults to google." })),
    }) as never,
    async execute(_toolCallId, params: { query: string; engine?: string }, _signal, _onUpdate, ctx) {
      const url = params.engine?.trim().toLowerCase() === "google" || !params.engine
        ? "https://www.google.com"
        : "https://www.google.com";
      const selector = defaultSearchSelector();
      await requestBrowserAction(pi, ctx, { name: "open", url });
      await requestBrowserAction(pi, ctx, { name: "type", selector, text: params.query });
      await requestBrowserAction(pi, ctx, { name: "submit", selector });
      return {
        content: [{ type: "text", text: `Searched google for ${params.query} in the browser companion.` }],
        details: { query: params.query, engine: "google", url },
      };
    },
  });

  pi.registerTool({
    name: "browser.focus",
    label: "Browser Focus",
    description: "Focus the visible browser companion without changing its page.",
    promptSnippet: "browser.focus(): focus the visible browser companion.",
    parameters: Type.Object({}) as never,
    async execute(_toolCallId, _params: Record<string, never>, _signal, _onUpdate, ctx) {
      await requestBrowserAction(pi, ctx, { name: "focus" });
      return {
        content: [{ type: "text", text: "Focused the browser companion." }],
        details: {},
      };
    },
  });

  pi.on("input", async (event, ctx) => {
    if ((event.images?.length ?? 0) > 0) {
      return undefined;
    }

    const preferredSettings = await safeGetSettings(pi);
    const preferredIntent = preferredSettings?.routingMode === "prefer-browser-companion"
      ? parsePreferredBrowserWebIntent(event.text)
      : undefined;
    if (preferredIntent) {
      await runActionSequence(pi, ctx, preferredIntent.actions);
      return { action: "handled" };
    }

    const sequence = parseNaturalLanguageBrowserIntentSequence(event.text);
    if (sequence) {
      await runActionSequence(pi, ctx, sequence.actions);
      return { action: "handled" };
    }

    const action = parseNaturalLanguageBrowserIntent(event.text);
    if (action) {
      await requestBrowserAction(pi, ctx, action);
      return { action: "handled" };
    }

    return undefined;
  });

  pi.on("before_agent_start", async (event) => {
    const settings = await safeGetSettings(pi);
    if (!settings || settings.routingMode === "auto") {
      return undefined;
    }

    const guidance = settings.routingMode === "prefer-browser-companion"
      ? [
          "When the user asks to open a website or perform a visible web search, prefer browser.open, browser.search, and browser.focus over generic web-search or external-browser tools.",
          "Only avoid browser tools when the user explicitly asks for runtime-only research tools.",
        ].join("\n")
      : [
          "Prefer generic runtime web-search tools for ordinary research unless the user explicitly asks to use the browser companion.",
          "Use browser.open/browser.search/browser.focus when the user explicitly requests visible browser companion behavior.",
        ].join("\n");

    return {
      systemPrompt: `${event.systemPrompt}\n\n[Desktop web-task routing preference]\n${guidance}`,
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    const settings = await safeGetSettings(pi);
    if (!settings || settings.routingMode !== "prefer-browser-companion") {
      return undefined;
    }

    if (event.toolName === "WebSearch") {
      const query = extractWebSearchQuery(event.input);
      if (query) {
        await runActionSequence(pi, ctx, [
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
        await requestBrowserAction(pi, ctx, { name: "open", url });
        return {
          block: true,
          reason: "Handled with browser.open because browser companion is preferred.",
        };
      }
    }

    return undefined;
  });
}

async function safeGetSettings(pi: ExtensionAPI) {
  try {
    return await requestBrowserSettings(pi);
  } catch {
    return undefined;
  }
}

async function runActionSequence(pi: ExtensionAPI, ctx: ExtensionContext, actions: readonly BrowserHostAction[]) {
  for (const action of actions) {
    await requestBrowserAction(pi, ctx, action);
  }
}

function defaultSearchSelector(): string {
  return "textarea[name='q'], input[name='q'], input[type='search'], input[type='text'], textarea";
}

function extractOpenUrl(command: string): string | undefined {
  const match = command.match(/\bopen\s+['"]?(https?:\/\/[^'"\s]+)['"]?/i);
  return normalizeBrowserUrl(match?.[1]?.trim());
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
