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

const BROWSER_COMMAND = "/browser";
const COMMON_BROWSER_TARGETS: Readonly<Record<string, string>> = {
  google: "https://www.google.com",
  github: "https://github.com",
};

const OPEN_IN_BROWSER_PATTERNS = [
  /^(?:mở|mo)\s+(.+?)\s+bằng\s+browser companion$/i,
  /^open\s+(.+?)\s+in\s+browser companion$/i,
  /^open\s+(.+?)\s+with\s+browser companion$/i,
  /^(?:go to|visit|navigate to)\s+(.+?)\s+in\s+(?:the\s+)?browser(?: companion)?$/i,
] as const;

const FOCUS_BROWSER_PATTERNS = [
  /^(?:focus|show)\s+(?:the\s+)?browser companion$/i,
  /^(?:mở|mo)\s+browser companion$/i,
] as const;

const BACK_BROWSER_PATTERNS = [/^(?:go back|back)\s+in\s+(?:the\s+)?browser(?: companion)?$/i] as const;
const FORWARD_BROWSER_PATTERNS = [/^(?:go forward|forward)\s+in\s+(?:the\s+)?browser(?: companion)?$/i] as const;
const RELOAD_BROWSER_PATTERNS = [
  /^(?:reload|refresh)\s+(?:the\s+)?browser companion$/i,
  /^reload\s+the\s+current\s+browser\s+page$/i,
] as const;

export const BROWSER_SLASH_USAGE = [
  "Use /browser open <url>",
  "/browser navigate <url>",
  "/browser focus",
  "/browser back",
  "/browser forward",
  "/browser reload",
  "/browser click <selector>",
  "/browser type <selector> <text>",
  "/browser submit <selector>",
  "/browser scroll <up|down|top|bottom>",
  "/browser select <selector> <value>",
].join(", ");

export function isBrowserSlashCommand(text: string): boolean {
  return /^\/browser(?:\s|$)/i.test(text.trim());
}

export function parseBrowserSlashCommand(text: string): BrowserHostAction | undefined {
  const trimmed = text.trim();
  if (!isBrowserSlashCommand(trimmed)) {
    return undefined;
  }

  const tokens = tokenizeBrowserCommand(trimmed);
  const verb = tokens[1]?.toLowerCase();
  if (!verb) {
    return undefined;
  }

  if (verb === "open" || verb === "navigate") {
    const target = tokens.slice(2).join(" ").trim();
    const url = normalizeBrowserUrl(target);
    return url ? { name: verb === "open" ? "open" : "navigate", url } : undefined;
  }

  if (verb === "focus" || verb === "back" || verb === "forward" || verb === "reload") {
    return { name: verb };
  }

  if (verb === "click") {
    const selector = tokens[2]?.trim();
    return selector ? { name: "click", selector } : undefined;
  }

  if (verb === "type") {
    const selector = tokens[2]?.trim();
    const typedText = tokens.slice(3).join(" ").trim();
    return selector && typedText ? { name: "type", selector, text: typedText } : undefined;
  }

  if (verb === "submit") {
    const selector = tokens[2]?.trim();
    return selector ? { name: "submit", selector } : undefined;
  }

  if (verb === "scroll") {
    const target = tokens[2]?.trim().toLowerCase();
    return isBrowserScrollTarget(target) ? { name: "scroll", target } : undefined;
  }

  if (verb === "select") {
    const selector = tokens[2]?.trim();
    const value = tokens.slice(3).join(" ").trim();
    return selector && value ? { name: "select", selector, value } : undefined;
  }

  return undefined;
}

export function parseNaturalLanguageBrowserIntent(text: string): BrowserHostAction | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  for (const pattern of OPEN_IN_BROWSER_PATTERNS) {
    const target = trimmed.match(pattern)?.[1]?.trim();
    const url = normalizeBrowserUrl(target);
    if (url) {
      return { name: "open", url };
    }
  }

  if (matchesAnyPattern(trimmed, FOCUS_BROWSER_PATTERNS)) {
    return { name: "focus" };
  }
  if (matchesAnyPattern(trimmed, BACK_BROWSER_PATTERNS)) {
    return { name: "back" };
  }
  if (matchesAnyPattern(trimmed, FORWARD_BROWSER_PATTERNS)) {
    return { name: "forward" };
  }
  if (matchesAnyPattern(trimmed, RELOAD_BROWSER_PATTERNS)) {
    return { name: "reload" };
  }

  return undefined;
}

export function parseNaturalLanguageBrowserIntentSequence(
  text: string,
): BrowserHostActionSequence | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const compositeSearchMatch = trimmed.match(
    /^(?:mở|mo|open)\s+(?:trang\s+|page\s+|site\s+)?(.+?)\s+(?:rồi\s+|roi\s+|and\s+|then\s+)?(?:tìm|tim|search(?:\s+for)?)\s+(.+)$/i,
  );
  const rawTarget = compositeSearchMatch?.[1]?.trim();
  const rawQuery = compositeSearchMatch?.[2]?.trim();
  const url = normalizeBrowserUrl(rawTarget);
  const query = trimBrowserCompanionSuffix(rawQuery);
  if (!url || !query) {
    return undefined;
  }

  return buildBrowserSearchSequence(url, query);
}

export function parsePreferredBrowserWebIntent(
  text: string,
): BrowserHostActionSequence | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const composite = parseNaturalLanguageBrowserIntentSequence(trimmed);
  if (composite) {
    return composite;
  }

  const googleSearchMatch = trimmed.match(/^(?:tìm|tim|search(?:\s+for)?)\s+(.+?)\s+(?:trên|tren|on)\s+google$/i);
  const googleQuery = googleSearchMatch?.[1]?.trim();
  if (googleQuery) {
    return buildBrowserSearchSequence(COMMON_BROWSER_TARGETS.google ?? "https://www.google.com", googleQuery);
  }

  const directOpenMatch = trimmed.match(/^(?:mở|mo|open|visit|go to)\s+(?:trang\s+|page\s+|site\s+)?(.+)$/i);
  const directTarget = directOpenMatch?.[1]?.trim();
  const directUrl = normalizeBrowserUrl(directTarget);
  if (directUrl) {
    return {
      label: `Browser open ${directUrl}`,
      actions: [{ name: "open", url: directUrl }],
    };
  }

  return undefined;
}

export function normalizeBrowserUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const alias = COMMON_BROWSER_TARGETS[trimmed.toLowerCase()];
  if (alias) {
    return alias;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    return trimmed;
  }

  if (isLoopbackTarget(trimmed)) {
    return `http://${trimmed}`;
  }

  if (/^[\w.-]+\.[A-Za-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return undefined;
}

function tokenizeBrowserCommand(value: string): string[] {
  const tokens: string[] = [];
  const matcher = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  for (const match of value.matchAll(matcher)) {
    const token = match[1] ?? match[2] ?? match[3];
    if (!token) {
      continue;
    }
    tokens.push(token.replace(/\\(["'\\])/g, "$1"));
  }
  return tokens;
}

function isBrowserScrollTarget(value: string | undefined): value is BrowserScrollTarget {
  return value === "up" || value === "down" || value === "top" || value === "bottom";
}

function isLoopbackTarget(value: string): boolean {
  return /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(?::\d+)?(?:[/?#].*)?$/i.test(value);
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function trimBrowserCompanionSuffix(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed
    .replace(/\s+(?:bằng|bang|with|in)\s+browser companion$/i, "")
    .trim();
}

function searchFieldSelectorForUrl(_url: string): string {
  return "textarea[name='q'], input[name='q'], input[type='search'], input[type='text'], textarea";
}

function buildBrowserSearchSequence(url: string, query: string): BrowserHostActionSequence {
  const searchSelector = searchFieldSelectorForUrl(url);
  return {
    label: `Browser search ${url}`,
    actions: [
      { name: "open", url },
      { name: "type", selector: searchSelector, text: query },
      { name: "submit", selector: searchSelector },
    ],
  };
}
