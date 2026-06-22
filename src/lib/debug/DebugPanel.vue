<script setup lang="ts">
import { ref } from "vue";
import { dbgState } from "./state";

const collapsed = ref(false);

const engineKeys = Object.keys(dbgState.engines);

function statusIcon(s: string): string {
  switch (s) {
    case "ok": return "✓";
    case "fail": return "✗";
    case "cache": return "↻";
    default: return "";
  }
}

function statusColor(s: string): string {
  switch (s) {
    case "ok": return "qt-text-ok";
    case "fail": return "qt-text-fail";
    case "cache": return "qt-text-accent";
    default: return "qt-text-ok";
  }
}
</script>

<template>
  <div v-if="dbgState.enabled" id="qt-debug-panel"
    class="qt-skip qt-fixed qt-bottom-4 qt-right-4 qt-z-[2147483646] qt-bg-bg qt-text-text qt-font-mono qt-text-[11px] qt-leading-[1.5] qt-rounded-[10px] qt-py-3 qt-px-[14px] qt-w-[390px] qt-pointer-events-auto qt-select-none qt-debug-shadow">
    <!-- title -->
    <div
      class="qt-group qt-flex qt-justify-between qt-items-center qt-pb-2 qt-mb-1.5 qt-border-b qt-border-white/8 qt-text-accent qt-font-bold qt-text-[12px] qt-cursor-pointer"
      @click="collapsed = !collapsed">
      <span>快捷翻译 Debug</span>
      <span class="qt-text-[14px] qt-leading-none qt-opacity-40 group-hover:qt-opacity-100 qt-transition-opacity qt-duration-200">
        {{ collapsed ? "+" : "—" }}
      </span>
    </div>

    <!-- body -->
    <div v-show="!collapsed">
      <!-- stats -->
      <div class="qt-flex qt-items-center qt-justify-between qt-flex-wrap qt-gap-x-1.5 qt-mb-1.5 qt-text-sub qt-whitespace-nowrap">
        <span class="qt-flex qt-items-center">
          请求 <b class="qt-text-text">{{ dbgState.total }}</b>
        </span>
        <template v-for="e in engineKeys" :key="e">
          <span>
            <b class="qt-text-sub qt-mr-px">{{ e }}</b>
            <b class="qt-text-ok">{{ dbgState.engines[e].ok }}</b>/<b class="qt-text-fail">{{ dbgState.engines[e].fail }}</b>
          </span>
        </template>
        <span class="qt-flex qt-items-center qt-text-accent">缓存 {{ dbgState.cacheHit }}</span>
      </div>

      <!-- log -->
      <div class="qt-dbg-log qt-flex qt-flex-col qt-max-h-[200px] qt-overflow-y-auto qt-overflow-x-hidden qt-text-[10px] qt-text-sub">
        <div v-for="(l, i) in dbgState.logs" :key="i"
          :class="['qt-flex qt-items-center qt-gap-x-1 qt-py-0.5 qt-border-b qt-border-white/8 qt-min-w-0', statusColor(l.status)]"
          :title="l.text">
          <span :class="statusColor(l.status)">{{ statusIcon(l.status) }}</span>
          <span v-if="l.engine" class="qt-shrink-0 qt-text-sub">{{ l.engine }}</span>
          <span class="qt-truncate">{{ l.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* scrollbar 只能用伪元素，保留在 scoped CSS 中 */
.qt-dbg-log {
  scrollbar-width: thin;
  scrollbar-color: #3a3a3c #1c1c1e;
}

.qt-dbg-log::-webkit-scrollbar {
  width: 4px;
}

.qt-dbg-log::-webkit-scrollbar-track {
  background: #1c1c1e;
}

.qt-dbg-log::-webkit-scrollbar-thumb {
  background: #3a3a3c;
  border-radius: 2px;
}
</style>
