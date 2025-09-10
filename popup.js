const els = {
  src: document.getElementById('src'),
  dst: document.getElementById('dst'),
  lang: document.getElementById('lang'),
  translate: document.getElementById('translate'),
  copy: document.getElementById('copy'),
  speak: document.getElementById('speak'),
  options: document.getElementById('options')
};
const STATE = { targetLang: 'zh', provider: 'mymemory' };

function load() {
  chrome.storage.sync.get({ targetLang: 'zh', provider: 'mymemory' }, (items) => {
    STATE.targetLang = items.targetLang;
    STATE.provider = items.provider;
    els.lang.textContent = items.targetLang.toUpperCase();
  });
}

async function doTranslate() {
  const text = els.src.value.trim();
  if (!text) return;
  els.dst.value = '翻译中…';
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'qt.translate',
      payload: { text, target: STATE.targetLang, provider: STATE.provider }
    });
    if (resp && resp.ok) {
      els.dst.value = resp.data.translation;
    } else {
      els.dst.value = '翻译失败: ' + (resp?.error || '未知错误');
    }
  } catch (e) {
    els.dst.value = '翻译失败: ' + String(e);
  }
}

function pickVoiceForLang(targetLang) {
  const voices = window.speechSynthesis.getVoices() || [];
  const langLower = String(targetLang || '').toLowerCase();
  // Try exact lang match first
  let voice = voices.find(v => v.lang && v.lang.toLowerCase() === langLower);
  if (voice) return voice;
  // For zh, try zh-CN / zh-TW
  if (langLower === 'zh') {
    voice = voices.find(v => /zh\-cn/i.test(v.lang)) || voices.find(v => /zh/i.test(v.lang));
    if (voice) return voice;
  }
  // Fallback by prefix
  voice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langLower + '-'));
  if (voice) return voice;
  // Final fallback: any default voice
  return voices[0] || null;
}

function speak(text, targetLang) {
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoiceForLang(targetLang);
  if (voice) utter.voice = voice;
  // map simple codes to BCP-47 tags
  const langTagMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', es: 'es-ES' };
  utter.lang = langTagMap[targetLang] || targetLang || 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

els.translate.addEventListener('click', doTranslate);
els.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(els.dst.value); } catch {}
});
els.speak.addEventListener('click', () => {
  speak(els.dst.value.trim(), STATE.targetLang);
});
els.options.addEventListener('click', () => chrome.runtime.openOptionsPage());

// Try to read selection from active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;
  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => window.getSelection()?.toString() || ''
  }, (results) => {
    const val = results && results[0] && results[0].result;
    if (val && !els.src.value) {
      els.src.value = val;
    }
  });
});

// Some browsers populate voices asynchronously
if (typeof window.speechSynthesis !== 'undefined') {
  window.speechSynthesis.onvoiceschanged = () => {};
}

load();
