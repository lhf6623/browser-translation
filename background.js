// ========== 快捷翻译 Background Service Worker ==========

// 只做一件事：接收快捷键 → 通知 content script
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'translate') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return;

    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleTranslation' });
    } catch {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleTranslation' });
      } catch { /* 受限页面 */ }
    }
  }
});
