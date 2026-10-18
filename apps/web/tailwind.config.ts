import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: "#171717", paper: "#f7f6f2", coral: "#ff583d", acid: "#d8ff57" } } },
  plugins: []
} satisfies Config;

