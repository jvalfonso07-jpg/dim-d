import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a", // Deep black
        surface: "#0f0f0f",     // Slightly lighter black for cards
        gold: "#d4af37",        // The Speakeasy Gold
        "gold-dim": "#8a7e57",  // Muted gold for secondary text
        border: "#2a2a2a",      // Subtle borders
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;