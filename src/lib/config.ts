// API 密钥 —— 从构建时环境变量注入，通过 Vite 的 import.meta.env
// 开发时复制 .env.example → .env 并填入实际密钥

export const BD_APPID = import.meta.env.VITE_BD_APPID || "";
export const BD_KEY = import.meta.env.VITE_BD_KEY || "";

export const YD_APPKEY = import.meta.env.VITE_YD_APPKEY || "";
export const YD_SECRET = import.meta.env.VITE_YD_SECRET || "";

export const TX_SECRET_ID = import.meta.env.VITE_TX_SECRET_ID || "";
export const TX_SECRET_KEY = import.meta.env.VITE_TX_SECRET_KEY || "";
