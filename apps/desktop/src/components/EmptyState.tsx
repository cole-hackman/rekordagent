import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {icon && (
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface text-ink-muted">
            {icon}
          </div>
        )}
        <h3 className="text-sm font-semibold tracking-tight text-ink">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            {description}
          </p>
        )}
        {(action || secondaryAction) && (
          <div className="mt-5 flex items-center justify-center gap-2">
            {action && (
              <button
                onClick={action.onClick}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-base transition-colors duration-150 hover:bg-accent-hover"
              >
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="rounded-md border border-edge-strong px-3 py-1.5 text-sm text-ink-secondary transition-colors duration-150 hover:border-edge-strong hover:text-ink"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
