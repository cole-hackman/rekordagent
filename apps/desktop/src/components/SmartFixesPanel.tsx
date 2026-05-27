import { useCallback, useState } from "react";
import {
  SMART_FIX_NAMES,
  smartFixApply,
  smartFixPreview,
  type FixProposal,
  type SmartFixName,
} from "../ipc";
import { useToast } from "./Toast";

interface Props {
  libraryPath: string;
  onGoToSync?: () => void;
}

const FIX_LABELS: Record<SmartFixName, string> = {
  fix_casing: "Fix Casing",
  replace_with_space: "Replace _ / \\ | with Space",
  fix_encoded_chars: "Fix Encoded Characters",
  extract_artist: "Extract Artist from Title",
  extract_remixer: "Extract Remixer",
  remove_garbage: "Remove Garbage Characters",
  remove_promo: "Remove Promotional Text",
  remove_number_prefix: "Remove Number Prefix",
  remove_urls: "Remove URLs",
  add_mix_parens: "Add Mix Parentheses",
  remove_common_text: "Remove Common Text",
};

const FIX_DESCRIPTIONS: Record<SmartFixName, string> = {
  fix_casing: "ALL CAPS or all lowercase → Title Case (with small-word handling).",
  replace_with_space: "Underscores, slashes, pipes → spaces; collapses runs of whitespace.",
  fix_encoded_chars: "&amp;/&#39; → plain text; mojibake quotes/dashes restored.",
  extract_artist: "Title like 'Artist - Title' with empty Artist → split into both fields.",
  extract_remixer: "Strip the (Artist Remix) parenthetical from the Title.",
  remove_garbage: "Strip control chars, zero-width spaces, replacement chars; collapse !!! → !.",
  remove_promo: "Remove 'Free Download', '[FREE]', 'Out Now', 'Exclusive', etc.",
  remove_number_prefix: "Strip leading '01. ', '1 - ', etc. from titles.",
  remove_urls: "Strip http://, https://, www., bare domains, and emails.",
  add_mix_parens: "'Song Original Mix' → 'Song (Original Mix)'.",
  remove_common_text: "Strip user-defined boilerplate ('(Official Audio)', 'HD', etc.).",
};

export function SmartFixesPanel({ libraryPath, onGoToSync }: Props) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<SmartFixName | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Smart Fixes</h2>
        {onGoToSync && (
          <button
            onClick={onGoToSync}
            className="rounded bg-elevated px-3 py-1 text-sm text-ink hover:bg-edge"
          >
            Review & Sync →
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {SMART_FIX_NAMES.map((name) => (
          <FixCard
            key={name}
            name={name}
            libraryPath={libraryPath}
            isOpen={expanded === name}
            onToggle={() => setExpanded((cur) => (cur === name ? null : name))}
            onStaged={(count) => {
              toast({
                variant: "success",
                message: `Staged ${count} proposal(s).`,
                detail: "Review and apply in the Sync panel.",
                action: onGoToSync
                  ? { label: "Review & Sync", onClick: onGoToSync }
                  : undefined,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  name: SmartFixName;
  libraryPath: string;
  isOpen: boolean;
  onToggle: () => void;
  onStaged: (count: number) => void;
}

function FixCard({ name, libraryPath, isOpen, onToggle, onStaged }: CardProps) {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<FixProposal[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);

  const includedCount =
    proposals?.filter((p) => !excluded.has(p.id)).length ?? 0;

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const rows = await smartFixPreview(libraryPath, name);
      setProposals(rows);
      setExcluded(new Set());
    } catch (e) {
      toast({ variant: "error", message: "Scan failed", detail: String(e) });
    } finally {
      setScanning(false);
    }
  }, [libraryPath, name, toast]);

  const apply = useCallback(async () => {
    if (!proposals || includedCount === 0) return;
    setApplying(true);
    try {
      const keep = proposals.filter((p) => !excluded.has(p.id)).map((p) => p.id);
      const staged = await smartFixApply(libraryPath, name, keep);
      onStaged(staged);
      setProposals(null);
    } catch (e) {
      toast({ variant: "error", message: "Apply failed", detail: String(e) });
    } finally {
      setApplying(false);
    }
  }, [proposals, excluded, includedCount, libraryPath, name, onStaged, toast]);

  return (
    <div className="rounded-lg border border-edge bg-base">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-elevated"
      >
        <div>
          <div className="font-medium text-ink">{FIX_LABELS[name]}</div>
          <div className="text-xs text-ink-muted">{FIX_DESCRIPTIONS[name]}</div>
        </div>
        <span className="text-ink-muted">{isOpen ? "▾" : "▸"}</span>
      </button>
      {isOpen && (
        <div className="border-t border-edge p-3">
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={scan}
              disabled={scanning}
              className="rounded bg-elevated px-3 py-1 text-sm text-ink hover:bg-edge disabled:opacity-50"
            >
              {scanning ? "Scanning…" : "Scan"}
            </button>
            {proposals && (
              <span className="text-xs text-ink-muted">
                {proposals.length === 0
                  ? "No proposals — library is clean for this fix."
                  : `${includedCount} of ${proposals.length} included`}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={apply}
              disabled={!proposals || includedCount === 0 || applying}
              className="rounded bg-accent px-3 py-1 text-sm font-medium text-base hover:opacity-90 disabled:opacity-50"
            >
              {applying ? "Staging…" : `Stage ${includedCount} change${includedCount === 1 ? "" : "s"}`}
            </button>
          </div>

          {proposals && proposals.length > 0 && (
            <div className="max-h-80 overflow-auto rounded border border-edge">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface text-ink-muted">
                  <tr>
                    <th className="w-8 py-1 px-2 text-left"> </th>
                    <th className="py-1 px-2 text-left">Track</th>
                    <th className="py-1 px-2 text-left">Field</th>
                    <th className="py-1 px-2 text-left">Old</th>
                    <th className="py-1 px-2 text-left">New</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const included = !excluded.has(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`border-t border-edge ${included ? "" : "opacity-40"}`}
                      >
                        <td className="py-1 px-2">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => {
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="py-1 px-2 truncate max-w-[260px] text-ink">
                          {p.track_title || p.track_id}
                        </td>
                        <td className="py-1 px-2 text-ink-muted">{p.field}</td>
                        <td className="py-1 px-2 truncate max-w-[200px] text-ink-muted">
                          {p.old_value}
                        </td>
                        <td className="py-1 px-2 truncate max-w-[200px] text-ink">
                          {p.new_value}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
