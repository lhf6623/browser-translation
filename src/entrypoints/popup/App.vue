<script setup lang="ts">
import { ref, onMounted } from "vue";
import { browser } from "wxt/browser";

const isDev = import.meta.env.DEV;

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

// ---- 调试开关 — 仅开发阶段生效 ----

const debugEnabled = ref(false);

if (import.meta.env.DEV) {
  onMounted(async () => {
    const { debugEnabled: stored } = await browser.storage.local.get("debugEnabled");
    debugEnabled.value = !!stored;
  });
}

function toggleDebug(val: boolean) {
  if (import.meta.env.DEV) browser.storage.local.set({ debugEnabled: val });
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
  <!-- header -->
  <div class="qt-pt-2.5 qt-px-5 qt-flex qt-items-center qt-justify-between">
    <div class="qt-flex qt-items-center qt-gap-2.5">
      <div class="qt-brand-gradient qt-brand-shadow qt-w-9 qt-h-9 qt-rounded-[10px] qt-flex qt-items-center qt-justify-center qt-text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
          stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 7h10v10" />
          <path d="M7 17 17 7" />
        </svg>
      </div>
      <div>
        <h1 class="qt-text-[17px] qt-font-bold qt-tracking-tight">快捷翻译</h1>
        <p class="qt-text-[11px] qt-text-[#999] qt-mt-px">英 → 中 · 整页对照</p>
      </div>
    </div>
    <span class="qt-text-[11px] qt-text-[#c7c7cc] qt-font-medium">v1.0</span>
  </div>

  <!-- shortcut card -->
  <div class="qt-mx-5 qt-my-2.5 qt-bg-white qt-rounded-[10px] qt-py-4 qt-pl-3.5 qt-pr-4 qt-text-center qt-card-shadow">
    <div class="qt-flex qt-items-center qt-justify-center qt-gap-[5px] qt-flex-wrap">
      <template v-for="(key, i) in shortcutKeys" :key="i">
        <span v-if="i > 0" class="qt-text-[12px] qt-font-medium qt-text-[#c7c7cc] qt-select-none">+</span>
        <kbd class="qt-inline-flex qt-items-center qt-justify-center qt-min-w-[30px] qt-h-[26px] qt-px-2 qt-bg-brand/7 qt-border qt-border-brand/18 qt-border-b-2 qt-border-b-brand/25 qt-rounded-[5px] qt-font-mono qt-text-[12px] qt-font-semibold qt-text-brand qt-whitespace-nowrap">{{ key }}</kbd>
      </template>
    </div>
    <div class="qt-text-[12px] qt-text-[#999] qt-mt-2.5">按一次翻译，再按一次还原</div>
  </div>

  <!-- debug toggle — 仅开发阶段可见 -->
   <div v-if="isDev" class="qt-flex qt-items-center qt-justify-between qt-mx-5 qt-py-2.5 qt-px-3.5 qt-rounded-[10px] qt-bg-white qt-border qt-border-[#efece5] hover:qt-border-brand/15 qt-transition-colors qt-duration-200">
    <span class="qt-text-[12px] qt-text-[#86868b]">调试面板</span>
    <label class="switch qt-relative qt-w-10 qt-h-[23px] qt-shrink-0">
      <input type="checkbox" :checked="debugEnabled" @change="toggleDebug(($event.target as HTMLInputElement).checked)" />
      <span class="slider"></span>
    </label>
  </div>

  <!-- footer -->
  <div class="qt-py-2.5 qt-px-5 qt-flex qt-justify-between qt-gap-2">
    <a
      href="#"
      class="qt-inline-flex qt-items-center qt-gap-1 qt-text-[11px] qt-font-medium qt-text-brand qt-no-underline qt-py-1.5 qt-px-3 qt-rounded-[16px] qt-bg-brand/6 hover:qt-bg-brand/12 qt-transition-all qt-duration-200"
      @click.prevent="openShortcuts"
    >
      {{ !shortcutKeys.length ? '快捷键无效？自定义修改' : '设置快捷键' }}
    </a>
    <a
      href="#"
      class="qt-inline-flex qt-items-center qt-gap-1 qt-text-[11px] qt-font-medium qt-text-[#86868b] qt-no-underline qt-py-1.5 qt-px-3 qt-rounded-[16px] qt-bg-transparent hover:qt-bg-[#86868b]/8 qt-transition-all qt-duration-200"
      @click.prevent="clearCache"
    >
      {{ cacheLabel }}
    </a>
  </div>
</template>

<style scoped>
/* toggle switch — 伪元素复杂，保留在 scoped 中 */
.switch { position: relative; }
.switch input { opacity: 0; width: 0; height: 0; }
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
</style>
