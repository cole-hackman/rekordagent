import { useEffect, useState } from "react";
import { FirstRunWizard } from "./components/FirstRunWizard";
import { TrackTable } from "./components/TrackTable";
import { TrackDetailPanel } from "./components/TrackDetailPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ChatPanel } from "./components/ChatPanel";
import { PlaylistPanel } from "./components/PlaylistPanel";
import { useAppStore } from "./store/appStore";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { getLibraryPath, validateLibraryPath, getTheme } from "./ipc";
import type { Track } from "./types";

export default function App() {
  const { libraryPath, trackCount, theme, setLibraryConfigured, setTheme } =
    useAppStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const audio = useAudioPlayer(selectedTrack);

  // Apply theme class to <html>
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
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
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-400" />
      </div>
    );
  }

  if (!libraryPath) {
    return <FirstRunWizard />;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 items-center gap-4 border-b border-zinc-800 px-4 py-2">
        <span className="text-sm font-bold tracking-tight">decks</span>
        <span className="text-xs text-zinc-500">
          {trackCount?.toLocaleString()} tracks
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-52 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => setShowPlaylists((v) => !v)}
            aria-label={showPlaylists ? "Hide playlists" : "Show playlists"}
            className={`rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800 hover:text-zinc-100 ${showPlaylists ? "text-indigo-400" : "text-zinc-400"}`}
          >
            Playlists
          </button>
          <button
            onClick={() => setShowChat((v) => !v)}
            aria-label={showChat ? "Close agent" : "Open agent"}
            className={`rounded-md p-1.5 transition-colors hover:bg-zinc-800 hover:text-zinc-100 ${showChat ? "text-indigo-400" : "text-zinc-400"}`}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M2.678 11.894a1 1 0 01.287.801 10.97 10.97 0 01-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 01.71-.074A8.06 8.06 0 008 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 01-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 00.244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 01-2.347-.306c-.52.263-1.639.742-3.468 1.105z" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Open settings"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.319 1.438.098l1.02-.48c.103-.047.19-.02.242.027.424.391.787.839 1.08 1.336.05.085.037.185-.006.26l-.628 1.011c-.292.47-.285 1.065.023 1.498.151.214.287.44.407.677.26.512.692.854 1.158.955l1.106.239c.114.025.155.104.161.143.031.26.047.524.047.79 0 .268-.016.531-.046.79-.006.04-.047.12-.16.144l-1.107.24c-.466.1-.897.442-1.158.954a6.214 6.214 0 01-.407.677c-.308.433-.315 1.028-.023 1.498l.628 1.01c.043.076.056.177.007.261a7.269 7.269 0 01-1.08 1.336c-.053.048-.139.074-.243.027l-1.019-.48c-.469-.221-1.021-.18-1.438.099a5.96 5.96 0 01-.502.289c-.447.222-.85.629-.997 1.188l-.289 1.105c-.029.11-.1.143-.137.146a6.59 6.59 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.966-.997-1.188a5.96 5.96 0 01-.501-.29c-.417-.278-.97-.32-1.438-.098l-1.02.48c-.103.047-.19.021-.242-.027a7.269 7.269 0 01-1.08-1.336c-.05-.084-.037-.185.007-.26l.628-1.011c.292-.47.285-1.065-.023-1.498a6.214 6.214 0 01-.407-.677c-.26-.512-.692-.854-1.158-.955l-1.106-.239c-.114-.025-.155-.104-.161-.143A6.587 6.587 0 010 8c0-.268.016-.531.046-.79.006-.04.047-.119.16-.143l1.107-.24c.466-.1.898-.443 1.158-.955.12-.236.256-.462.407-.676.308-.433.315-1.029.023-1.498L2.273 2.69c-.043-.076-.056-.177-.007-.261a7.269 7.269 0 011.08-1.336c.053-.047.14-.074.243-.027l1.019.48c.469.221 1.021.18 1.438-.099a5.96 5.96 0 01-.502.29c.448-.223.851-.629.998-1.189l.289-1.105c.029-.11.1-.143.137-.146zM8 11a3 3 0 110-6 3 3 0 010 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {showPlaylists && <PlaylistPanel libraryPath={libraryPath} />}
          <TrackTable
            libraryPath={libraryPath}
            filter={filter}
            selectedTrackId={selectedTrack?.id ?? null}
            onSelect={setSelectedTrack}
          />
        </div>
        {selectedTrack && (
          <TrackDetailPanel
            track={selectedTrack}
            libraryPath={libraryPath}
            isPlaying={audio.isPlaying && audio.isCurrentTrack(selectedTrack)}
            onTogglePlay={audio.toggleCurrent}
          />
        )}
        {showChat && (
          <ChatPanel
            libraryPath={libraryPath}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
