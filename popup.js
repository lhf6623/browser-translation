// 快捷键设置链接
document.getElementById('shortcutsLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// 显示当前快捷键
(async () => {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find(c => c.name === 'translate');
    if (cmd && cmd.shortcut) {
      const el = document.getElementById('shortcutKey');
      const isMac = navigator.platform.includes('Mac');
      const keys = isMac ? [...cmd.shortcut] : cmd.shortcut.split('+').map(k => k.trim());
      el.innerHTML = keys.map(k => `<kbd>${k}</kbd>`).join(' <span>+</span> ');
    }
  } catch { /* ignore */ }
})();

// 调试面板开关
(async () => {
  const toggle = document.getElementById('debugToggle');
  const { debugEnabled } = await chrome.storage.local.get('debugEnabled');
  toggle.checked = !!debugEnabled;
  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ debugEnabled: toggle.checked });
  });
})();

// 清空缓存
document.getElementById('clearCache').addEventListener('click', async (e) => {
  e.preventDefault();
  // 清持久缓存
  const all = await chrome.storage.local.get();
  const keys = Object.keys(all).filter(k => k.startsWith('qt_'));
  if (keys.length) await chrome.storage.local.remove(keys);
  // 清内存缓存
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'clearCache' }).catch(() => {});
  }
  // 视觉反馈
  const btn = e.target;
  btn.textContent = '已清空';
  setTimeout(() => { btn.textContent = '清空缓存'; }, 1500);
});
