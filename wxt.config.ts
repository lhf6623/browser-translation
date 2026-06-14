import { defineConfig } from "wxt";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  srcDir: "src",

  manifest: {
    name: "快捷翻译",
    description: "一键整页双语对照翻译。按快捷键翻译页面所有文字，沉浸在双语阅读中。",
    permissions: ["activeTab", "scripting", "storage"],
    host_permissions: [
      "https://clients5.google.com/*",
      "https://api.mymemory.translated.net/*",
      "https://translate.googleapis.com/*",
      "https://fanyi-api.baidu.com/*",
      "https://openapi.youdao.com/*",
      "https://tmt.tencentcloudapi.com/*",
    ],
    commands: {
      translate: {
        suggested_key: {
          default: "Ctrl+Shift+E",
          mac: "Ctrl+Shift+E",
        },
        description: "翻译整页为双语对照",
      },
    },
    browser_specific_settings: {
      gecko: {
        id: "quicktranslate@example.com",
      },
    },
  },

  // Vue SFC 支持
  vite: () => ({
    plugins: [vue()],
  }),

  // 不自动打开浏览器
  webExt: {
    disabled: true,
  },

  // 抑制 Firefox data_collection_permissions 警告
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
