import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "warn" | "error";

interface ToastInput {
  message: string;
  detail?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface Toast extends Required<Omit<ToastInput, "detail" | "action">> {
  id: number;
  detail?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId++;
      const next: Toast = {
        id,
        message: input.message,
        detail: input.detail,
        variant: input.variant ?? "info",
        duration: input.duration ?? 4000,
        action: input.action,
      };
      setToasts((prev) => [...prev, next]);
      if (next.duration > 0) {
        const handle = setTimeout(() => dismiss(id), next.duration);
        timersRef.current.set(id, handle);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handle of timers.values()) clearTimeout(handle);
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Permissive fallback so components mounted outside the provider don't crash.
    return {
      toast: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "border-edge-strong bg-surface text-ink",
  success: "border-emerald-500/40 bg-emerald-950/80 text-emerald-100",
  warn: "border-accent/40 bg-accent-dim/40 text-ink",
  error: "border-red-500/40 bg-red-950/80 text-red-100",
};

const VARIANT_DOT: Record<ToastVariant, string> = {
  info: "bg-ink-secondary",
  success: "bg-emerald-400",
  warn: "bg-accent-hover",
  error: "bg-red-400",
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-8 right-6 z-50 flex flex-col-reverse gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.variant === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-80 items-start gap-3 rounded-md border px-3 py-2.5 shadow-lg shadow-black/40 backdrop-blur-sm animate-[slideInRight_200ms_ease-out] ${VARIANT_STYLES[t.variant]}`}
        >
          <span
            aria-hidden
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${VARIANT_DOT[t.variant]}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-tight">{t.message}</p>
            {t.detail && (
              <p className="mt-1 font-mono text-[11px] leading-snug opacity-70 break-words">
                {t.detail}
              </p>
            )}
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  onDismiss(t.id);
                }}
                className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-accent-hover transition-colors hover:text-accent-hover"
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3.22 3.22a.75.75 0 011.06 0L8 6.94l3.72-3.72a.75.75 0 111.06 1.06L9.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 01-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
