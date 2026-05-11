import { useCallback, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLibrary } from "../hooks/useLibrary";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { EmptyState } from "./EmptyState";
import { ErrorPanel } from "./ErrorPanel";
import type { Track } from "../types";

const ROW_H = 36;

const COLUMNS: ColumnDef<Track>[] = [
  {
    accessorKey: "title",
    header: "Title",
    size: 280,
    cell: (info) => <span className="truncate">{info.getValue<string>()}</span>,
  },
  {
    accessorKey: "artist",
    header: "Artist",
    size: 180,
    cell: (info) => (
      <span className="truncate text-ink-secondary">{info.getValue<string | null>() ?? "—"}</span>
    ),
  },
  {
    accessorKey: "bpm",
    header: "BPM",
    size: 72,
    meta: { align: "right" },
    cell: (info) => {
      const v = info.getValue<number | null>();
      return v != null && v > 0 ? v.toFixed(1) : "—";
    },
  },
  {
    accessorKey: "musical_key",
    header: "Key",
    size: 60,
    meta: { align: "center" },
    cell: (info) => info.getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "duration_secs",
    header: "Time",
    size: 64,
    meta: { align: "right" },
    cell: (info) => {
      const s = info.getValue<number | null>();
      if (s == null) return "—";
      const m = Math.floor(s / 60);
      const ss = String(s % 60).padStart(2, "0");
      return `${m}:${ss}`;
    },
  },
  {
    accessorKey: "genre",
    header: "Genre",
    size: 130,
    cell: (info) => (
      <span className="truncate text-ink-secondary">{info.getValue<string | null>() ?? "—"}</span>
    ),
  },
];

interface Props {
  libraryPath: string;
  filter: string;
  selectedTrackId: string | null;
  onSelect: (track: Track) => void;
}

export function TrackTable({ libraryPath, filter, selectedTrackId, onSelect }: Props) {
  const { data: tracks = [], isLoading, error } = useLibrary(libraryPath);
  const [sorting, setSorting] = useState<SortingState>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false) ||
        (t.genre?.toLowerCase().includes(q) ?? false),
    );
  }, [tracks, filter]);

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_H,
    overscan: 20,
  });

  const moveSelection = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      const currentIdx = selectedTrackId
        ? rows.findIndex((r) => r.original.id === selectedTrackId)
        : -1;
      const nextIdx =
        currentIdx === -1
          ? delta > 0
            ? 0
            : rows.length - 1
          : Math.max(0, Math.min(rows.length - 1, currentIdx + delta));
      const target = rows[nextIdx];
      if (target) {
        onSelect(target.original);
        virtualizer.scrollToIndex(nextIdx, { align: "auto" });
      }
    },
    [rows, selectedTrackId, onSelect, virtualizer],
  );

  useKeyboardShortcuts(
    useMemo(
      () => [
        { key: "j", handler: () => moveSelection(1) },
        { key: "k", handler: () => moveSelection(-1) },
        { key: "arrowdown", handler: () => moveSelection(1) },
        { key: "arrowup", handler: () => moveSelection(-1) },
      ],
      [moveSelection],
    ),
  );

  const virtualItems = virtualizer.getVirtualItems();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-edge-strong border-t-accent-hover" />
      </div>
    );
  }

  if (error) {
    return <ErrorPanel title="Failed to load library" error={error} />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Column headers */}
      <div className="flex border-b border-edge bg-surface text-xs font-medium uppercase tracking-wider text-ink-muted select-none">
        {table.getFlatHeaders().map((header) => {
          const meta = header.column.columnDef.meta as { align?: string } | undefined;
          const align = meta?.align;
          const sorted = header.column.getIsSorted();
          return (
            <div
              key={header.id}
              style={{ width: header.getSize(), minWidth: header.getSize() }}
              className={[
                "flex cursor-pointer items-center gap-1 px-3 py-2 hover:text-ink-secondary",
                align === "right" ? "justify-end" : align === "center" ? "justify-center" : "",
              ].join(" ")}
              onClick={header.column.getToggleSortingHandler()}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : ""}
            </div>
          );
        })}
      </div>

      {/* Virtualized rows */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualItems.map((vItem) => {
            const row = rows[vItem.index];
            return (
              <div
                key={row.id}
                data-index={vItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  transform: `translateY(${vItem.start}px)`,
                  height: ROW_H,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                }}
                className={[
                  "cursor-pointer border-b border-edge/50 text-sm",
                  row.original.id === selectedTrackId
                    ? "bg-accent-dim/40 hover:bg-accent-dim/50"
                    : "hover:bg-elevated/60",
                ].join(" ")}
                onClick={() => onSelect(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { align?: string } | undefined;
                  const align = meta?.align;
                  return (
                    <div
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                        overflow: "hidden",
                      }}
                      className={[
                        "px-3",
                        align === "right"
                          ? "text-right font-mono tabular-nums text-[13px]"
                          : align === "center"
                            ? "text-center font-mono tabular-nums text-[13px]"
                            : "",
                      ].join(" ")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {rows.length === 0 && (
          <EmptyState
            icon={
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
                <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
              </svg>
            }
            title={filter ? "No tracks match your filter" : "Library is empty"}
            description={
              filter
                ? `Nothing in this library matches "${filter}". Try a shorter or different query.`
                : "Your Rekordbox library exists, but no tracks were found. Add tracks in Rekordbox and re-open this app."
            }
          />
        )}
      </div>
    </div>
  );
}
