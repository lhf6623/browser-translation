import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 15_000,
    // 引擎测试需要真实 API，并行可能触发限流
    fileParallelism: false,
  },
  define: {
    "import.meta.env.VITE_BD_APPID": JSON.stringify(process.env.VITE_BD_APPID || ""),
    "import.meta.env.VITE_BD_KEY": JSON.stringify(process.env.VITE_BD_KEY || ""),
    "import.meta.env.VITE_YD_APPKEY": JSON.stringify(process.env.VITE_YD_APPKEY || ""),
    "import.meta.env.VITE_YD_SECRET": JSON.stringify(process.env.VITE_YD_SECRET || ""),
    "import.meta.env.VITE_TX_SECRET_ID": JSON.stringify(process.env.VITE_TX_SECRET_ID || ""),
    "import.meta.env.VITE_TX_SECRET_KEY": JSON.stringify(process.env.VITE_TX_SECRET_KEY || ""),
  },
});
