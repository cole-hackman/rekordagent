import { useState } from "react";
import { pickLibraryPath, validateLibraryPath, setLibraryPath } from "../ipc";
import { useAppStore } from "../store/appStore";

type Step = "welcome" | "pick" | "validating" | "done" | "error";

export function FirstRunWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [trackCount, setTrackCount] = useState<number>(0);
  const setLibraryConfigured = useAppStore((s) => s.setLibraryConfigured);

  async function handleBrowse() {
    try {
      const path = await pickLibraryPath();
      if (!path) return;
      setPickedPath(path);
      setStep("validating");
      const count = await validateLibraryPath(path);
      setTrackCount(count);
      await setLibraryPath(path);
      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  function handleFinish() {
    if (pickedPath !== null) {
      setLibraryConfigured(pickedPath, trackCount);
    }
  }

  function handleRetry() {
    setPickedPath(null);
    setErrorMsg("");
    setStep("pick");
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        {step === "welcome" && <Welcome onNext={() => setStep("pick")} />}
        {step === "pick" && <Pick onBrowse={handleBrowse} />}
        {step === "validating" && <Validating path={pickedPath!} />}
        {step === "done" && (
          <Done path={pickedPath!} trackCount={trackCount} onFinish={handleFinish} />
        )}
        {step === "error" && <ErrorView message={errorMsg} onRetry={handleRetry} />}
      </div>
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to decks</h1>
      <p className="text-sm text-zinc-400 leading-relaxed">
        decks is a local-first AI DJ assistant for Rekordbox 7. Your library
        data stays on your machine — no uploads, no telemetry.
      </p>
      <p className="text-sm text-zinc-400">
        To get started, point decks at your Rekordbox{" "}
        <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs">
          master.db
        </code>{" "}
        file.
      </p>
      <button
        onClick={onNext}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
      >
        Get started
      </button>
    </div>
  );
}

function Pick({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Locate your library</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Click <strong className="text-zinc-200">Browse</strong> to find{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs">
            master.db
          </code>
          . On macOS it's typically at:
        </p>
        <code className="block rounded bg-zinc-800 p-3 font-mono text-xs text-zinc-300 break-all">
          ~/Library/Pioneer/rekordbox/master.db
        </code>
        <p className="text-xs text-zinc-500">
          On Windows:{" "}
          <code className="font-mono">
            %APPDATA%\Pioneer\rekordbox\master.db
          </code>
        </p>
      </div>
      <button
        onClick={onBrowse}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
      >
        Browse…
      </button>
    </div>
  );
}

function Validating({ path }: { path: string }) {
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
      </div>
      <p className="text-sm font-medium">Validating library…</p>
      <p className="break-all font-mono text-xs text-zinc-500">{path}</p>
    </div>
  );
}

function Done({
  path,
  trackCount,
  onFinish,
}: {
  path: string;
  trackCount: number;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-green-400">✓</span>
          <h2 className="text-xl font-semibold">Library connected</h2>
        </div>
        <p className="text-sm text-zinc-400">
          Found{" "}
          <span className="font-semibold text-zinc-200">{trackCount.toLocaleString()}</span>{" "}
          tracks.
        </p>
        <p className="break-all font-mono text-xs text-zinc-500">{path}</p>
      </div>
      <button
        onClick={onFinish}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors"
      >
        Open library
      </button>
    </div>
  );
}

function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-red-400">✗</span>
          <h2 className="text-xl font-semibold">Validation failed</h2>
        </div>
        <p className="text-sm text-zinc-400">
          That file doesn't look like a valid Rekordbox library:
        </p>
        <p className="rounded bg-zinc-800 p-3 font-mono text-xs text-red-300 break-all">
          {message}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
