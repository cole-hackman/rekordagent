import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  children: React.ReactNode;
  side: "left" | "right";
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  className?: string;
  onResize?: (width: number) => void;
}

export function ResizablePanel({
  children,
  side,
  minWidth = 200,
  maxWidth = 600,
  defaultWidth = 320,
  className,
  onResize,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current) return;

      let newWidth: number;
      if (side === "right") {
        newWidth = window.innerWidth - e.clientX;
      } else {
        newWidth = e.clientX;
      }

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
        onResize?.(newWidth);
      }
    },
    [side, minWidth, maxWidth, onResize]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div
      style={{ width }}
      className={cn("relative flex h-full shrink-0 flex-col overflow-hidden", className)}
    >
      <div
        onMouseDown={startResizing}
        className={cn(
          "absolute top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-accent/40 active:bg-accent",
          side === "right" ? "left-0" : "right-0"
        )}
      />
      {children}
    </div>
  );
}
