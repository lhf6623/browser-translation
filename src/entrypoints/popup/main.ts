// ========== 快捷翻译 Popup ==========

import { browser } from "wxt/browser";

// 快捷键设置链接
const SHORTCUT_URL = import.meta.env.BROWSER === "firefox"
  ? "about:addons"
  : "chrome://extensions/shortcuts";

document.getElementById("shortcutsLink")!.addEventListener("click", (e) => {
  e.preventDefault();
  browser.tabs.create({ url: SHORTCUT_URL });
});

// 显示当前快捷键
(async () => {
  try {
    const commands = await browser.commands.getAll();
    const cmd = commands.find((c) => c.name === "translate");
    if (cmd?.shortcut) {
      const el = document.getElementById("shortcutKey")!;
      if (cmd.shortcut.includes("+")) {
        const keys = cmd.shortcut.split("+").map((k) => k.trim());
        el.innerHTML = keys
          .map((k) => `<kbd>${k}</kbd>`)
          .join(" <span>+</span> ");
      } else {
        el.innerHTML = [...cmd.shortcut]
          .map((k) => `<kbd>${k}</kbd>`)
          .join(" <span>+</span> ");
      }
    }
  } catch {
    /* ignore */
  }
})();

// 调试面板开关
(async () => {
  const toggle = document.getElementById("debugToggle") as HTMLInputElement;
  const { debugEnabled } = await browser.storage.local.get("debugEnabled");
  toggle.checked = !!debugEnabled;
  toggle.addEventListener("change", () => {
    browser.storage.local.set({ debugEnabled: toggle.checked });
  });
})();

// 清空缓存
document.getElementById("clearCache")!.addEventListener("click", async (e) => {
  e.preventDefault();
  // 清持久缓存
  const all = await browser.storage.local.get();
  const keys = Object.keys(all).filter((k) => k.startsWith("qt_"));
  if (keys.length) await browser.storage.local.remove(keys);
  // 清内存缓存
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    browser.tabs.sendMessage(tab.id, { action: "clearCache" }).catch(() => {});
  }
  // 视觉反馈
  const btn = e.target as HTMLAnchorElement;
  btn.textContent = "已清空";
  setTimeout(() => {
    btn.textContent = "清空缓存";
  }, 1500);
});
