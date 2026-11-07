import type { Config } from "tailwindcss";
import preset from "@rootspun/config/tailwind";

export default {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    // shared UI package components
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
