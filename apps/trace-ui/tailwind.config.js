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
