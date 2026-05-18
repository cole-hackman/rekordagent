import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AnlzWaveform } from "../../types";

interface ColorWaveformProps extends React.HTMLAttributes<HTMLDivElement> {
  data: AnlzWaveform;
  barWidth?: number;
  barGap?: number;
  fadeEdges?: boolean;
}

export function ColorWaveform({
  data,
  barWidth = 2,
  barGap = 1,
  fadeEdges = true,
  className,
  ...props
}: ColorWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        renderWaveform();
      }
    });

    const renderWaveform = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Prefer detail waveform if available and long enough, else preview, else fallback peaks
      const hasDetail = data.detail && data.detail.length > 0;
      const hasPreview = data.preview && data.preview.length > 0;
      const hasPeaks = data.peaks && data.peaks.length > 0;

      if (!hasDetail && !hasPreview && !hasPeaks) return;

      const centerY = rect.height / 2;
      const maxDrawHeight = rect.height * 0.9;
      
      const barsToDraw = Math.floor(rect.width / (barWidth + barGap));
      
      // Determine what data array to use
      let sourceLength = 0;
      if (hasDetail) sourceLength = data.detail.length;
      else if (hasPreview) sourceLength = data.preview.length;
      else if (hasPeaks) sourceLength = data.peaks!.length;

      for (let i = 0; i < barsToDraw; i++) {
        const dataIndex = Math.floor((i / barsToDraw) * sourceLength);
        const x = i * (barWidth + barGap);

        let height = 0;
        let colorStr = "rgba(100, 100, 100, 0.5)"; // fallback

        if (hasDetail) {
            const point = data.detail[dataIndex];
            height = (point.height / 31) * maxDrawHeight; // detail height is 0-31
            if (point.color.type === "Rgb") {
                const [r, g, b] = point.color.value;
                colorStr = `rgb(${r}, ${g}, ${b})`;
            } else {
                const bVal = point.color.value;
                colorStr = `rgb(0, ${bVal / 2}, ${bVal})`;
            }
        } else if (hasPreview) {
            const point = data.preview[dataIndex];
            height = (point.height / 31) * maxDrawHeight; // preview height is 0-31
            if (point.color.type === "Rgb") {
                const [r, g, b] = point.color.value;
                colorStr = `rgb(${r}, ${g}, ${b})`;
            } else {
                const bVal = point.color.value;
                colorStr = `rgb(0, ${bVal / 2}, ${bVal})`;
            }
        } else if (hasPeaks) {
            const val = data.peaks![dataIndex];
            height = val * maxDrawHeight;
            colorStr = "rgb(var(--text-muted))";
        }

        height = Math.max(2, height); // Min height of 2px
        const y = centerY - height / 2;

        ctx.fillStyle = colorStr;
        // The Pioneer waveforms are very dense, usually drawn without rounded corners for sharpness
        ctx.fillRect(x, y, barWidth, height);
      }

      if (fadeEdges && rect.width > 0) {
        const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(0.1, "rgba(255,255,255,0)");
        gradient.addColorStop(0.9, "rgba(255,255,255,0)");
        gradient.addColorStop(1, "rgba(255,255,255,1)");

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.globalCompositeOperation = "source-over";
      }
    };

    resizeObserver.observe(container);
    renderWaveform();

    return () => resizeObserver.disconnect();
  }, [data, barWidth, barGap, fadeEdges]);

  return (
    <div ref={containerRef} className={cn("h-full w-full", className)} {...props}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}