<script setup lang="ts">
import { ref, onMounted } from "vue";
import { browser } from "wxt/browser";

const SHORTCUT_URL =
  import.meta.env.BROWSER === "firefox"
    ? "about:addons"
    : "chrome://extensions/shortcuts";

// ---- 快捷键 ----

const shortcutKeys = ref<string[]>([]);

onMounted(async () => {
  try {
    const commands = await browser.commands.getAll();
    const cmd = commands.find((c) => c.name === "translate");
    if (cmd?.shortcut) {
      // 有些平台用 "+" 分隔，有些直接拼接（如 Mac "⌘E"）
      shortcutKeys.value = cmd.shortcut.includes("+")
        ? cmd.shortcut.split("+").map((k) => k.trim())
        : [...cmd.shortcut];
    }
  } catch {
    /* ignore */
  }
});

function openShortcuts() {
  browser.tabs.create({ url: SHORTCUT_URL });
}

// ---- 调试开关 ----

const debugEnabled = ref(false);

onMounted(async () => {
  const { debugEnabled: stored } = await browser.storage.local.get("debugEnabled");
  debugEnabled.value = !!stored;
});

function toggleDebug(val: boolean) {
  browser.storage.local.set({ debugEnabled: val });
}

// ---- 清空缓存 ----

const cacheLabel = ref("清空缓存");

async function clearCache() {
  const all = await browser.storage.local.get();
  const keys = Object.keys(all).filter((k) => k.startsWith("qt_"));
  if (keys.length) await browser.storage.local.remove(keys);
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    browser.tabs.sendMessage(tab.id, { action: "clearCache" }).catch(() => {});
  }
  cacheLabel.value = "已清空";
  setTimeout(() => (cacheLabel.value = "清空缓存"), 1500);
}
</script>

<template>
  <div class="header">
    <div class="brand">
      <div class="brand-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
          stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 7h10v10" />
          <path d="M7 17 17 7" />
        </svg>
      </div>
      <div class="brand-text">
        <h1>快捷翻译</h1>
        <p>英 → 中 · 整页对照</p>
      </div>
    </div>
    <span class="version">v1.0</span>
  </div>

  <div class="shortcut-card">
    <div class="keys">
      <template v-for="(key, i) in shortcutKeys" :key="i">
        <span v-if="i > 0" class="plus">+</span>
        <kbd>{{ key }}</kbd>
      </template>
    </div>
    <div class="tip-line">按一次翻译，再按一次还原</div>
  </div>

  <div class="debug-row">
    <span>调试面板</span>
    <label class="switch">
      <input type="checkbox" :checked="debugEnabled" @change="toggleDebug(($event.target as HTMLInputElement).checked)" />
      <span class="slider"></span>
    </label>
  </div>

  <div class="footer">
    <a href="#" class="footer-link" @click.prevent="openShortcuts">
      自定义快捷键
    </a>
    <a href="#" class="footer-link footer-link--secondary" @click.prevent="clearCache">
      {{ cacheLabel }}
    </a>
  </div>
</template>

<style scoped>
.header {
  padding: 10px 20px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #f0935b, #d4526e);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 3px 12px rgba(212, 82, 110, 0.22);
}
.brand-text h1 {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.brand-text p {
  font-size: 11px;
  color: #999;
  margin-top: 1px;
}
.version {
  font-size: 11px;
  color: #c7c7cc;
  font-weight: 500;
}

.shortcut-card {
  margin: 10px 20px;
  background: #fff;
  border-radius: 10px;
  padding: 16px 16px 16px 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 6px 16px rgba(0, 0, 0, 0.04);
  text-align: center;
}
.keys {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex-wrap: wrap;
}
.plus {
  font-size: 12px;
  font-weight: 500;
  color: #c7c7cc;
  user-select: none;
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 26px;
  padding: 0 8px;
  background: rgba(212, 82, 110, 0.07);
  border: 1px solid rgba(212, 82, 110, 0.18);
  border-bottom: 2px solid rgba(212, 82, 110, 0.25);
  border-radius: 5px;
  font-family: "SF Mono", "Fira Code", "Menlo", monospace;
  font-size: 12px;
  font-weight: 600;
  color: #d4526e;
  white-space: nowrap;
}
.tip-line {
  font-size: 12px;
  color: #999;
  margin-top: 10px;
}

.debug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 20px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #efece5;
  transition: border-color 0.2s;
}
.debug-row:hover {
  border-color: rgba(212, 82, 110, 0.15);
}
.debug-row span {
  font-size: 12px;
  color: #86868b;
}
.switch {
  position: relative;
  width: 40px;
  height: 23px;
  flex-shrink: 0;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  inset: 0;
  background: #e0ddd6;
  border-radius: 23px;
  cursor: pointer;
  transition: background 0.25s;
}
.slider::before {
  content: "";
  position: absolute;
  width: 17px;
  height: 17px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.25s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
input:checked + .slider {
  background: #d4526e;
}
input:checked + .slider::before {
  transform: translateX(17px);
}

.footer {
  padding: 10px 20px 10px;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}
.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #d4526e;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 16px;
  background: rgba(212, 82, 110, 0.06);
  transition: all 0.2s;
}
.footer-link:hover {
  background: rgba(212, 82, 110, 0.12);
}
.footer-link--secondary {
  background: transparent;
  color: #86868b;
}
.footer-link--secondary:hover {
  background: rgba(134, 134, 139, 0.08);
}
.footer-link svg {
  width: 13px;
  height: 13px;
  transition: transform 0.2s;
}
.footer-link:hover svg {
  transform: translateX(2px);
}
</style>
