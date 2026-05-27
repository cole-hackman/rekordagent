import { useState } from "react";

interface Props {
  title: string;
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function ErrorPanel({ title, error, onRetry, compact = false }: Props) {
  const [copied, setCopied] = useState(false);
  const message = errorMessage(error);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${message}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (compact) {
    return (
      <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-red-300">{title}</p>
            <p className="mt-1 break-words font-mono text-[11px] text-red-300/80">
              {message}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded border border-red-900/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-300 transition-colors hover:border-red-700 hover:text-red-200"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-5">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-red-500" />
            <h3 className="text-sm font-semibold text-red-200">{title}</h3>
          </div>
          <p className="mt-3 break-words font-mono text-[12px] leading-relaxed text-red-300/80">
            {message}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-md bg-red-500/20 px-3 py-1.5 text-[13px] font-medium text-red-100 transition-colors hover:bg-red-500/30"
              >
                Retry
              </button>
            )}
            <button
              onClick={handleCopy}
              className="rounded-md border border-red-900/70 px-3 py-1.5 text-[13px] text-red-200 transition-colors hover:border-red-700 hover:text-red-100"
            >
              {copied ? "Copied" : "Copy details"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
