import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0B0F17",
        panel: "#111725",
        panel2: "#0E1420",
        neon: {
          cyan: "#22D3EE",
          teal: "#2DD4BF",
          violet: "#A78BFA",
          amber: "#FBBF24",
          green: "#34D399",
          red: "#F87171",
        },
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(34, 211, 238, 0.35)",
        glowViolet: "0 0 24px -4px rgba(167, 139, 250, 0.35)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        radar: {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        radar: "radar 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
