/** @type {import('tailwindcss').Config} */
export default {
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
      },
      fontFamily: {
        sans: ["'Outfit'", "'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        display: ["'Outfit'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
