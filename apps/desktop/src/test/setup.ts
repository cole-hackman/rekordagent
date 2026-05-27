import "@testing-library/jest-dom";
import { vi } from "vitest";

// jsdom doesn't run Tauri; stub the event API so hooks that subscribe to
// backend events (e.g. `playback-ended`) don't crash on mount.
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

// jsdom lacks ResizeObserver, which the canvas-based Waveform uses.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill })
    .ResizeObserver = ResizeObserverPolyfill;
}

// jsdom returns a 2D canvas context that's missing methods used by the
// canvas-based Waveform. Stub it out so component tests don't crash on
// mount. We bypass TS by going through `unknown`.
const canvasStub = {
  scale: () => {},
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  closePath: () => {},
  save: () => {},
  restore: () => {},
  setTransform: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  roundRect: () => {},
};
(
  HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }
).getContext = () => canvasStub;
