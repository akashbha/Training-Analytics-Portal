/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        axtroid: {
          black: "#1C1B17",
          charcoal: "#272520",
          peach: "#FBD1A7",
          "peach-light": "#FEF4E8",
          sand: "#FDF8F2",
          orange: "#F09A3E",
          "orange-dark": "#D97718",
          "orange-light": "#FEF0E1",
          border: "#F0E3D5",
        },
        brand: {
          DEFAULT: "#F09A3E",
          dark: "#D97718",
          light: "#FEF4E8",
          page: "#FDF8F2",
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
