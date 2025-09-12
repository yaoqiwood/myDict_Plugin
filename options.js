const els = {
  theme: document.getElementById('theme'),
  lang: document.getElementById('lang'),
  provider: document.getElementById('provider'),
  showMarker: document.getElementById('showMarker'),
  deepseekSection: document.getElementById('deepseek-config'),
  deepseekKey: document.getElementById('deepseekKey'),
  deepseekBase: document.getElementById('deepseekBase'),
  save: document.getElementById('save'),
  msg: document.getElementById('msg')
};

function toggleDeepseekSection() {
  els.deepseekSection.style.display = els.provider.value === 'deepseek' ? 'block' : 'none';
}

function load() {
  chrome.storage.sync.get({ theme: 'light', targetLang: 'zh', provider: 'mymemory', showMarker: false, deepseekKey: '', deepseekBase: '' }, (items) => {
    els.theme.value = items.theme;
    els.lang.value = items.targetLang;
    els.provider.value = items.provider;
    els.showMarker.checked = !!items.showMarker;
    els.deepseekKey.value = items.deepseekKey || '';
    els.deepseekBase.value = items.deepseekBase || '';
    toggleDeepseekSection();
  });
}

function save() {
  chrome.storage.sync.set({
    theme: els.theme.value,
    targetLang: els.lang.value,
    provider: els.provider.value,
    showMarker: !!els.showMarker.checked,
    deepseekKey: els.deepseekKey.value || '',
    deepseekBase: els.deepseekBase.value || ''
  }, () => {
    els.msg.style.display = 'inline';
    setTimeout(() => els.msg.style.display = 'none', 1000);
  });
}

els.provider.addEventListener('change', toggleDeepseekSection);
els.save.addEventListener('click', save);
load();
