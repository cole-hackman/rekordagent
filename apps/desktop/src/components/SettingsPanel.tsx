import { useState, useEffect } from "react";
import {
  pickLibraryPath,
  validateLibraryPath,
  setLibraryPath as setLibraryPathIpc,
  setTheme as setThemeIpc,
  getApiKey,
  setApiKey,
  deleteApiKey,
  getClaudeCodeStatus,
  type ClaudeCodeStatus,
} from "../ipc";
import { useAppStore } from "../store/appStore";

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const { libraryPath, theme, setLibraryConfigured, setTheme } = useAppStore();

  const [libraryChanging, setLibraryChanging] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [anthropicKey, setAnthropicKey] = useState("");
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [claudeCodeStatus, setClaudeCodeStatus] =
    useState<ClaudeCodeStatus | null>(null);

  useEffect(() => {
    getApiKey("anthropic_api_key")
      .then((key) => {
        if (key) setAnthropicKey(key);
      })
      .catch(() => {})
      .finally(() => setKeyLoaded(true));

    getClaudeCodeStatus()
      .then(setClaudeCodeStatus)
      .catch((e) =>
        setClaudeCodeStatus({
          installed: false,
          version: null,
          logged_in: null,
          auth_method: null,
          subscription_type: null,
          email: null,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
  }, []);

  const handleThemeChange = async (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    try {
      await setThemeIpc(newTheme);
    } catch (e) {
      console.error("set theme error", e);
    }
  };

  const handleChangeLibrary = async () => {
    setLibraryChanging(true);
    setLibraryError(null);
    try {
      const path = await pickLibraryPath();
      if (!path) return;
      const count = await validateLibraryPath(path);
      await setLibraryPathIpc(path);
      setLibraryConfigured(path, count);
    } catch (e) {
      setLibraryError(e instanceof Error ? e.message : String(e));
    } finally {
      setLibraryChanging(false);
    }
  };

  const handleSaveKey = async () => {
    setKeySaving(true);
    try {
      await setApiKey("anthropic_api_key", anthropicKey);
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    } catch (e) {
      console.error("save key error", e);
    } finally {
      setKeySaving(false);
    }
  };

  const handleRemoveKey = async () => {
    try {
      await deleteApiKey("anthropic_api_key");
      setAnthropicKey("");
    } catch (e) {
      console.error("remove key error", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="flex h-full w-96 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M3.22 3.22a.75.75 0 011.06 0L8 6.94l3.72-3.72a.75.75 0 111.06 1.06L9.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>

        {/* Appearance */}
        <section className="border-b border-zinc-800 px-5 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Appearance
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => void handleThemeChange("dark")}
              className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
                theme === "dark"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => void handleThemeChange("light")}
              className={`flex-1 rounded-md px-3 py-2 text-sm transition-colors ${
                theme === "light"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Light
            </button>
          </div>
        </section>

        {/* Library */}
        <section className="border-b border-zinc-800 px-5 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Library
          </h3>
          <p
            className="mb-3 truncate font-mono text-xs text-zinc-400"
            title={libraryPath ?? undefined}
          >
            {libraryPath ?? "—"}
          </p>
          {libraryError && (
            <p className="mb-2 text-xs text-red-400">{libraryError}</p>
          )}
          <button
            onClick={() => void handleChangeLibrary()}
            disabled={libraryChanging}
            className="w-full rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {libraryChanging ? "Locating…" : "Change Library…"}
          </button>
        </section>

        {/* Agent runtime */}
        <section className="border-b border-zinc-800 px-5 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Agent Runtime
          </h3>
          {claudeCodeStatus === null ? (
            <div className="flex justify-center py-3">
              <div className="h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-indigo-400" />
            </div>
          ) : claudeCodeStatus.installed ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-zinc-200">
                  Claude Code detected
                </span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                  {claudeCodeStatus.version ?? "installed"}
                </span>
              </div>
              {claudeCodeStatus.logged_in ? (
                <p className="mt-2 text-zinc-400">
                  Signed in as {claudeCodeStatus.email ?? "Claude user"}
                  {claudeCodeStatus.subscription_type
                    ? ` with ${titleCase(claudeCodeStatus.subscription_type)} subscription`
                    : ""}
                  .
                </p>
              ) : (
                <p className="mt-2 text-zinc-400">Not signed in to Claude Code.</p>
              )}
              <p className="mt-2 text-zinc-500">
                Current chat runtime still uses Anthropic API keys. Claude Code
                subscription support is detected here but is not wired to chat yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-400">
              Claude Code was not found on this Mac. Current chat runtime uses
              Anthropic API keys.
            </div>
          )}
        </section>

        {/* API Keys */}
        <section className="px-5 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            API Keys
          </h3>
          {!keyLoaded ? (
            <div className="flex justify-center py-3">
              <div className="h-4 w-4 animate-spin rounded-full border border-zinc-600 border-t-indigo-400" />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400">
                Anthropic API Key
              </label>
              <div className="relative mb-2 flex items-center">
                <input
                  type={showKey ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-…"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 pr-10 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide key" : "Show key"}
                  className="absolute right-2 text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {showKey ? (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                      <path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z" />
                      <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884l-12-12 .708-.708 12 12-.708.708z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z" />
                      <path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleSaveKey()}
                  disabled={keySaving || anthropicKey.trim() === ""}
                  className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {keySaved ? "Saved!" : keySaving ? "Saving…" : "Save"}
                </button>
                {anthropicKey && (
                  <button
                    onClick={() => void handleRemoveKey()}
                    className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
