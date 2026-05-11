import type { ReactNode } from "react";

export type WorkspaceView =
  | "library"
  | "playlists"
  | "changes"
  | "audit"
  | "settings";

interface NavItem {
  id: WorkspaceView;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "library",
    label: "Library",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path d="M2.5 2A1.5 1.5 0 001 3.5v9A1.5 1.5 0 002.5 14h11a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0013.5 2h-11zM2 3.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-9zm4 0a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-9zm5 0a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-9z" />
      </svg>
    ),
  },
  {
    id: "playlists",
    label: "Playlists",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path d="M1 2.5A.5.5 0 011.5 2h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zm0 3A.5.5 0 011.5 5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zm0 3A.5.5 0 011.5 8h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zM14 12a2 2 0 11-1.732-1.984V4.5a.5.5 0 011 0v7.5z" />
      </svg>
    ),
  },
  {
    id: "changes",
    label: "Changes",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path d="M8 4a4 4 0 100 8 4 4 0 000-8zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-2.5a.5.5 0 010-1h3a.5.5 0 01.5.5v3a.5.5 0 01-1 0V6.207L6.354 9.354a.5.5 0 11-.708-.708L8.793 5.5H6.5z" />
      </svg>
    ),
  },
  {
    id: "audit",
    label: "Audit",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0zM6.5 3a.5.5 0 01.5.5V6h2.5a.5.5 0 010 1H7v2.5a.5.5 0 01-1 0V7H3.5a.5.5 0 010-1H6V3.5a.5.5 0 01.5-.5z" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
        <path
          fillRule="evenodd"
          d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.319 1.438.098l1.02-.48c.103-.047.19-.02.242.027.424.391.787.839 1.08 1.336.05.085.037.185-.006.26l-.628 1.011c-.292.47-.285 1.065.023 1.498.151.214.287.44.407.677.26.512.692.854 1.158.955l1.106.239c.114.025.155.104.161.143.031.26.047.524.047.79 0 .268-.016.531-.046.79-.006.04-.047.12-.16.144l-1.107.24c-.466.1-.897.442-1.158.954a6.214 6.214 0 01-.407.677c-.308.433-.315 1.028-.023 1.498l.628 1.01c.043.076.056.177.007.261a7.269 7.269 0 01-1.08 1.336c-.053.048-.139.074-.243.027l-1.019-.48c-.469-.221-1.021-.18-1.438.099a5.96 5.96 0 01-.502.289c-.447.222-.85.629-.997 1.188l-.289 1.105c-.029.11-.1.143-.137.146a6.59 6.59 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.966-.997-1.188a5.96 5.96 0 01-.501-.29c-.417-.278-.97-.32-1.438-.098l-1.02.48c-.103.047-.19.021-.242-.027a7.269 7.269 0 01-1.08-1.336c-.05-.084-.037-.185.007-.26l.628-1.011c.292-.47.285-1.065-.023-1.498a6.214 6.214 0 01-.407-.677c-.26-.512-.692-.854-1.158-.955l-1.106-.239c-.114-.025-.155-.104-.161-.143A6.587 6.587 0 010 8c0-.268.016-.531.046-.79.006-.04.047-.119.16-.143l1.107-.24c.466-.1.898-.443 1.158-.955.12-.236.256-.462.407-.676.308-.433.315-1.029.023-1.498L2.273 2.69c-.043-.076-.056-.177-.007-.261a7.269 7.269 0 011.08-1.336c.053-.047.14-.074.243-.027l1.019.48c.469.221 1.021.18 1.438-.099a5.96 5.96 0 01-.502.29c.448-.223.851-.629.998-1.189l.289-1.105c.029-.11.1-.143.137-.146zM8 11a3 3 0 110-6 3 3 0 010 6z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

interface Props {
  current: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  pendingChangeCount?: number;
  topInset?: number;
}

export function SidebarNav({
  current,
  onSelect,
  pendingChangeCount = 0,
  topInset = 0,
}: Props) {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex w-14 shrink-0 flex-col items-stretch border-r border-edge bg-base"
    >
      {/* Spacer for macOS traffic lights */}
      <div style={{ height: topInset }} aria-hidden />

      <ul className="flex flex-col gap-0.5 px-1.5 py-2">
        {NAV_ITEMS.map((item) => {
          const active = item.id === current;
          const badge =
            item.id === "changes" && pendingChangeCount > 0
              ? pendingChangeCount
              : null;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={[
                  "group relative flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md transition-colors duration-150",
                  active
                    ? "bg-accent/10 text-accent-hover"
                    : "text-ink-muted hover:bg-surface hover:text-ink-secondary",
                ].join(" ")}
              >
                {/* Active indicator bar */}
                <span
                  aria-hidden
                  className={[
                    "absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-sm transition-colors duration-150",
                    active ? "bg-accent-hover" : "bg-transparent",
                  ].join(" ")}
                />
                <span className="flex h-4 w-4 items-center justify-center">
                  {item.icon}
                </span>
                <span className="text-[9px] font-medium uppercase tracking-wider">
                  {item.label}
                </span>
                {badge !== null && (
                  <span
                    aria-label={`${badge} pending`}
                    className="absolute right-1.5 top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] font-semibold tabular-nums text-base"
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
