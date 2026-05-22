import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Track } from "../types";

export interface TrackContextMenuAction {
  /** Unique id used for `key`s and analytics. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional right-aligned hint (shortcut, "stages change", etc.). */
  hint?: string;
  /** Optional leading icon. 14×14 area; pass an inline SVG. */
  icon?: React.ReactNode;
  /** Render this item as destructive (red on hover). */
  destructive?: boolean;
  /** When set, the item shows greyed and clicking is a no-op. */
  disabled?: boolean;
  /** Click handler. Receives the track that opened the menu. */
  onSelect: (track: Track) => void;
}

interface Props {
  track: Track | null;
  /** Mouse position the menu should anchor to. Null closes the menu. */
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  actions: TrackContextMenuAction[];
}

/** Lightweight right-click context menu rendered through a portal.
 *  Closes on outside click, scroll, blur, escape, or any action selection.
 *  Positions itself so the menu stays inside the viewport. */
export function TrackContextMenu({ track, anchor, onClose, actions }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(
    anchor,
  );

  // Re-anchor whenever a new anchor arrives. Clamp into viewport after layout.
  useLayoutEffect(() => {
    setAdjusted(anchor);
  }, [anchor]);

  useLayoutEffect(() => {
    if (!adjusted || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 6;
    let x = adjusted.x;
    let y = adjusted.y;
    if (x + rect.width + margin > window.innerWidth) {
      x = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (y + rect.height + margin > window.innerHeight) {
      y = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    if (x !== adjusted.x || y !== adjusted.y) {
      setAdjusted({ x, y });
    }
  }, [adjusted]);

  // Global dismissers.
  useEffect(() => {
    if (!anchor) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [anchor, onClose]);

  const items = useMemo(() => actions, [actions]);

  if (!anchor || !adjusted || !track) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Track actions"
      style={{
        position: "fixed",
        left: adjusted.x,
        top: adjusted.y,
        minWidth: 192,
      }}
      className="z-50 overflow-hidden rounded-md border border-edge bg-surface py-1 shadow-2xl shadow-black/60 backdrop-blur-md animate-[fadeIn_80ms_ease-out]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.id === "__separator__") {
          return (
            <div
              key={`sep-${i}`}
              role="separator"
              className="my-1 border-t border-edge/60"
            />
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onSelect(track);
              onClose();
            }}
            className={[
              "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-[12px] transition-colors",
              item.disabled
                ? "cursor-not-allowed text-ink-faint"
                : item.destructive
                  ? "text-ink-secondary hover:bg-status-error/15 hover:text-status-error"
                  : "text-ink-secondary hover:bg-elevated hover:text-ink",
            ].join(" ")}
          >
            <span
              aria-hidden
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-ink-muted"
            >
              {item.icon}
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint && (
              <span className="ml-3 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                {item.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

