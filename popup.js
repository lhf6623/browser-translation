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
      const keys = cmd.shortcut.split('+');
      const el = document.getElementById('shortcutKey');
      el.innerHTML = keys.map(k => `<kbd>${k}</kbd>`).join(' + ');
    }
  } catch { /* ignore */ }
})();
