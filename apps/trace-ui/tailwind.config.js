const animatePlugin = require("tailwindcss-animate");

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5f5",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          850: "#151e2e",
          900: "#0f172a",
          950: "#020617"
        },
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669"
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309"
        },
        blue: {
          50: "#eff6ff",
          600: "#2563eb"
        },
        rose: {
          50: "#fff1f2",
          100: "#ffe4e6",
          500: "#f43f5e",
          700: "#be123c"
        },
        green: {
          100: "#dcfce7",
          700: "#15803d"
        },
        cyan: {
          400: "#22d3ee",
          500: "#06b6d4"
        },
        indigo: {
          500: "#6366f1"
        },
        brand: {
          50: "#f0f6ff",
          100: "#dce8ff",
          200: "#b4ceff",
          300: "#86b0ff",
          400: "#4d88ff",
          500: "#215ffd",
          600: "#0b46e4",
          700: "#0434b3",
          800: "#082983",
          900: "#0b2861"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"]
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 300ms ease-out"
      },
      boxShadow: {
        brand: "0 15px 40px -20px rgba(33, 95, 253, 0.65)"
      }
    }
  },
  plugins: [animatePlugin]
};

module.exports = config;
