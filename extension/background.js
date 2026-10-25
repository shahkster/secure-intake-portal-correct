// Google Voice only works in one tab at a time. Each time the CRM opens Voice to dial,
// close the Voice tab the CRM opened for the last call (never tabs you opened yourself).
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'crm-dial' || !sender.tab) return;
  const id = sender.tab.id;
  chrome.storage.session.get('gvTab').then(({ gvTab }) => {
    if (gvTab && gvTab !== id) chrome.tabs.remove(gvTab).catch(() => {});
    chrome.storage.session.set({ gvTab: id });
  });
});
