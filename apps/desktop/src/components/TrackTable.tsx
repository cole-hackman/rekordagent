import { useRef, useMemo, useState } from "react";
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
      <span className="truncate text-zinc-400">{info.getValue<string | null>() ?? "—"}</span>
    ),
  },
  {
    accessorKey: "bpm",
    header: "BPM",
    size: 72,
    meta: { align: "right" },
    cell: (info) => {
      const v = info.getValue<number | null>();
      return v != null ? v.toFixed(1) : "—";
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
      <span className="truncate text-zinc-400">{info.getValue<string | null>() ?? "—"}</span>
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

  const virtualItems = virtualizer.getVirtualItems();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-red-400">
        Failed to load library: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Column headers */}
      <div className="flex border-b border-zinc-800 bg-zinc-900 text-xs font-medium uppercase tracking-wider text-zinc-500 select-none">
        {table.getFlatHeaders().map((header) => {
          const meta = header.column.columnDef.meta as { align?: string } | undefined;
          const align = meta?.align;
          const sorted = header.column.getIsSorted();
          return (
            <div
              key={header.id}
              style={{ width: header.getSize(), minWidth: header.getSize() }}
              className={[
                "flex cursor-pointer items-center gap-1 px-3 py-2 hover:text-zinc-300",
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
                  "cursor-pointer border-b border-zinc-800/50 text-sm",
                  row.original.id === selectedTrackId
                    ? "bg-indigo-900/40 hover:bg-indigo-900/50"
                    : "hover:bg-zinc-800/60",
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
                          ? "text-right tabular-nums"
                          : align === "center"
                            ? "text-center"
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
          <p className="p-6 text-center text-sm text-zinc-500">No tracks found.</p>
        )}
      </div>
    </div>
  );
}
