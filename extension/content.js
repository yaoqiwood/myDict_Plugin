(() => {
  const STATE = {
    theme: 'light',
    targetLang: 'en',
    provider: 'mymemory',
    fontScale: 1,
  };

  const NAMESPACE = 'qt-ext';
  let floatingBtn = null;
  let overlay = null;
  let panel = null;
  let sourceTextArea = null;
  let targetTextArea = null;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  function makeButton(label) {
    const btn = document.createElement('button');
    btn.className = 'qt-btn';
    btn.type = 'button';
    btn.textContent = label;
    return btn;
  }

  function removeFloatingBtn() {
    if (floatingBtn && floatingBtn.parentNode) {
      floatingBtn.parentNode.removeChild(floatingBtn);
    }
    floatingBtn = null;
  }

  function showFloatingButtonAt(x, y, selectedText) {
    removeFloatingBtn();
    const btn = document.createElement('button');
    btn.className = 'qt-floating-btn';
    btn.textContent = '翻译';
    btn.style.top = `${y + 8}px`;
    btn.style.left = `${x + 8}px`;
    btn.addEventListener('click', () => {
      removeFloatingBtn();
      openPanel(selectedText);
    });
    document.body.appendChild(btn);
    floatingBtn = btn;
  }

  function applyTheme() {
    if (!panel) return;
    if (STATE.theme === 'dark') {
      panel.classList.add('qt-dark');
    } else {
      panel.classList.remove('qt-dark');
    }
  }

  function openPanel(selectedText) {
    closePanel();

    overlay = document.createElement('div');
    overlay.className = 'qt-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });

    panel = document.createElement('div');
    panel.className = 'qt-panel';

    const header = document.createElement('div');
    header.className = 'qt-header';

    const title = document.createElement('div');
    title.innerHTML = `<strong>QuickTranslator</strong> <span class="qt-chip">${STATE.targetLang.toUpperCase()}</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'qt-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', closePanel);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'qt-body';

    const colLeft = document.createElement('div');
    colLeft.className = 'qt-col';
    const colRight = document.createElement('div');
    colRight.className = 'qt-col';

    sourceTextArea = document.createElement('textarea');
    sourceTextArea.className = 'qt-textarea';
    sourceTextArea.value = selectedText || '';

    targetTextArea = document.createElement('textarea');
    targetTextArea.className = 'qt-textarea';
    targetTextArea.readOnly = true;

    const controls = document.createElement('div');
    controls.className = 'qt-controls';

    const translateBtn = makeButton('翻译');
    translateBtn.addEventListener('click', () => doTranslate());

    const copyBtn = makeButton('复制');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(targetTextArea.value);
        copyBtn.textContent = '已复制';
        setTimeout(() => (copyBtn.textContent = '复制'), 1000);
      } catch {}
    });

    const speakBtn = makeButton('朗读');
    speakBtn.addEventListener('click', () => {
      const utter = new SpeechSynthesisUtterance(targetTextArea.value);
      utter.lang = STATE.targetLang;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });

    const fontSmall = makeButton('A-');
    fontSmall.addEventListener('click', () => updateFont(-0.1));
    const fontLarge = makeButton('A+');
    fontLarge.addEventListener('click', () => updateFont(0.1));

    const swapLangBtn = makeButton('切换');
    swapLangBtn.addEventListener('click', () => {
      // simple swap using detected source language if available later
      const oldTarget = STATE.targetLang;
      STATE.targetLang = oldTarget === 'zh' ? 'en' : 'zh';
      title.innerHTML = `<strong>QuickTranslator</strong> <span class="qt-chip">${STATE.targetLang.toUpperCase()}</span>`;
    });

    controls.appendChild(translateBtn);
    controls.appendChild(copyBtn);
    controls.appendChild(speakBtn);
    controls.appendChild(fontSmall);
    controls.appendChild(fontLarge);
    controls.appendChild(swapLangBtn);

    colLeft.appendChild(sourceTextArea);
    colLeft.appendChild(controls);

    colRight.appendChild(targetTextArea);

    body.appendChild(colLeft);
    body.appendChild(colRight);

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    applyTheme();

    if (sourceTextArea.value.trim()) {
      doTranslate();
    }
  }

  function updateFont(delta) {
    STATE.fontScale = Math.max(0.8, Math.min(2, STATE.fontScale + delta));
    const size = 13 * STATE.fontScale;
    if (sourceTextArea) sourceTextArea.style.fontSize = `${size}px`;
    if (targetTextArea) targetTextArea.style.fontSize = `${size}px`;
  }

  function closePanel() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    overlay = null;
    panel = null;
    sourceTextArea = null;
    targetTextArea = null;
  }

  async function doTranslate() {
    const text = (sourceTextArea?.value || '').trim();
    if (!text) return;
    setTarget('翻译中…');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'qt.translate',
        payload: {
          text,
          target: STATE.targetLang,
          provider: STATE.provider
        }
      });
      if (response && response.ok) {
        setTarget(response.data.translation);
      } else {
        setTarget(`翻译失败: ${response?.error || '未知错误'}`);
      }
    } catch (e) {
      setTarget(`翻译失败: ${String(e)}`);
    }
  }

  function setTarget(val) {
    if (targetTextArea) targetTextArea.value = val;
  }

  function onSelectionChange() {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (!text) {
      removeFloatingBtn();
      return;
    }
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const x = rect.right + window.scrollX;
      const y = rect.top + window.scrollY;
      showFloatingButtonAt(x, y, text);
    } catch {}
  }

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        theme: 'light',
        targetLang: 'zh',
        provider: 'mymemory'
      }, (items) => {
        STATE.theme = items.theme;
        STATE.targetLang = items.targetLang;
        STATE.provider = items.provider;
        resolve();
      });
    });
  }

  function setupHotkeyListener() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'qt.command.translate-selection') {
        const selection = window.getSelection()?.toString() || '';
        if (selection.trim()) {
          const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
          const x = rect.right + window.scrollX;
          const y = rect.top + window.scrollY;
          showFloatingButtonAt(x, y, selection);
          openPanel(selection);
        }
      }
    });
  }

  async function init() {
    await loadSettings();
    document.addEventListener('mouseup', onSelectionChange);
    document.addEventListener('keyup', onSelectionChange);
    setupHotkeyListener();
  }

  init();
})();
