// Legacy Comfort Dialer: when the CRM opens Google Voice with a number to call
// (the address ends in #crm-autodial), wait for Voice to load and press its Call button.
// It only presses Call when the number on screen matches the lead's number, and only once per dial.
(() => {
  if (!location.hash.includes('crm-autodial')) return;
  const m = location.search.match(/[?&]a=nc,([^&#]+)/);
  if (!m) return;
  const want = decodeURIComponent(m[1]).replace(/\D/g, '').slice(-10);
  if (want.length < 10) return;

  // Let the helper close the Voice tab from the last call, so only this one is open.
  try { chrome.runtime.sendMessage({ type: 'crm-dial' }); } catch (e) {}

  const started = Date.now();
  let done = false;
  const seen = (el) => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && el.getClientRects().length > 0;
  const digits = (s) => (s || '').replace(/\D/g, '');

  // The lead's number has to be showing somewhere on the page (in the dial box or the call panel).
  function numberShowing() {
    for (const i of document.querySelectorAll('input')) if (digits(i.value).endsWith(want)) return true;
    return digits(document.body ? document.body.innerText : '').includes(want);
  }

  function callButton() {
    const all = document.querySelectorAll('button, [role="button"]');
    for (const b of all) {
      const name = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').trim();
      if (/^call$/i.test(name) && seen(b)) return b;
    }
    for (const b of all) {
      const name = (b.getAttribute('aria-label') || '').trim();
      if (/^call\b/i.test(name) && !/history|log|forward|settings|end|hang/i.test(name) && seen(b)) return b;
    }
    return null;
  }

  function tick() {
    if (done) return;
    if (Date.now() - started > 25000) return stop();
    if (!document.body || !numberShowing()) return;
    const b = callButton();
    if (!b) return;
    done = true;
    stop();
    setTimeout(() => b.click(), 350);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }

  let obs = null;
  const iv = setInterval(tick, 400);
  function stop() { clearInterval(iv); if (obs) obs.disconnect(); }
  const watch = () => { obs = new MutationObserver(tick); obs.observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();
