import type { Config } from "tailwindcss";

/** rgb(var(--token) / <alpha-value>) — enables Tailwind opacity modifiers */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Instrument Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "IBM Plex Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        base: v("bg-base"),
        surface: v("bg-surface"),
        elevated: v("bg-elevated"),
        hover: v("bg-hover"),
        edge: {
          subtle: v("border-subtle"),
          DEFAULT: v("border-default"),
          strong: v("border-strong"),
        },
        ink: {
          DEFAULT: v("text-primary"),
          secondary: v("text-secondary"),
          muted: v("text-muted"),
          faint: v("text-faint"),
        },
        accent: {
          DEFAULT: v("accent"),
          hover: v("accent-hover"),
          strong: v("accent-strong"),
          dim: v("accent-dim"),
        },
        status: {
          ok: v("status-ok"),
          warn: v("status-warn"),
          error: v("status-error"),
          info: v("status-info"),
        },
      },
      transitionDuration: {
        80: "80ms",
        120: "120ms",
        150: "150ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
