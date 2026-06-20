import { defineConfig, presetMini, presetAttributify } from "unocss";
import presetRemToPx from "@unocss/preset-rem-to-px";

export default defineConfig({
  presets: [
    presetMini({ prefix: "qt-" }),
    presetAttributify(),
    presetRemToPx(),
  ],

  theme: {
    colors: {
      bg: "#1c1c1e",
      text: "#d1d1d6",
      sub: "#8e8e93",
      accent: "#f0935b",
      brand: "#d4526e",
      ok: "#30d158",
      fail: "#ff453a",
    },
    fontFamily: {
      mono: '"SF Mono", "Fira Code", "JetBrains Mono", monospace',
    },
  },

  shortcuts: {
    "qt-debug-shadow":
      "qt-shadow-[0_4px_24px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)]",
    "qt-card-shadow":
      "qt-shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)]",
    "qt-brand-shadow":
      "qt-shadow-[0_3px_12px_rgba(212,82,110,0.22)]",
    "qt-brand-gradient":
      "qt-bg-[linear-gradient(135deg,#f0935b,#d4526e)]",
  },

  safelist: [],
});
