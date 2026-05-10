import { useEffect, useState } from "react";
import { FirstRunWizard } from "./components/FirstRunWizard";
import { useAppStore } from "./store/appStore";
import { getLibraryPath, validateLibraryPath } from "./ipc";

export default function App() {
  const { libraryPath, trackCount, setLibraryConfigured } = useAppStore();
  const [loading, setLoading] = useState(true);

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
      <header className="flex items-center border-b border-zinc-800 px-4 py-2">
        <span className="text-sm font-bold tracking-tight text-zinc-100">decks</span>
        <span className="ml-3 text-xs text-zinc-500">
          {trackCount?.toLocaleString()} tracks
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Library browser coming soon…</p>
      </main>
    </div>
  );
}
