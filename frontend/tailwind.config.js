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
          "orange-dark": "#B45309",
          "orange-light": "#FEF0E1",
          border: "#F0E3D5",
        },
        brand: {
          DEFAULT: "#F09A3E",
          dark: "#B45309",
          light: "#FEF4E8",
          page: "#FDF8F2",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', '"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
