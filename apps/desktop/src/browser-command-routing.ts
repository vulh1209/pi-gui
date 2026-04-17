export type BrowserHostActionName = "open" | "focus" | "navigate" | "back" | "forward" | "reload";

export interface BrowserHostAction {
  readonly name: BrowserHostActionName;
  readonly url?: string;
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
  /^(?:focus|show)\s+(?:the\s+)?browser(?: companion)?$/i,
  /^(?:mở|mo)\s+browser companion$/i,
] as const;

const BACK_BROWSER_PATTERNS = [/^(?:go back|back)(?:\s+in\s+(?:the\s+)?browser(?: companion)?)?$/i] as const;
const FORWARD_BROWSER_PATTERNS = [/^(?:go forward|forward)(?:\s+in\s+(?:the\s+)?browser(?: companion)?)?$/i] as const;
const RELOAD_BROWSER_PATTERNS = [
  /^(?:reload|refresh)(?:\s+(?:the\s+)?browser(?: companion)?)?$/i,
  /^reload\s+the\s+current\s+browser\s+page$/i,
] as const;

export const BROWSER_SLASH_USAGE =
  "Use /browser open <url>, /browser navigate <url>, /browser focus, /browser back, /browser forward, or /browser reload.";

export function isBrowserSlashCommand(text: string): boolean {
  return /^\/browser(?:\s|$)/i.test(text.trim());
}

export function parseBrowserSlashCommand(text: string): BrowserHostAction | undefined {
  const trimmed = text.trim();
  if (!isBrowserSlashCommand(trimmed)) {
    return undefined;
  }

  const [, rawVerb, ...rest] = trimmed.split(/\s+/);
  const verb = rawVerb?.toLowerCase();
  if (!verb) {
    return undefined;
  }

  if (verb === "open" || verb === "navigate") {
    const target = rest.join(" ").trim();
    const url = normalizeBrowserUrl(target);
    return url
      ? {
          name: verb === "open" ? "open" : "navigate",
          url,
        }
      : undefined;
  }

  if (verb === "focus" || verb === "back" || verb === "forward" || verb === "reload") {
    return { name: verb };
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

function isLoopbackTarget(value: string): boolean {
  return /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0)(?::\d+)?(?:[/?#].*)?$/i.test(value);
}

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}
