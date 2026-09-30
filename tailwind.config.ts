import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces (dark-first)
        bg: "#000000",
        surface: "#0a0a0a",
        elevated: "#111111",
        line: "#262626",
        lineSoft: "#1a1a1a",
        // Texto
        ink: "#ededed",
        muted: "#a1a1a1",
        faint: "#707070",
        // Brand — black & white (Vercel style): the accent is white itself
        brand: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#ededed",
          300: "#e5e5e5",
          400: "#d4d4d4",
          500: "#ffffff",
          600: "#a3a3a3",
          700: "#737373",
          800: "#404040",
          900: "#262626",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        masthead: ["var(--font-masthead)", "Georgia", "serif"],
        art: ["var(--font-art)", "Poppins", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6)",
        glow: "0 0 0 1px rgba(255,255,255,.3), 0 8px 30px -8px rgba(255,255,255,.12)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in .18s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
