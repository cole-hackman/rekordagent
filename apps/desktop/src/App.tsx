import { useEffect, useMemo, useRef, useState } from "react";
import { FirstRunWizard } from "./components/FirstRunWizard";
import { TrackTable } from "./components/TrackTable";
import { TrackDetailPanel } from "./components/TrackDetailPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ChatPanel } from "./components/ChatPanel";
import { PlaylistPanel } from "./components/PlaylistPanel";
import { DiffReviewPanel } from "./components/DiffReviewPanel";
import { SidebarNav, type WorkspaceView } from "./components/SidebarNav";
import { StatusBar } from "./components/StatusBar";
import { AuditView } from "./components/AuditView";
import { useAppStore } from "./store/appStore";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useStagedChanges } from "./hooks/useStagedChanges";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { getLibraryPath, validateLibraryPath, getTheme } from "./ipc";
import type { Track } from "./types";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac/i.test(navigator.platform ?? navigator.userAgent ?? "");
// Reserve space for macOS traffic lights when titleBarStyle: Overlay.
const TRAFFIC_LIGHT_INSET = IS_MAC ? 72 : 0;

export default function App() {
  const { libraryPath, trackCount, theme, setLibraryConfigured, setTheme } =
    useAppStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [currentView, setCurrentView] = useState<WorkspaceView>("library");
  const [inspector, setInspector] = useState<"details" | "agent" | null>(null);
  const [pendingAgentPrompt, setPendingAgentPrompt] = useState<string | null>(
    null,
  );

  const runAudit = (prompt: string) => {
    setPendingAgentPrompt(prompt);
    setInspector("agent");
  };

  const audio = useAudioPlayer(selectedTrack);
  const { data: changes = [] } = useStagedChanges(libraryPath);
  const proposedCount = changes.filter((c) => c.status === "Proposed").length;
  const acceptedCount = changes.filter((c) => c.status === "Accepted").length;
  const playingTrack =
    selectedTrack && audio.isCurrentTrack(selectedTrack) ? selectedTrack : null;

  const handleTrackSelect = (track: Track) => {
    setSelectedTrack(track);
    if (inspector === null) setInspector("details");
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts(
    useMemo(
      () => [
        {
          key: "/",
          handler: (event) => {
            if (currentView !== "library") return;
            event.preventDefault();
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          },
        },
        {
          key: "escape",
          handler: () => {
            if (
              document.activeElement instanceof HTMLElement &&
              document.activeElement.tagName === "INPUT"
            ) {
              (document.activeElement as HTMLInputElement).blur();
              return;
            }
            if (inspector !== null) setInspector(null);
          },
        },
      ],
      [currentView, inspector],
    ),
  );

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    Promise.all([
      getLibraryPath().catch(() => null),
      getTheme().catch(() => null),
    ])
      .then(async ([savedPath, savedTheme]) => {
        if (savedTheme === "dark" || savedTheme === "light") {
          setTheme(savedTheme);
        }
        if (savedPath) {
          try {
            const count = await validateLibraryPath(savedPath);
            setLibraryConfigured(savedPath, count);
          } catch {
            // Saved path is stale — fall through to first-run wizard.
          }
        }
      })
      .finally(() => setLoading(false));
  }, [setLibraryConfigured, setTheme]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-edge-strong border-t-accent-hover" />
      </div>
    );
  }

  if (!libraryPath) {
    return <FirstRunWizard />;
  }

  const showSearch = currentView === "library";
  const showInspectorToggles =
    currentView === "library" || currentView === "playlists";

  return (
    <div className="flex h-screen w-screen flex-col bg-base text-ink">
      {/* Top bar — draggable, accounts for macOS traffic lights */}
      <header
        data-tauri-drag-region
        className="relative flex shrink-0 items-center gap-3 border-b border-edge bg-base pr-3"
        style={{ paddingLeft: TRAFFIC_LIGHT_INSET + 12, height: 44 }}
      >
        <div
          data-tauri-drag-region
          className="flex items-baseline gap-2"
        >
          <span
            data-tauri-drag-region
            className="select-none text-[15px] font-semibold tracking-tight text-ink"
          >
            decks
          </span>
          <span
            data-tauri-drag-region
            className="font-mono text-[11px] tabular-nums text-ink-muted"
          >
            {trackCount?.toLocaleString() ?? 0}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {showSearch && (
            <div className="relative">
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Filter library…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-60 rounded-md border border-edge bg-surface px-3 py-1 pr-7 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <kbd
                aria-hidden
                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded border border-edge-strong bg-surface px-1 font-mono text-[10px] text-ink-muted"
              >
                /
              </kbd>
            </div>
          )}
          {showInspectorToggles && selectedTrack && (
            <button
              onClick={() =>
                setInspector((v) => (v === "details" ? null : "details"))
              }
              aria-label={inspector === "details" ? "Hide details" : "Show details"}
              className={`rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider transition-colors duration-150 hover:bg-elevated ${
                inspector === "details"
                  ? "text-accent-hover"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Details
            </button>
          )}
          <button
            onClick={() => setInspector((v) => (v === "agent" ? null : "agent"))}
            aria-label={inspector === "agent" ? "Close agent" : "Open agent"}
            className={`rounded-md p-1.5 transition-colors duration-150 hover:bg-elevated ${
              inspector === "agent"
                ? "text-accent-hover"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M2.678 11.894a1 1 0 01.287.801 10.97 10.97 0 01-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 01.71-.074A8.06 8.06 0 008 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 01-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 00.244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 01-2.347-.306c-.52.263-1.639.742-3.468 1.105z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <SidebarNav
          current={currentView}
          onSelect={setCurrentView}
          pendingChangeCount={proposedCount}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {currentView === "library" && (
            <TrackTable
              libraryPath={libraryPath}
              filter={filter}
              selectedTrackId={selectedTrack?.id ?? null}
              onSelect={handleTrackSelect}
            />
          )}
          {currentView === "playlists" && (
            <PlaylistPanel
              libraryPath={libraryPath}
              selectedTrackId={selectedTrack?.id ?? null}
              onSelectTrack={handleTrackSelect}
            />
          )}
          {currentView === "changes" && (
            <DiffReviewPanel libraryPath={libraryPath} />
          )}
          {currentView === "audit" && (
            <AuditView
              libraryPath={libraryPath}
              trackCount={trackCount}
              onRunAudit={runAudit}
              onOpenChanges={() => setCurrentView("changes")}
            />
          )}
          {currentView === "settings" && <SettingsPanel />}
        </main>

        {inspector === "details" && selectedTrack && (
          <TrackDetailPanel
            track={selectedTrack}
            libraryPath={libraryPath}
            isPlaying={audio.isPlaying && audio.isCurrentTrack(selectedTrack)}
            onTogglePlay={audio.toggleCurrent}
          />
        )}
        {inspector === "agent" && (
          <ChatPanel
            libraryPath={libraryPath}
            onClose={() => setInspector(null)}
            pendingPrompt={pendingAgentPrompt}
            onPromptConsumed={() => setPendingAgentPrompt(null)}
          />
        )}
      </div>

      <StatusBar
        libraryPath={libraryPath}
        trackCount={trackCount}
        playingTrack={playingTrack}
        isPlaying={audio.isPlaying}
        pendingChanges={proposedCount}
        acceptedChanges={acceptedCount}
      />
    </div>
  );
}

