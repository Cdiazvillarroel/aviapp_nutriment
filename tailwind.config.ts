import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map to CSS variables defined in app/globals.css.
        // This way you can use Tailwind utility classes (e.g. bg-green-800)
        // and the actual color comes from one source of truth.
        green: {
          50:  "var(--green-50)",
          100: "var(--green-100)",
          500: "var(--green-500)",
          600: "var(--green-600)",
          700: "var(--green-700)",
          800: "var(--green-800)",
          900: "var(--green-900)",
        },
        orange: {
          100: "var(--orange-100)",
          500: "var(--orange-500)",
          600: "var(--orange-600)",
        },
        bg:        "var(--bg)",
        surface:   "var(--surface)",
        "surface-2": "var(--surface-2)",
        border:    "var(--border)",
        "border-strong": "var(--border-strong)",
        divider:   "var(--divider)",
        text:      "var(--text)",
        "text-2":  "var(--text-2)",
        "text-3":  "var(--text-3)",
        "text-inv":"var(--text-inv)",
        ok:        "var(--ok)",
        "ok-bg":   "var(--ok-bg)",
        warn:      "var(--warn)",
        "warn-bg": "var(--warn-bg)",
        bad:       "var(--bad)",
        "bad-bg":  "var(--bad-bg)",
        info:      "var(--info)",
        "info-bg": "var(--info-bg)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans:    ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono:    ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
