import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const REMARK_PLUGINS = [remarkGfm];
const FENCE_MARKER_PATTERN = /^(```|~~~)/;
const LIST_MARKER_PATTERN = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/;
const UNICODE_BULLET_PATTERN = /^(\s*)•\s+/;
const BLOCK_BOUNDARY_PATTERN = /^\s*(?:>|#{1,6}\s|[-*_]{3,}\s*$|\|.*\||```|~~~)/;
const INLINE_LIST_AFTER_COLON_PATTERN = /:\s+((?:[-*+•]|\d+[.)])\s+)/;
const INLINE_LIST_ITEM_PATTERN = /\s+((?:[-*+•]|\d+[.)])\s+)/g;

const MARKDOWN_COMPONENTS = {
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const language = className?.replace(/^language-/, "");
    const code = String(children).replace(/\n$/, "");
    if (!className) {
      return <code>{code}</code>;
    }
    return (
      <pre data-language={language}>
        <code className={className}>{code}</code>
      </pre>
    );
  },
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
} as const;

export function MessageMarkdown({ text }: { readonly text: string }) {
  const normalizedText = normalizePseudoMarkdown(text);

  return (
    <div className="message__content">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
}

function normalizePseudoMarkdown(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result: string[] = [];
  let activeFenceMarker: "```" | "~~~" | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeInlineLists(normalizeBulletPrefix(lines[index] ?? ""));
    const trimmed = line.trim();

    if (FENCE_MARKER_PATTERN.test(trimmed)) {
      const marker = trimmed.startsWith("```") ? "```" : "~~~";
      activeFenceMarker = activeFenceMarker === marker ? null : (activeFenceMarker ?? marker);
      result.push(line);
      continue;
    }

    if (activeFenceMarker) {
      result.push(line);
      continue;
    }

    const previousLine = result[result.length - 1] ?? "";
    const nextLine = normalizeBulletPrefix(lines[index + 1] ?? "");
    const currentIsList = isListLine(line);

    if (currentIsList && shouldInsertBlankLineBeforeList(previousLine)) {
      result.push("");
    }

    result.push(line);

    if (currentIsList && shouldInsertBlankLineAfterList(nextLine)) {
      result.push("");
    }
  }

  return dedupeBlankLines(result).join("\n").trimEnd();
}

function normalizeBulletPrefix(line: string): string {
  return line.replace(UNICODE_BULLET_PATTERN, "$1- ");
}

function normalizeInlineLists(line: string): string {
  const expanded = line.replace(INLINE_LIST_AFTER_COLON_PATTERN, ":\n$1");
  if (expanded === line || !expanded.includes("\n")) {
    return expanded;
  }

  const [prefix, ...restParts] = expanded.split("\n");
  const rest = restParts.join("\n").replace(INLINE_LIST_ITEM_PATTERN, "\n$1");
  return `${prefix}\n${rest}`;
}

function isListLine(line: string): boolean {
  return LIST_MARKER_PATTERN.test(line);
}

function isBlockBoundary(line: string): boolean {
  return BLOCK_BOUNDARY_PATTERN.test(line);
}

function shouldInsertBlankLineBeforeList(previousLine: string): boolean {
  const trimmed = previousLine.trim();
  return trimmed.length > 0 && !isListLine(previousLine) && !isBlockBoundary(previousLine);
}

function shouldInsertBlankLineAfterList(nextLine: string): boolean {
  const trimmed = nextLine.trim();
  return trimmed.length > 0 && !isListLine(nextLine) && !isBlockBoundary(nextLine);
}

function dedupeBlankLines(lines: readonly string[]): string[] {
  const result: string[] = [];

  for (const line of lines) {
    const isBlank = line.trim().length === 0;
    const previousIsBlank = result[result.length - 1]?.trim().length === 0;
    if (isBlank && previousIsBlank) {
      continue;
    }
    result.push(line);
  }

  return result;
}
