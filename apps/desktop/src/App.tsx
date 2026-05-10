import { useEffect, useState } from "react";
import { FirstRunWizard } from "./components/FirstRunWizard";
import { TrackTable } from "./components/TrackTable";
import { useAppStore } from "./store/appStore";
import { getLibraryPath, validateLibraryPath } from "./ipc";

export default function App() {
  const { libraryPath, trackCount, setLibraryConfigured } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getLibraryPath()
      .then(async (savedPath) => {
        if (savedPath) {
          try {
            const count = await validateLibraryPath(savedPath);
            setLibraryConfigured(savedPath, count);
          } catch {
            // Saved path is stale — fall through to first-run wizard.
          }
        }
      })
      .catch(() => {
        // IPC not available (e.g., running in browser during tests) — ignore.
      })
      .finally(() => setLoading(false));
  }, [setLibraryConfigured]);

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
        </div>
      </header>
      <TrackTable libraryPath={libraryPath} filter={filter} />
    </div>
  );
}
