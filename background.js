/* global chrome */

const DEFAULTS = {
  provider: 'mymemory',
};

function mapToMyMemoryCode(lang) {
  const l = (lang || '').toLowerCase();
  switch (l) {
    case 'zh':
    case 'zh-cn':
    case 'cn':
      return 'ZH-CN';
    case 'zh-tw':
      return 'ZH-TW';
    case 'en':
      return 'EN';
    case 'ja':
      return 'JA';
    case 'ko':
      return 'KO';
    case 'fr':
      return 'FR';
    case 'es':
      return 'ES';
    default:
      return (l || 'en').toUpperCase();
  }
}

function detectSourceLangSimple(text) {
  if (!text) return 'EN';
  // Basic script detection by Unicode ranges
  // CJK Unified Ideographs
  if (/[\u4E00-\u9FFF]/.test(text)) return 'ZH-CN';
  // Hiragana or Katakana
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'JA';
  // Hangul
  if (/[\uAC00-\uD7AF]/.test(text)) return 'KO';
  // Latin default
  return 'EN';
}

async function translateWithMyMemory(text, target) {
  const srcCode = detectSourceLangSimple(text);
  const tgtCode = mapToMyMemoryCode(target);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(srcCode + '|' + tgtCode)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText || '';
  return translated;
}

async function translateWithLibre(text, target) {
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
  try {
    return await translateWithMyMemory(text, target);
  } catch (e) {
    // Fallback to Libre on MyMemory errors (like invalid langpair)
    return await translateWithLibre(text, target);
  }
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
