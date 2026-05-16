import type {Config} from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        asphalt: "#111827",
        safety: "#f97316",
        dock: "#0f766e"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(15, 118, 110, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;