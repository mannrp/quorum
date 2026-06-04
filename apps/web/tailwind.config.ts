import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--text-app)",
        accent: "var(--accent-app)",
        surface: "var(--surface-app)",
        border: "var(--border-app)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      }
    }
  },
  plugins: []
};

export default config;
