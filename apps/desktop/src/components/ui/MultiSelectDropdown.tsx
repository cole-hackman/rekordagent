import { Check, Search } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { cn } from "@/lib/utils";

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  mono?: boolean;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
  mono = false,
}: MultiSelectDropdownProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="flex w-full items-center justify-between rounded-md border border-edge bg-surface px-2.5 py-1.5 text-left text-[12px] text-ink transition-colors hover:border-edge-strong focus:outline-none focus:ring-1 focus:ring-accent/40">
          <span className="truncate">
            {selected.length === 0
              ? `Select ${label}...`
              : `${selected.length} ${label} selected`}
          </span>
          <svg viewBox="0 0 16 16" fill="currentColor" className="ml-2 h-3 w-3 shrink-0 text-ink-muted">
            <path d="M4.427 7.427l3.396 3.396 3.396-3.396a.75.75 0 111.06 1.06l-3.926 3.926a.75.75 0 01-1.06 0L3.367 8.487a.75.75 0 011.06-1.06z" />
          </svg>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={5}
          align="start"
          className="z-[60] w-64 rounded-lg border border-edge bg-base p-1 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95"
        >
          <Command className="flex flex-col">
            <div className="flex items-center border-b border-edge px-2 py-1.5">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-ink-muted" />
              <Command.Input
                placeholder={`Search ${label}...`}
                className="flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-faint"
              />
              {selected.length > 0 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onClear();
                  }}
                  className="ml-2 text-[10px] font-bold uppercase tracking-wider text-accent-hover hover:text-accent"
                >
                  Clear
                </button>
              )}
            </div>
            <Command.List className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
              <Command.Empty className="px-3 py-2 text-[11px] text-ink-muted">
                No {label.toLowerCase()} found.
              </Command.Empty>
              <Command.Group>
                {options.map((option) => {
                  const isActive = selected.includes(option);
                  return (
                    <Command.Item
                      key={option}
                      onSelect={() => onToggle(option)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[12px] transition-colors hover:bg-accent/10 hover:text-ink focus:bg-accent/10 focus:text-ink outline-none",
                        isActive ? "text-accent-hover" : "text-ink-secondary",
                        mono ? "font-mono tabular-nums" : ""
                      )}
                    >
                      <span className="truncate">{option}</span>
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
