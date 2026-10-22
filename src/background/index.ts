chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    pirates_v2_initialized: true,
    pirates_v2_installed_at: new Date().toISOString()
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING_BACKGROUND') {
    sendResponse({ status: 'OK', workerTime: new Date().toISOString() });
    return false;
  }
  return false;
});
