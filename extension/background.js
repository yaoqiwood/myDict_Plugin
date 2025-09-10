/* global chrome */

const DEFAULTS = {
  provider: 'mymemory',
};

async function translateWithMyMemory(text, target) {
  // Use auto source, format plain
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent('auto|' + target)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText || '';
  return translated;
}

async function translateWithLibre(text, target) {
  // Public demo server, may rate limit; use as fallback
  const res = await fetch('https://libretranslate.de/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'auto', target, format: 'text' })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.translatedText || '';
}

async function doTranslate({ text, target, provider }) {
  const chosen = provider || DEFAULTS.provider;
  if (chosen === 'libre') return translateWithLibre(text, target);
  return translateWithMyMemory(text, target);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'qt.translate') {
    const { text, target, provider } = message.payload || {};
    doTranslate({ text, target, provider })
      .then((translation) => sendResponse({ ok: true, data: { translation } }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true; // async
  }
  if (message?.type === 'qt.command.translate-selection') {
    // forwarded to content scripts via tabs messaging if needed
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'translate-selection') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: 'qt.command.translate-selection' });
      }
    } catch (e) {
      // ignore
    }
  }
});
