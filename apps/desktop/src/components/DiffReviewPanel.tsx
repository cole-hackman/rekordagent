import { useState, useMemo } from "react";
import type { StagedChange, ChangeStatus } from "../agent/types";
import { useStagedChanges } from "../hooks/useStagedChanges";

interface Props {
  libraryPath: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<StagedChange["status"], string> = {
  Proposed: "Proposed",
  Accepted: "Accepted",
  Rejected: "Rejected",
  Exported: "Exported",
};

export function DiffReviewPanel({ libraryPath, onClose }: Props) {
  const {
    data: changes = [],
    isLoading,
    error,
    acceptChange,
    rejectChange,
    acceptAllSafe,
    rejectAll,
    exportAcceptedChanges,
    exportResult,
    isMutating,
  } = useStagedChanges(libraryPath);
  const counts = countByStatus(changes);
  const proposedCount = counts.Proposed ?? 0;
  const acceptedCount = counts.Accepted ?? 0;

  const [filterStatus, setFilterStatus] = useState<ChangeStatus | "All">("Proposed");

  const filteredChanges = useMemo(() => {
    return changes.filter(c => filterStatus === "All" || c.status === filterStatus);
  }, [changes, filterStatus]);

  const { groups, noTarget } = useMemo(() => {
    const groups: Record<string, StagedChange[]> = {};
    const noTarget: StagedChange[] = [];
    
    for (const change of filteredChanges) {
      if (!change.target_id) {
        noTarget.push(change);
      } else {
        if (!groups[change.target_id]) groups[change.target_id] = [];
        groups[change.target_id].push(change);
      }
    }
    return { groups, noTarget };
  }, [filteredChanges]);

  return (
    <aside className="flex h-full w-[28rem] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Review changes</h2>
          <div className="mt-1 flex gap-2 text-[11px] text-zinc-500">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "All" : status as ChangeStatus)}
                className={`transition-colors hover:text-zinc-300 ${
                  filterStatus === status ? "text-indigo-400 font-medium" : ""
                }`}
              >
                {label}: {counts[status as ChangeStatus] ?? 0}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close change review"
          className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <path d="M3.22 3.22a.75.75 0 011.06 0L8 6.94l3.72-3.72a.75.75 0 111.06 1.06L9.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 px-4 py-2">
        <button
          onClick={() => acceptAllSafe()}
          disabled={isMutating || proposedCount === 0}
          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-emerald-600 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Accept safe
        </button>
        <button
          onClick={() => rejectAll()}
          disabled={isMutating || proposedCount === 0}
          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-red-700 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject proposed
        </button>
        <button
          onClick={() => exportAcceptedChanges()}
          disabled={isMutating || acceptedCount === 0}
          className="ml-auto rounded-md bg-indigo-600 px-2 py-1 text-xs text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export XML
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {exportResult && (
          <div className="mb-3 rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
            Exported {exportResult.exported_count} changes to{" "}
            {exportResult.output_path}
          </div>
        )}

        {isLoading && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border border-zinc-700 border-t-indigo-400" />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">
            {error.message}
          </div>
        )}

        {!isLoading && !error && filteredChanges.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-zinc-800 px-6 text-center">
            <p className="text-sm font-medium text-zinc-300">No {filterStatus !== "All" ? filterStatus.toLowerCase() : "proposed"} changes</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Ask the agent to audit your library, or manually edit track metadata.<br/>
              Changes will appear here for you to review and export.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(groups).map(([targetId, groupChanges]) => (
            <div key={targetId} className="space-y-2">
              <div className="sticky top-0 z-10 bg-zinc-950/90 py-1 backdrop-blur">
                <h3 className="text-xs font-semibold text-zinc-400">Target: {targetId}</h3>
              </div>
              <div className="space-y-2">
                {groupChanges.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    onAccept={() => acceptChange(change.id)}
                    onReject={() => rejectChange(change.id)}
                    disabled={isMutating}
                  />
                ))}
              </div>
            </div>
          ))}

          {noTarget.length > 0 && (
            <div className="space-y-2">
              <div className="sticky top-0 z-10 bg-zinc-950/90 py-1 backdrop-blur">
                <h3 className="text-xs font-semibold text-zinc-400">Global</h3>
              </div>
              <div className="space-y-2">
                {noTarget.map((change) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    onAccept={() => acceptChange(change.id)}
                    onReject={() => rejectChange(change.id)}
                    disabled={isMutating}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function ChangeCard({
  change,
  onAccept,
  onReject,
  disabled,
}: {
  change: StagedChange;
  onAccept: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const canReview = change.status === "Proposed";
  return (
    <article className="rounded-md border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-100">
            {change.field ?? formatKind(change.kind)}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {formatKind(change.kind)}
            {change.target_id ? ` · ${change.target_id}` : ""}
          </div>
        </div>
        <span className={statusClass(change.status)}>
          {STATUS_LABELS[change.status]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <ValueBox label="Old" value={change.old_value} />
        <ValueBox label="New" value={change.new_value} highlight />
      </div>

      {(change.reason || change.confidence !== null) && (
        <div className="mt-3 text-xs leading-relaxed text-zinc-400">
          {change.reason}
          {change.confidence !== null && (
            <span className="text-zinc-600">
              {change.reason ? " · " : ""}
              {Math.round(change.confidence * 100)}% confidence
            </span>
          )}
        </div>
      )}

      {canReview && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onReject}
            disabled={disabled}
            className="rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-300 disabled:opacity-40"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            disabled={disabled}
            className="rounded-md bg-emerald-700 px-2 py-1 text-xs text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
          >
            Accept
          </button>
        </div>
      )}
    </article>
  );
}

function ValueBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: unknown;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5">
      <div className="mb-1 text-[10px] uppercase text-zinc-600">{label}</div>
      <div
        className={`truncate font-mono ${highlight ? "text-emerald-300" : "text-zinc-300"}`}
        title={formatValue(value)}
      >
        {formatValue(value)}
      </div>
    </div>
  );
}

function countByStatus(changes: StagedChange[]) {
  return changes.reduce<Partial<Record<StagedChange["status"], number>>>(
    (acc, change) => {
      acc[change.status] = (acc[change.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "Empty";
  if (typeof value === "string") return value || "Empty";
  return JSON.stringify(value);
}

function formatKind(kind: string): string {
  return kind.replace(/([A-Z])/g, " $1").trim();
}

function statusClass(status: StagedChange["status"]): string {
  const base = "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium";
  if (status === "Accepted") return `${base} bg-emerald-950 text-emerald-300`;
  if (status === "Rejected") return `${base} bg-red-950 text-red-300`;
  if (status === "Exported") return `${base} bg-indigo-950 text-indigo-300`;
  return `${base} bg-zinc-800 text-zinc-300`;
}
