/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#EFF6FF",
          page: "#F8FAFC",
        },
        dark: {
          bg: "#0D0B18",
          card: "#181427",
          surface: "#211B35",
          border: "#2E2648",
          muted: "#948FB0",
        },
      },
      fontFamily: {
        sans: ["'Outfit'", "'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        display: ["'Outfit'", "sans-serif"],
      },
      boxShadow: {
        "glow-brand": "0 0 25px -5px rgba(91, 63, 168, 0.4)",
      },
    },
  },
  plugins: [],
};
