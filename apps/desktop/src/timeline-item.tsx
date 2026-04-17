import type { SessionTranscriptMessage } from "@pi-gui/pi-sdk-driver";
import type { TimelineActivity, TimelineToolCall, TimelineSummary, TranscriptMessage } from "./timeline-types";
import { MessageMarkdown } from "./message-markdown";
import { InlineDiff, extractDiffFromOutput } from "./diff-inline";
import { ChevronRightIcon, CopyIcon, FileIcon } from "./icons";

const STRUCTURED_USER_BRIEF_KEYWORDS = [
  "file plan",
  "prompt ready-to-paste",
  "worktree phải dùng",
  "branch hiện tại",
  "lưu ý quan trọng",
  "đã chuẩn bị prompt tại",
  "session chat khác phải chạy",
  "critical execution rules",
  "first read these files",
] as const;

export function TimelineItem({
  item,
  expandedToolCallIds,
  expandedStructuredMessageIds,
  onToggleToolCall,
  onToggleStructuredMessage,
}: {
  readonly item: TranscriptMessage;
  readonly expandedToolCallIds?: ReadonlySet<string>;
  readonly expandedStructuredMessageIds?: ReadonlySet<string>;
  readonly onToggleToolCall?: (callId: string) => void;
  readonly onToggleStructuredMessage?: (messageId: string) => void;
}) {
  switch (item.kind) {
    case "message":
      return (
        <TimelineMessage
          item={item}
          expandedStructuredMessageIds={expandedStructuredMessageIds}
          onToggleStructuredMessage={onToggleStructuredMessage}
        />
      );
    case "activity":
      return <TimelineActivityItem item={item} />;
    case "tool":
      return (
        <TimelineToolCallItem
          item={item}
          expanded={expandedToolCallIds?.has(item.callId) ?? false}
          onToggle={onToggleToolCall}
        />
      );
    case "summary":
      return <TimelineSummaryItem item={item} />;
    default:
      return null;
  }
}

export function TimelineToolCallGroup({
  items,
  expanded,
  expandedToolCallIds,
  onToggleGroup,
  onToggleToolCall,
}: {
  readonly items: readonly TimelineToolCall[];
  readonly expanded: boolean;
  readonly expandedToolCallIds?: ReadonlySet<string>;
  readonly onToggleGroup?: (groupId: string) => void;
  readonly onToggleToolCall?: (callId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  const groupId = buildToolGroupId(items);
  const groupStatus = summarizeToolGroupStatus(items);

  return (
    <article className={`timeline-tool-group timeline-tool-group--${groupStatus}`} data-testid="timeline-tool-group">
      <button
        className="timeline-tool-group__header"
        data-testid="timeline-tool-group-toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggleGroup?.(groupId)}
      >
        <span className={`timeline-tool-group__chevron ${expanded ? "timeline-tool-group__chevron--expanded" : ""}`}>
          <ChevronRightIcon />
        </span>
        <span className="timeline-tool-group__label">{buildToolGroupLabel(items)}</span>
        <span className="timeline-tool-group__meta">{buildToolGroupMeta(items, groupStatus)}</span>
      </button>
      {expanded ? (
        <div className="timeline-tool-group__body">
          {items.map((toolCall) => (
            <TimelineToolCallItem
              item={toolCall}
              key={toolCall.id}
              expanded={expandedToolCallIds?.has(toolCall.callId) ?? false}
              onToggle={onToggleToolCall}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TimelineMessage({
  item,
  expandedStructuredMessageIds,
  onToggleStructuredMessage,
}: {
  readonly item: SessionTranscriptMessage;
  readonly expandedStructuredMessageIds?: ReadonlySet<string>;
  readonly onToggleStructuredMessage?: (messageId: string) => void;
}) {
  if (item.role === "user") {
    if (isStructuredUserBrief(item.text)) {
      const expanded = expandedStructuredMessageIds?.has(item.id) ?? false;
      return (
        <TimelineStructuredMessage
          expanded={expanded}
          item={item}
          label="Handoff brief"
          meta={buildStructuredMessageMeta(item.text, "section")}
          preview={buildStructuredMessagePreview(item.text, "Open handoff")}
          onToggle={onToggleStructuredMessage}
        />
      );
    }

    return (
      <article className="timeline-item timeline-item--user">
        <div className="timeline-item__bubble">
          {item.attachments?.length ? (
            <div className="timeline-item__attachments">
              {item.attachments.map((attachment, index) =>
                attachment.kind === "image" ? (
                  <img
                    alt={attachment.name ?? `Attachment ${index + 1}`}
                    className="timeline-item__attachment timeline-item__attachment--image"
                    key={`${item.id}:${index}`}
                    src={`data:${attachment.mimeType};base64,${attachment.data}`}
                  />
                ) : (
                  <div
                    className="timeline-item__attachment timeline-item__attachment--file"
                    key={`${item.id}:${index}`}
                    title={attachment.fsPath}
                  >
                    <span className="timeline-item__attachment-icon" aria-hidden="true">
                      <FileIcon />
                    </span>
                    <span className="timeline-item__attachment-name">{attachment.name}</span>
                  </div>
                ),
              )}
            </div>
          ) : null}
          <MessageMarkdown text={item.text} />
        </div>
      </article>
    );
  }

  if (item.role === "branchSummary" || item.role === "compactionSummary") {
    const expanded = expandedStructuredMessageIds?.has(item.id) ?? false;
    return (
      <TimelineStructuredMessage
        expanded={expanded}
        item={item}
        label={item.role === "branchSummary" ? "Branch summary" : "Compaction summary"}
        meta={buildStructuredMessageMeta(item.text, "item")}
        preview={buildStructuredMessagePreview(item.text, "View summary")}
        onToggle={onToggleStructuredMessage}
      />
    );
  }

  return (
    <article className="timeline-item timeline-item--assistant">
      <MessageMarkdown text={item.text} />
    </article>
  );
}

function TimelineStructuredMessage({
  item,
  expanded,
  label,
  preview,
  meta,
  onToggle,
}: {
  readonly item: SessionTranscriptMessage;
  readonly expanded: boolean;
  readonly label: string;
  readonly preview: string;
  readonly meta: string;
  readonly onToggle?: (messageId: string) => void;
}) {
  return (
    <article className="timeline-summary-message" data-testid="timeline-summary-message">
      <button
        className="timeline-summary-message__header"
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggle?.(item.id)}
      >
        <span className={`timeline-summary-message__chevron ${expanded ? "timeline-summary-message__chevron--expanded" : ""}`}>
          <ChevronRightIcon />
        </span>
        <span className="timeline-summary-message__label">{label}</span>
        <span className="timeline-summary-message__preview">{preview}</span>
        <span className="timeline-summary-message__meta">{meta}</span>
      </button>
      {expanded ? (
        <div className="timeline-summary-message__body">
          <MessageMarkdown text={item.text} />
        </div>
      ) : null}
    </article>
  );
}

function buildStructuredMessagePreview(text: string, emptyLabel: string): string {
  const pathMatch = text.match(/([\w./-]+\.[a-z0-9]+)/i);
  if (pathMatch?.[1]) {
    return shortenPath(pathMatch[1]);
  }

  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return emptyLabel;
  }

  const normalized = firstLine
    .replace(/^#+\s*/, "")
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();

  if (normalized.length <= 52) {
    return normalized;
  }

  return `${normalized.slice(0, 51)}…`;
}

function buildStructuredMessageMeta(text: string, preferredUnit: "item" | "section"): string {
  const sectionCount = countStructuredSections(text);
  if (preferredUnit === "section" && sectionCount > 0) {
    return `${sectionCount} section${sectionCount === 1 ? "" : "s"}`;
  }

  const itemCount = text
    .split("\n")
    .filter((line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line))
    .length;

  if (itemCount > 0) {
    return `${itemCount} item${itemCount === 1 ? "" : "s"}`;
  }

  if (sectionCount > 0) {
    return `${sectionCount} section${sectionCount === 1 ? "" : "s"}`;
  }

  const lineCount = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .length;

  return `${lineCount} line${lineCount === 1 ? "" : "s"}`;
}

function countStructuredSections(text: string): number {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      Boolean(line)
      && !/^[-*+]/.test(line)
      && !/^\d+[.)]\s+/.test(line)
      && !/^```/.test(line)
      && (/[:：]$/.test(line) || /^(?:file plan|file prompt|worktree phải dùng|branch hiện tại|lưu ý quan trọng|prompt ready-to-paste)$/i.test(line)),
    )
    .length;
}

export function isStructuredUserBrief(text: string): boolean {
  const normalized = text.toLowerCase();
  const keywordMatches = STRUCTURED_USER_BRIEF_KEYWORDS.filter((keyword) => normalized.includes(keyword)).length;
  if (keywordMatches === 0) {
    return false;
  }

  let signalCount = 0;
  if (text.length > 500) {
    signalCount += 1;
  }
  if (text.split("\n").filter((line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)).length >= 3) {
    signalCount += 1;
  }
  if (text.includes("```")) {
    signalCount += 1;
  }
  if (/\.md\b|\/Users\/|docs\//.test(text)) {
    signalCount += 1;
  }
  if (countStructuredSections(text) >= 3) {
    signalCount += 1;
  }

  return signalCount >= 2;
}

export function isStructuredTimelineMessage(item: TranscriptMessage): boolean {
  return item.kind === "message"
    && (
      item.role === "branchSummary"
      || item.role === "compactionSummary"
      || (item.role === "user" && isStructuredUserBrief(item.text))
    );
}

function TimelineActivityItem({ item }: { readonly item: TimelineActivity }) {
  return (
    <div className={`timeline-activity timeline-activity--${item.tone ?? "neutral"}`}>
      <span className="timeline-activity__label">{item.label}</span>
      {item.detail ? <span className="timeline-activity__detail">{item.detail}</span> : null}
      {item.metadata ? <span className="timeline-activity__meta">{item.metadata}</span> : null}
    </div>
  );
}

function TimelineToolCallItem({
  item,
  expanded,
  onToggle,
}: {
  readonly item: TimelineToolCall;
  readonly expanded: boolean;
  readonly onToggle?: (callId: string) => void;
}) {
  const hasContent = item.input !== undefined || item.output !== undefined;
  const isBrowserTool = item.toolName === "browser";
  const diffText = isWriteTool(item.toolName) ? extractDiffFromOutput(item.output) : undefined;
  const diffStats = diffText ? countDiffStats(diffText) : undefined;
  const compactLabel = buildCompactLabel(item, diffStats);

  const handleCopy = () => {
    const text = diffText ?? formatToolContent(item.input, item.output);
    void navigator.clipboard.writeText(text);
  };

  return (
    <article className={`timeline-tool timeline-tool--${item.status}${isBrowserTool ? " timeline-tool--browser" : ""}`}>
      <button
        className="timeline-tool__header"
        type="button"
        aria-expanded={expanded}
        disabled={!hasContent}
        onClick={() => onToggle?.(item.callId)}
      >
        {hasContent ? (
          <span className={`timeline-tool__chevron ${expanded ? "timeline-tool__chevron--expanded" : ""}`}>
            <ChevronRightIcon />
          </span>
        ) : null}
        <span className="timeline-tool__summary">
          {isBrowserTool ? <span className="timeline-tool__eyebrow">Browser action</span> : null}
          <span className="timeline-tool__label">{compactLabel}</span>
          {item.detail ? (
            <span className="timeline-tool__detail-inline" title={item.detail}>{item.detail}</span>
          ) : null}
        </span>
        {diffStats ? (
          <span className="timeline-tool__diff-stats">
            <span className="timeline-tool__stat-add">+{diffStats.added}</span>
            {" "}
            <span className="timeline-tool__stat-del">-{diffStats.removed}</span>
          </span>
        ) : null}
        <span className="timeline-tool__meta-inline">{`${item.toolName} \u00b7 ${statusLabel(item.status)}`}</span>
      </button>
      {expanded && hasContent ? (
        <div className="timeline-tool__body">
          {diffText ? (
            <>
              <div className="timeline-tool__diff-header">
                <span className="timeline-tool__diff-filename">
                  {extractFilename(item.input)}
                  {diffStats ? (
                    <span className="timeline-tool__diff-stats">
                      {" "}<span className="timeline-tool__stat-add">+{diffStats.added}</span>
                      {" "}<span className="timeline-tool__stat-del">-{diffStats.removed}</span>
                    </span>
                  ) : null}
                </span>
                <button className="icon-button timeline-tool__copy" type="button" onClick={handleCopy} aria-label="Copy">
                  <CopyIcon />
                </button>
              </div>
              <InlineDiff diff={diffText} />
            </>
          ) : (
            <>
              <div className="timeline-tool__body-actions">
                <button className="icon-button timeline-tool__copy" type="button" onClick={handleCopy} aria-label="Copy">
                  <CopyIcon />
                </button>
              </div>
              <pre className="timeline-tool__pre">{formatToolContent(item.input, item.output)}</pre>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function buildToolGroupId(items: readonly TimelineToolCall[]): string {
  return items[0] ? `tool-group:${items[0].callId}` : "tool-group:empty";
}

function summarizeToolGroupStatus(items: readonly TimelineToolCall[]): "running" | "success" | "error" {
  if (items.some((item) => item.status === "running")) {
    return "running";
  }
  if (items.some((item) => item.status === "error")) {
    return "error";
  }
  return "success";
}

function buildToolGroupLabel(items: readonly TimelineToolCall[]): string {
  if (items.length === 1) {
    return items[0]?.label ?? "1 tool call";
  }
  return `${items.length} tool calls`;
}

function buildToolGroupMeta(
  items: readonly TimelineToolCall[],
  status: "running" | "success" | "error",
): string {
  const uniqueToolNames = [...new Set(items.map((item) => item.toolName).filter(Boolean))];
  const preview = uniqueToolNames.slice(0, 3).join(", ");
  const overflowCount = Math.max(0, uniqueToolNames.length - 3);
  const previewLabel = overflowCount > 0 ? `${preview} +${overflowCount}` : preview;
  return previewLabel ? `${previewLabel} · ${statusLabel(status)}` : statusLabel(status);
}

function isWriteTool(toolName: string): boolean {
  return /write|edit|patch|apply/i.test(toolName);
}

function buildCompactLabel(item: TimelineToolCall, diffStats: { added: number; removed: number } | undefined): string {
  if (isWriteTool(item.toolName)) {
    const filename = extractFilename(item.input);
    if (filename) {
      return `Edited ${shortenPath(filename)}`;
    }
  }
  return item.label;
}

function extractFilename(input: unknown): string {
  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    const path = record.file_path ?? record.filePath ?? record.path ?? record.filename;
    if (typeof path === "string") {
      return path;
    }
  }
  return "";
}

function shortenPath(filePath: string): string {
  // Show last 2-3 path segments for readability
  const parts = filePath.split("/");
  if (parts.length <= 3) {
    return filePath;
  }
  return parts.slice(-3).join("/");
}

function countDiffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      added += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removed += 1;
    }
  }
  return { added, removed };
}

function formatToolContent(input: unknown, output: unknown): string {
  const parts: string[] = [];
  if (input !== undefined) {
    parts.push(typeof input === "string" ? input : JSON.stringify(input, null, 2));
  }
  if (output !== undefined) {
    parts.push(typeof output === "string" ? output : JSON.stringify(output, null, 2));
  }
  return parts.join("\n\n");
}

function statusLabel(status: "running" | "success" | "error") {
  if (status === "running") return "running";
  if (status === "success") return "done";
  return "failed";
}

function TimelineSummaryItem({ item }: { readonly item: TimelineSummary }) {
  if (item.presentation === "divider") {
    return (
      <div className="timeline-summary">
        <span>{item.label}</span>
        {item.metadata ? <span className="timeline-summary__meta">{item.metadata}</span> : null}
      </div>
    );
  }

  return (
    <div className="timeline-activity timeline-activity--summary">
      <span className="timeline-activity__label">{item.label}</span>
      {item.metadata ? <span className="timeline-activity__meta">{item.metadata}</span> : null}
    </div>
  );
}
