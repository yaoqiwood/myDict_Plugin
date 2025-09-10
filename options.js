const els = {
  theme: document.getElementById('theme'),
  lang: document.getElementById('lang'),
  provider: document.getElementById('provider'),
  showMarker: document.getElementById('showMarker'),
  save: document.getElementById('save'),
  msg: document.getElementById('msg')
};

function load() {
  chrome.storage.sync.get({ theme: 'light', targetLang: 'zh', provider: 'mymemory', showMarker: false }, (items) => {
    els.theme.value = items.theme;
    els.lang.value = items.targetLang;
    els.provider.value = items.provider;
    els.showMarker.checked = !!items.showMarker;
  });
}

function save() {
  chrome.storage.sync.set({ theme: els.theme.value, targetLang: els.lang.value, provider: els.provider.value, showMarker: !!els.showMarker.checked }, () => {
    els.msg.style.display = 'inline';
    setTimeout(() => els.msg.style.display = 'none', 1000);
  });
}

els.save.addEventListener('click', save);
load();
