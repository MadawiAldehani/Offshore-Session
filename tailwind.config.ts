import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Offshore palette — deep sea navy through to instrument-panel accents.
        abyss: "#04070f",
        deep: "#071227",
        sea: "#0d1f3a",
        hull: "#0f1f3d",
        steel: "#1b3556",
        amber: {
          DEFAULT: "#ffb020",
          bright: "#ffc94d",
          deep: "#c47a00",
        },
        cyan: {
          DEFAULT: "#22d3ee",
          bright: "#67e8f9",
          deep: "#0e7490",
        },
      },
      fontFamily: {
        // System stack keeps the demo dependency-free and instant to load.
        display: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        "wave-drift": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.82)" },
          "60%": { opacity: "1", transform: "scale(1.04)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pin-land": {
          "0%": { opacity: "0", transform: "scale(2.4)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(1.04)" },
        },
        "drop-line": {
          "0%": { transform: "scaleY(0)", opacity: "0" },
          "100%": { transform: "scaleY(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slow-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "radar-ping": {
          "0%": { transform: "scale(0.35)", opacity: "0.55" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
      },
      animation: {
        "wave-drift-slow": "wave-drift 18s linear infinite",
        "wave-drift-fast": "wave-drift 11s linear infinite",
        "fade-up": "fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "pin-land": "pin-land 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-ring": "pulse-ring 0.6s ease-in-out infinite",
        "drop-line": "drop-line 0.7s cubic-bezier(0.34,1.56,0.64,1) both",
        shimmer: "shimmer 2.4s linear infinite",
        "slow-spin": "slow-spin 24s linear infinite",
        "radar-sweep": "radar-sweep 4.5s linear infinite",
        "radar-ping": "radar-ping 3s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
