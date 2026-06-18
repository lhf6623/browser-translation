<script setup lang="ts">
import { ref } from "vue";
import { dbgState } from "./index";

const collapsed = ref(false);
</script>

<template>
  <div v-if="dbgState.enabled" id="qt-debug-panel" class="qt-skip">
    <div class="qt-dbg-title" @click="collapsed = !collapsed">
      <span>快捷翻译 Debug</span>
      <span class="qt-dbg-toggle">{{ collapsed ? "+" : "—" }}</span>
    </div>
    <div v-show="!collapsed" class="qt-dbg-body">
      <div class="qt-dbg-stats">
        <span>请求 <b>{{ dbgState.total }}</b></span>
        <span class="ok">MM {{ dbgState.mymemory }}</span>
        <span class="warn">GT {{ dbgState.google }}</span>
        <span class="bd">BD {{ dbgState.baidu }}</span>
        <span class="yd">YD {{ dbgState.youdao }}</span>
        <span class="tx">TX {{ dbgState.tencent }}</span>
        <span class="err">✗ {{ dbgState.fail }}</span>
        <span class="cache">缓存 {{ dbgState.cacheHit }}</span>
      </div>
      <div class="qt-dbg-log">
        <div
          v-for="(l, i) in dbgState.logs"
          :key="i"
          :class="'line ' + (l.fail ? 'err' : l.cache ? 'cache' : l.engine.toLowerCase())"
          :title="l.text"
        >
          {{ l.fail ? "✗" : l.cache ? "↻" : "✓" }}
          {{ l.engine }} {{ l.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#qt-debug-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 2147483646;
  background: #1c1c1e;
  color: #d1d1d6;
  font: 11px/1.5 "SF Mono", "Fira Code", "JetBrains Mono", monospace;
  border-radius: 10px;
  padding: 12px 14px;
  width: 390px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06);
  pointer-events: auto;
  user-select: none;
}
.qt-dbg-title {
  color: #f0935b;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.qt-dbg-toggle {
  color: #f0935b;
  font-size: 14px;
  line-height: 1;
  opacity: 0.4;
  transition: opacity 0.2s;
}
.qt-dbg-title:hover .qt-dbg-toggle {
  opacity: 1;
}
.qt-dbg-stats {
  margin-bottom: 6px;
  color: #8e8e93;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
}
.qt-dbg-stats span {
  white-space: nowrap;
}
.qt-dbg-stats .ok {
  color: #30d158;
}
.qt-dbg-stats .warn {
  color: #ff9f0a;
}
.qt-dbg-stats .err {
  color: #ff453a;
}
.qt-dbg-stats .bd {
  color: #5e9eff;
}
.qt-dbg-stats .yd {
  color: #ff6b7a;
}
.qt-dbg-stats .tx {
  color: #64d2ff;
}
.qt-dbg-stats .cache {
  color: #f0935b;
}
.qt-dbg-log {
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 10px;
  color: #8e8e93;
  display: flex;
  flex-direction: column;
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
.qt-dbg-log .line {
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qt-dbg-log .line.mm {
  color: #30d158;
}
.qt-dbg-log .line.gt {
  color: #ff9f0a;
}
.qt-dbg-log .line.bd {
  color: #5e9eff;
}
.qt-dbg-log .line.yd {
  color: #ff6b7a;
}
.qt-dbg-log .line.tx {
  color: #64d2ff;
}
.qt-dbg-log .line.err {
  color: #ff453a;
}
.qt-dbg-log .line.cache {
  color: #f0935b;
}
</style>
