/**
 * Tiny horizontal bar visualising a track's energy in [0, 1]. Renders as a
 * fixed-width track with a coloured fill, matching the dark elevated/accent
 * tokens used elsewhere in the app.
 */
export function EnergyBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = clamped * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={clamped}
      title={`Energy ${clamped.toFixed(2)}`}
      className="inline-block h-2 w-12 overflow-hidden rounded bg-elevated align-middle"
    >
      <div
        data-testid="energy-bar-fill"
        className="h-full rounded-l bg-accent"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
