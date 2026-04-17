import type { AgentToolResult, ExtensionContext, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { BrowserHostAction } from "../src/browser-command-routing";
import type { BrowserWebTaskRoutingMode } from "../src/desktop-state";

interface BrowserRuntimeToolOptions {
  readonly runBrowserActionSequence: (context: BrowserRuntimeContext, actions: readonly BrowserHostAction[]) => Promise<void>;
  readonly resolveContext: (ctx: ExtensionContext) => BrowserRuntimeContext | undefined;
  readonly getRoutingMode: () => BrowserWebTaskRoutingMode;
}

interface BrowserRuntimeContext {
  readonly cwd: string;
  readonly sessionId: string;
}

export function createBrowserRuntimeTools(options: BrowserRuntimeToolOptions): readonly ToolDefinition[] {
  const openParameters = Type.Object({
    url: Type.String({ description: "The URL to open in the browser companion." }),
  }) as never;
  const searchParameters = Type.Object({
    query: Type.String({ description: "The search query to run." }),
    engine: Type.Optional(Type.String({ description: "Search engine to use. Defaults to google." })),
  }) as never;
  const focusParameters = Type.Object({}) as never;

  return [
    {
      name: "browser.open",
      label: "Browser Open",
      description: "Open a URL in the visible browser companion instead of opening an external browser window.",
      promptSnippet: "browser.open(url): open a URL in the visible browser companion for in-app browsing.",
      promptGuidelines: [
        "Prefer browser.open for opening websites inside pi-gui instead of shell open when browsing in-app is appropriate.",
      ],
      parameters: openParameters,
      async execute(_toolCallId, params: any, _signal, _onUpdate, ctx) {
        const runtimeContext = options.resolveContext(ctx);
        if (!runtimeContext) {
          throw new Error("Browser companion tools require an active desktop session.");
        }
        await options.runBrowserActionSequence(runtimeContext, [{ name: "open", url: params.url }]);
        return successResult(`Opened ${params.url} in the browser companion.`, {
          url: params.url,
          routingMode: options.getRoutingMode(),
        });
      },
    },
    {
      name: "browser.search",
      label: "Browser Search",
      description: "Search the web in the visible browser companion, using Google by default.",
      promptSnippet: "browser.search(query): search in the visible browser companion when the user wants live browsing instead of pure runtime web tools.",
      promptGuidelines: [
        "Use browser.search for live web searches the user should see in the browser companion, especially when browser companion is preferred.",
      ],
      parameters: searchParameters,
      async execute(_toolCallId, params: any, _signal, _onUpdate, ctx) {
        const runtimeContext = options.resolveContext(ctx);
        if (!runtimeContext) {
          throw new Error("Browser companion tools require an active desktop session.");
        }
        const engine = normalizeSearchEngine(params.engine);
        const url = searchEngineUrl(engine);
        await options.runBrowserActionSequence(runtimeContext, [
          { name: "open", url },
          { name: "type", selector: defaultSearchSelector(), text: params.query },
          { name: "submit", selector: defaultSearchSelector() },
        ]);
        return successResult(`Searched ${engine} for ${params.query} in the browser companion.`, {
          query: params.query,
          engine,
          url,
          routingMode: options.getRoutingMode(),
        });
      },
    },
    {
      name: "browser.focus",
      label: "Browser Focus",
      description: "Focus the visible browser companion without changing its page.",
      promptSnippet: "browser.focus(): focus the visible browser companion when the user wants to continue browsing in-app.",
      parameters: focusParameters,
      async execute(_toolCallId, _params: any, _signal, _onUpdate, ctx) {
        const runtimeContext = options.resolveContext(ctx);
        if (!runtimeContext) {
          throw new Error("Browser companion tools require an active desktop session.");
        }
        await options.runBrowserActionSequence(runtimeContext, [{ name: "focus" }]);
        return successResult("Focused the browser companion.", {
          routingMode: options.getRoutingMode(),
        });
      },
    },
  ] as const satisfies readonly ToolDefinition[];
}

function defaultSearchSelector(): string {
  return "textarea[name='q'], input[name='q'], input[type='search'], input[type='text'], textarea";
}

function normalizeSearchEngine(value: string | undefined): "google" {
  return value?.trim().toLowerCase() === "google" ? "google" : "google";
}

function searchEngineUrl(engine: "google"): string {
  if (engine === "google") {
    return "https://www.google.com";
  }
  return "https://www.google.com";
}

function successResult(text: string, details: Record<string, unknown>): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: "text", text }],
    details,
  };
}
