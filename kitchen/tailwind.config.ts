import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Consolas", "monospace"],
        chinese: ["Noto Sans SC", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#111111",
          raised: "#161616",
          border: "#1e1e1e",
          subtle: "#0d0d0d",
        },
        kitchen: {
          new: "#22c55e",
          accepted: "#f59e0b",
          cooking: "#3b82f6",
          ready: "#71717a",
          complete: "#3f3f46",
          cancelled: "#ef4444",
        },
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-amber": "glowAmber 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        glowAmber: {
          "0%": { boxShadow: "0 0 8px 0 rgba(245, 158, 11, 0.3)" },
          "100%": { boxShadow: "0 0 24px 4px rgba(245, 158, 11, 0.6)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-priority": "0 0 0 2px #f59e0b, 0 0 24px 4px rgba(245,158,11,0.35)",
        "card-urgent": "0 0 0 2px #ef4444, 0 0 20px 2px rgba(239,68,68,0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
