import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DialogContext,
  type ConfirmOptions,
  type DialogApi,
  type PromptOptions,
} from "../../hooks/useDialog";

interface DialogState {
  kind: "confirm" | "prompt";
  options: ConfirmOptions | PromptOptions;
  resolve: (v: unknown) => void;
}

export function DialogHost({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          setState({ kind: "confirm", options, resolve: (v) => resolve(v as boolean) });
        }),
      prompt: (options) =>
        new Promise<string | null>((resolve) => {
          setState({
            kind: "prompt",
            options,
            resolve: (v) => resolve(v as string | null),
          });
        }),
    }),
    [],
  );

  const close = useCallback(
    (value: boolean | string | null) => {
      if (!state) return;
      state.resolve(value);
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(state.kind === "confirm" ? false : null);
      }
    };
    window.addEventListener("keydown", onKey);
    queueMicrotask(() => {
      if (state.kind === "prompt") inputRef.current?.focus();
      else cancelButtonRef.current?.focus();
    });
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              close(state.kind === "confirm" ? false : null);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <div className="w-[420px] max-w-[90vw] rounded-lg border border-edge bg-surface p-5 shadow-2xl">
            <h2 id="dialog-title" className="mb-2 text-base font-semibold text-ink">
              {state.options.title}
            </h2>
            {state.options.body && (
              <div className="mb-4 text-sm text-ink-muted whitespace-pre-wrap">
                {state.options.body}
              </div>
            )}
            {state.kind === "prompt" && (
              <input
                ref={inputRef}
                type="text"
                defaultValue={(state.options as PromptOptions).defaultValue ?? ""}
                placeholder={(state.options as PromptOptions).placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    close((e.target as HTMLInputElement).value);
                  }
                }}
                className="mb-4 w-full rounded border border-edge bg-base px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                ref={cancelButtonRef}
                onClick={() => close(state.kind === "confirm" ? false : null)}
                className="rounded bg-elevated px-3 py-1.5 text-sm text-ink hover:bg-edge"
              >
                {state.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => {
                  if (state.kind === "confirm") {
                    close(true);
                  } else {
                    close(inputRef.current?.value ?? "");
                  }
                }}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  state.kind === "confirm" && (state.options as ConfirmOptions).destructive
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-accent text-base hover:opacity-90"
                }`}
              >
                {state.options.confirmLabel ??
                  (state.kind === "confirm" ? "Confirm" : "OK")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
