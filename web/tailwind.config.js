/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette recovered from the original artifact
        navy: "#0A1931",
        "navy-2": "#112040",
        gold: "#C9A96E",
        "gold-dark": "#8B6F3E",
        cream: "#E8E6E1",
        "cream-2": "#F5F3EF",
        "cream-3": "#FAF9F6",
        warm: "#A8A29E",
        "warm-2": "#8A8A8A",
        "warm-3": "#6B6B6B",
        danger: "#DC2626",
      },
      fontFamily: {
        // Display / headings: Cinzel (fallback Trajan family) — used as "font-trajan" in the original
        trajan: ["Cinzel", "Trajan Pro", "Times New Roman", "serif"],
        display: ["Cinzel", "Trajan Pro", "Times New Roman", "serif"],
        // Body
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
