import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0d1931",
        inkSoft: "#162544",
        gold: "#d4a53f",
        parchment: "#f5efe2",
        mist: "#aab4c8",
        line: "#2b3c62",
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"],
        sans: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        panel: "0 24px 70px rgba(8, 18, 39, 0.28)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top, rgba(212,165,63,0.14), transparent 35%), radial-gradient(circle at left, rgba(126,144,178,0.16), transparent 28%)",
      },
    },
  },
  plugins: [],
};

export default config;
