import { useQuery } from "@tanstack/react-query";
import { getLibraryAnalytics } from "../ipc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import type { LibraryAnalytics } from "../types";

interface Props {
  libraryPath: string;
}

const COLORS = [
  "rgb(var(--accent-hover))",
  "rgb(var(--accent))",
  "rgb(var(--accent) / 0.8)",
  "rgb(var(--accent) / 0.6)",
  "rgb(var(--accent) / 0.4)",
];

export function AnalyticsView({ libraryPath }: Props) {
  const { data, isLoading, error } = useQuery<LibraryAnalytics, Error>({
    queryKey: ["analytics", libraryPath],
    queryFn: () => getLibraryAnalytics(libraryPath),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-edge-strong border-t-accent-hover" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            Aggregating...
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-base text-status-warn">
        <svg viewBox="0 0 16 16" fill="currentColor" className="mb-2 h-6 w-6">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 112 0v3.586l2.207 2.207a1 1 0 01-1.414 1.414l-2.5-2.5A1 1 0 017 9V5z" />
        </svg>
        <span className="font-mono text-xs">Failed to load analytics</span>
      </div>
    );
  }

  // Format data for Recharts
  const bpmData = Object.entries(data.bpm_histogram)
    .map(([bpm, count]) => ({ bpm: parseInt(bpm, 10), count }))
    .sort((a, b) => a.bpm - b.bpm);

  const genreData = Object.entries(data.genre_distribution)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15); // Top 15 genres

  const keyData = Object.entries(data.key_distribution)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24); // Top 24 keys

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string | number;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded border border-accent bg-base px-2 py-1.5 shadow-xl shadow-black/40">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted mb-1">{label}</p>
          <p className="font-mono text-xs font-bold text-ink">
            {payload[0].value.toLocaleString()} <span className="font-sans font-normal text-ink-secondary text-[11px]">tracks</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto bg-base p-6">
      {/* Aesthetic grid background overlay */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: "linear-gradient(rgb(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <header className="mb-8 flex items-end justify-between border-b border-edge/60 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Library Analytics
            </h1>
            <p className="mt-1 text-[13px] text-ink-secondary">
              A high-level view of your music collection's distribution.
            </p>
          </div>
          <div className="text-right">
            <span className="block font-mono text-4xl font-light tracking-tighter text-accent-hover">
              {data.total_tracks.toLocaleString()}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Total Tracks
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* BPM Histogram */}
          <div className="col-span-1 xl:col-span-2 flex flex-col rounded-xl border border-edge bg-surface/40 p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-ink">Tempo Distribution</h2>
              <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-secondary">
                BPM
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bpmData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border-default) / 0.4)" />
                  <XAxis 
                    dataKey="bpm" 
                    tick={{ fontSize: 10, fill: "rgb(var(--text-muted))", fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={20}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: "rgb(var(--text-muted))", fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgb(var(--accent) / 0.1)" }} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {bpmData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="rgb(var(--accent))" opacity={0.8 + (entry.count / data.total_tracks) * 2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Genre Distribution */}
          <div className="flex flex-col rounded-xl border border-edge bg-surface/40 p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-ink">Top Genres</h2>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genreData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgb(var(--border-default) / 0.4)" />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 10, fill: "rgb(var(--text-muted))", fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="genre" 
                    tick={{ fontSize: 11, fill: "rgb(var(--foreground))", width: 100 }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgb(var(--accent) / 0.1)" }} />
                  <Bar dataKey="count" radius={[0, 2, 2, 0]} barSize={20}>
                    {genreData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Distribution */}
          <div className="flex flex-col rounded-xl border border-edge bg-surface/40 p-5 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-ink">Top Keys</h2>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={keyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border-default) / 0.4)" />
                  <XAxis 
                    dataKey="key" 
                    tick={{ fontSize: 10, fill: "rgb(var(--text-muted))", fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: "rgb(var(--text-muted))", fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgb(var(--accent) / 0.1)" }} />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {keyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="rgb(var(--foreground))" opacity={0.6 + (entry.count / data.total_tracks)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}