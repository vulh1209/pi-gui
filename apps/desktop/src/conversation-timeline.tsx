import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefCallback, type RefObject } from "react";
import type { TranscriptMessage } from "./desktop-state";
import { ThreadSearchBar } from "./thread-search";
import { buildToolGroupId, isStructuredTimelineMessage, TimelineItem, TimelineToolCallGroup } from "./timeline-item";
import type { TimelineToolCall } from "./timeline-types";

const OVERSCAN_PX = 720;
const ROW_GAP_PX = 14;
const VIRTUALIZATION_THRESHOLD = 80;

interface ThreadSearchModel {
  readonly isOpen: boolean;
  readonly query: string;
  readonly matchCount: number;
  readonly activeIndex: number;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly search: (query: string) => void;
  readonly goToMatch: (direction: 1 | -1) => void;
  readonly close: () => void;
}

interface ConversationTimelineProps {
  readonly transcript: readonly TranscriptMessage[];
  readonly isTranscriptLoading: boolean;
  readonly timelinePaneRef: MutableRefObject<HTMLDivElement | null>;
  readonly timelinePaneElementRef?: RefCallback<HTMLDivElement>;
  readonly onTimelineScroll: () => void;
  readonly threadSearch: ThreadSearchModel;
  readonly showJumpToLatest: boolean;
  readonly onJumpToLatest: () => void;
  readonly onContentHeightChange: () => void;
}

type TimelineRow =
  | {
    readonly kind: "item";
    readonly id: string;
    readonly item: TranscriptMessage;
  }
  | {
    readonly kind: "tool-group";
    readonly id: string;
    readonly items: readonly TimelineToolCall[];
  };

export function ConversationTimeline({
  transcript,
  isTranscriptLoading,
  timelinePaneRef,
  timelinePaneElementRef,
  onTimelineScroll,
  threadSearch,
  showJumpToLatest,
  onJumpToLatest,
  onContentHeightChange,
}: ConversationTimelineProps) {
  const timelineRows = useMemo(() => buildTimelineRows(transcript), [transcript]);
  const shouldVirtualize = !threadSearch.isOpen && timelineRows.length > VIRTUALIZATION_THRESHOLD;
  const [expandedToolCallIds, setExpandedToolCallIds] = useState<Set<string>>(() => new Set());
  const [expandedToolGroupIds, setExpandedToolGroupIds] = useState<Set<string>>(() => new Set());
  const [expandedStructuredMessageIds, setExpandedStructuredMessageIds] = useState<Set<string>>(() => new Set());

  useLayoutEffect(() => {
    const availableToolCallIds = new Set(
      transcript.filter((item): item is Extract<TranscriptMessage, { kind: "tool" }> => item.kind === "tool").map((item) => item.callId),
    );
    setExpandedToolCallIds((current) => {
      if (current.size === 0) {
        return current;
      }
      let changed = false;
      const next = new Set<string>();
      for (const callId of current) {
        if (!availableToolCallIds.has(callId)) {
          changed = true;
          continue;
        }
        next.add(callId);
      }
      return changed ? next : current;
    });
  }, [transcript]);

  useLayoutEffect(() => {
    const availableStructuredMessageIds = new Set(
      transcript
        .filter(isStructuredTimelineMessage)
        .map((item) => item.id),
    );
    setExpandedStructuredMessageIds((current) => {
      if (current.size === 0) {
        return current;
      }
      let changed = false;
      const next = new Set<string>();
      for (const id of current) {
        if (!availableStructuredMessageIds.has(id)) {
          changed = true;
          continue;
        }
        next.add(id);
      }
      return changed ? next : current;
    });
  }, [transcript]);

  useLayoutEffect(() => {
    const availableToolGroupIds = new Set(
      timelineRows
        .filter((row): row is Extract<TimelineRow, { kind: "tool-group" }> => row.kind === "tool-group")
        .map((row) => row.id),
    );
    setExpandedToolGroupIds((current) => {
      if (current.size === 0) {
        return current;
      }
      let changed = false;
      const next = new Set<string>();
      for (const groupId of current) {
        if (!availableToolGroupIds.has(groupId)) {
          changed = true;
          continue;
        }
        next.add(groupId);
      }
      return changed ? next : current;
    });
  }, [timelineRows]);

  const toggleToolCall = useCallback((callId: string) => {
    setExpandedToolCallIds((current) => {
      const next = new Set(current);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  }, []);

  const toggleToolGroup = useCallback((groupId: string) => {
    setExpandedToolGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const toggleStructuredMessage = useCallback((messageId: string) => {
    setExpandedStructuredMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const assignTimelinePaneRef = useCallback((node: HTMLDivElement | null) => {
    timelinePaneRef.current = node;
    timelinePaneElementRef?.(node);
  }, [timelinePaneElementRef, timelinePaneRef]);

  return (
    <div
      className="timeline-pane timeline-pane--thread"
      data-testid="timeline-pane"
      ref={assignTimelinePaneRef}
      onScroll={onTimelineScroll}
    >
      {threadSearch.isOpen ? (
        <ThreadSearchBar
          query={threadSearch.query}
          matchCount={threadSearch.matchCount}
          activeIndex={threadSearch.activeIndex}
          inputRef={threadSearch.inputRef}
          onSearch={threadSearch.search}
          onNext={() => threadSearch.goToMatch(1)}
          onPrev={() => threadSearch.goToMatch(-1)}
          onClose={threadSearch.close}
        />
      ) : null}
      {isTranscriptLoading ? (
        <div className="timeline" data-testid="transcript">
          <div className="timeline-empty">Loading transcript…</div>
        </div>
      ) : transcript.length === 0 ? (
        <div className="timeline" data-testid="transcript">
          <div className="timeline-empty">Send a prompt to start the session.</div>
        </div>
      ) : shouldVirtualize ? (
        <VirtualizedTranscriptList
          rows={timelineRows}
          timelinePaneRef={timelinePaneRef}
          onContentHeightChange={onContentHeightChange}
          expandedToolGroupIds={expandedToolGroupIds}
          expandedToolCallIds={expandedToolCallIds}
          expandedStructuredMessageIds={expandedStructuredMessageIds}
          onToggleToolGroup={toggleToolGroup}
          onToggleToolCall={toggleToolCall}
          onToggleStructuredMessage={toggleStructuredMessage}
        />
      ) : (
        <div className="timeline" data-testid="transcript">
          {timelineRows.map((row) => (
            <TimelineRowItem
              row={row}
              key={row.id}
              expandedToolGroupIds={expandedToolGroupIds}
              expandedToolCallIds={expandedToolCallIds}
              expandedStructuredMessageIds={expandedStructuredMessageIds}
              onToggleToolGroup={toggleToolGroup}
              onToggleToolCall={toggleToolCall}
              onToggleStructuredMessage={toggleStructuredMessage}
            />
          ))}
        </div>
      )}
      {showJumpToLatest ? (
        <button className="timeline-jump" data-testid="timeline-jump" type="button" onClick={onJumpToLatest}>
          New activity below
        </button>
      ) : null}
    </div>
  );
}

function VirtualizedTranscriptList({
  rows,
  timelinePaneRef,
  onContentHeightChange,
  expandedToolGroupIds,
  expandedToolCallIds,
  expandedStructuredMessageIds,
  onToggleToolGroup,
  onToggleToolCall,
  onToggleStructuredMessage,
}: {
  readonly rows: readonly TimelineRow[];
  readonly timelinePaneRef: MutableRefObject<HTMLDivElement | null>;
  readonly onContentHeightChange: () => void;
  readonly expandedToolGroupIds: ReadonlySet<string>;
  readonly expandedToolCallIds: ReadonlySet<string>;
  readonly expandedStructuredMessageIds: ReadonlySet<string>;
  readonly onToggleToolGroup: (groupId: string) => void;
  readonly onToggleToolCall: (callId: string) => void;
  readonly onToggleStructuredMessage: (messageId: string) => void;
}) {
  const measuredHeightsRef = useRef(new Map<string, number>());
  const [, setMeasurementVersion] = useState(0);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });
  const previousTotalHeightRef = useRef(0);

  useLayoutEffect(() => {
    const knownIds = new Set(rows.map((row) => row.id));
    let removedAny = false;
    for (const id of measuredHeightsRef.current.keys()) {
      if (knownIds.has(id)) {
        continue;
      }
      measuredHeightsRef.current.delete(id);
      removedAny = true;
    }
    if (removedAny) {
      setMeasurementVersion((current) => current + 1);
    }
  }, [rows]);

  useLayoutEffect(() => {
    const pane = timelinePaneRef.current;
    if (!pane) {
      return undefined;
    }

    const syncViewport = () => {
      const nextScrollTop = pane.scrollTop;
      const nextHeight = pane.clientHeight;
      setViewport((current) =>
        current.scrollTop === nextScrollTop && current.height === nextHeight
          ? current
          : { scrollTop: nextScrollTop, height: nextHeight },
      );
    };

    syncViewport();
    pane.addEventListener("scroll", syncViewport, { passive: true });
    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });
    resizeObserver.observe(pane);

    return () => {
      pane.removeEventListener("scroll", syncViewport);
      resizeObserver.disconnect();
    };
  }, [timelinePaneRef]);

  const updateMeasuredHeight = useCallback((id: string, height: number) => {
    const nextHeight = Math.max(1, Math.ceil(height));
    const currentHeight = measuredHeightsRef.current.get(id);
    if (currentHeight === nextHeight) {
      return;
    }
    measuredHeightsRef.current.set(id, nextHeight);
    setMeasurementVersion((current) => current + 1);
  }, []);

  const rowHeights = rows.map((row) => measuredHeightsRef.current.get(row.id) ?? estimateTimelineRowHeight(row, expandedToolGroupIds, expandedStructuredMessageIds));
  const rowOffsets: number[] = [];
  let totalHeight = 0;
  for (const [index, rowHeight] of rowHeights.entries()) {
    rowOffsets[index] = totalHeight;
    totalHeight += rowHeight;
    if (index < rowHeights.length - 1) {
      totalHeight += ROW_GAP_PX;
    }
  }

  useLayoutEffect(() => {
    if (previousTotalHeightRef.current === totalHeight) {
      return;
    }
    previousTotalHeightRef.current = totalHeight;
    onContentHeightChange();
  }, [onContentHeightChange, totalHeight]);

  const startOffset = Math.max(0, viewport.scrollTop - OVERSCAN_PX);
  const endOffset = viewport.scrollTop + viewport.height + OVERSCAN_PX;
  const startIndex = findStartIndex(rowOffsets, rowHeights, startOffset);
  const endIndex = findEndIndex(rowOffsets, endOffset);

  return (
    <div className="timeline timeline--virtualized" data-testid="transcript" style={{ height: `${totalHeight}px` }}>
      {rows.slice(startIndex, endIndex).map((row, offsetIndex) => {
        const index = startIndex + offsetIndex;
        return (
          <MeasuredTimelineRow
            row={row}
            key={row.id}
            top={rowOffsets[index] ?? 0}
            onHeightChange={updateMeasuredHeight}
            expandedToolGroupIds={expandedToolGroupIds}
            expandedToolCallIds={expandedToolCallIds}
            expandedStructuredMessageIds={expandedStructuredMessageIds}
            onToggleToolGroup={onToggleToolGroup}
            onToggleToolCall={onToggleToolCall}
            onToggleStructuredMessage={onToggleStructuredMessage}
          />
        );
      })}
    </div>
  );
}

function MeasuredTimelineRow({
  row,
  top,
  onHeightChange,
  expandedToolGroupIds,
  expandedToolCallIds,
  expandedStructuredMessageIds,
  onToggleToolGroup,
  onToggleToolCall,
  onToggleStructuredMessage,
}: {
  readonly row: TimelineRow;
  readonly top: number;
  readonly onHeightChange: (id: string, height: number) => void;
  readonly expandedToolGroupIds: ReadonlySet<string>;
  readonly expandedToolCallIds: ReadonlySet<string>;
  readonly expandedStructuredMessageIds: ReadonlySet<string>;
  readonly onToggleToolGroup: (groupId: string) => void;
  readonly onToggleToolCall: (callId: string) => void;
  readonly onToggleStructuredMessage: (messageId: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = rowRef.current;
    if (!element) {
      return undefined;
    }

    const measure = () => {
      onHeightChange(row.id, element.getBoundingClientRect().height);
    };

    measure();
    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [onHeightChange, row.id]);

  return (
    <div className="timeline__virtual-row" ref={rowRef} style={{ transform: `translateY(${top}px)` }}>
      <TimelineRowItem
        row={row}
        expandedToolGroupIds={expandedToolGroupIds}
        expandedToolCallIds={expandedToolCallIds}
        expandedStructuredMessageIds={expandedStructuredMessageIds}
        onToggleToolGroup={onToggleToolGroup}
        onToggleToolCall={onToggleToolCall}
        onToggleStructuredMessage={onToggleStructuredMessage}
      />
    </div>
  );
}

function TimelineRowItem({
  row,
  expandedToolGroupIds,
  expandedToolCallIds,
  expandedStructuredMessageIds,
  onToggleToolGroup,
  onToggleToolCall,
  onToggleStructuredMessage,
}: {
  readonly row: TimelineRow;
  readonly expandedToolGroupIds: ReadonlySet<string>;
  readonly expandedToolCallIds: ReadonlySet<string>;
  readonly expandedStructuredMessageIds: ReadonlySet<string>;
  readonly onToggleToolGroup: (groupId: string) => void;
  readonly onToggleToolCall: (callId: string) => void;
  readonly onToggleStructuredMessage: (messageId: string) => void;
}) {
  if (row.kind === "tool-group") {
    return (
      <TimelineToolCallGroup
        items={row.items}
        expanded={expandedToolGroupIds.has(row.id)}
        expandedToolCallIds={expandedToolCallIds}
        onToggleGroup={onToggleToolGroup}
        onToggleToolCall={onToggleToolCall}
      />
    );
  }

  return (
    <TimelineItem
      item={row.item}
      expandedToolCallIds={expandedToolCallIds}
      expandedStructuredMessageIds={expandedStructuredMessageIds}
      onToggleToolCall={onToggleToolCall}
      onToggleStructuredMessage={onToggleStructuredMessage}
    />
  );
}

function buildTimelineRows(transcript: readonly TranscriptMessage[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let pendingTools: TimelineToolCall[] = [];

  const flushPendingTools = () => {
    if (pendingTools.length === 0) {
      return;
    }

    rows.push({
      kind: "tool-group",
      id: buildToolGroupId(pendingTools),
      items: pendingTools,
    });
    pendingTools = [];
  };

  for (const item of transcript) {
    if (item.kind === "tool") {
      pendingTools.push(item);
      continue;
    }

    flushPendingTools();
    rows.push({ kind: "item", id: item.id, item });
  }

  flushPendingTools();

  return rows;
}

function findStartIndex(offsets: readonly number[], heights: readonly number[], targetOffset: number): number {
  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const end = (offsets[mid] ?? 0) + (heights[mid] ?? 0);
    if (end < targetOffset) {
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }

  return Math.max(0, Math.min(offsets.length - 1, low));
}

function findEndIndex(offsets: readonly number[], targetOffset: number): number {
  if (offsets.length === 0) {
    return 0;
  }

  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if ((offsets[mid] ?? 0) <= targetOffset) {
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }

  const lastVisibleIndex = Math.max(0, low);
  return Math.min(offsets.length, Math.max(lastVisibleIndex + 1, 1));
}

function estimateTimelineRowHeight(
  row: TimelineRow,
  expandedToolGroupIds: ReadonlySet<string>,
  expandedStructuredMessageIds: ReadonlySet<string>,
): number {
  if (row.kind === "tool-group") {
    if (!expandedToolGroupIds.has(row.id)) {
      return 44;
    }
    return 52 + (row.items.length * 58) + ((row.items.length - 1) * 8);
  }

  return estimateTimelineItemHeight(row.item, expandedStructuredMessageIds);
}

function estimateTimelineItemHeight(item: TranscriptMessage, expandedStructuredMessageIds: ReadonlySet<string>): number {
  if (item.kind === "message") {
    if (isStructuredTimelineMessage(item) && !expandedStructuredMessageIds.has(item.id)) {
      return 48;
    }

    if (isStructuredTimelineMessage(item)) {
      const textLength = Math.max(item.text.length, 1);
      return 78 + Math.min(280, Math.ceil(textLength / 90) * 20);
    }

    const attachmentHeight = item.attachments?.some((attachment) => attachment.kind === "image")
      ? 120
      : item.attachments?.length
        ? 56
        : 0;
    const textLength = Math.max(item.text.length, 1);
    return 48 + attachmentHeight + Math.min(240, Math.ceil(textLength / 90) * 20);
  }
  if (item.kind === "tool") {
    return 52;
  }
  if (item.kind === "summary") {
    return item.presentation === "divider" ? 44 : 38;
  }
  return 38;
}
