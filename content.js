(() => {  const STATE = {
    theme: 'light',
    targetLang: 'en',
    provider: 'mymemory',
    fontScale: 1,
    showMarker: false,
  };

  const NAMESPACE = 'qt-ext';
  let floatingBtn = null;
  let overlay = null;
  let panel = null;
  let sourceTextArea = null;
  let targetTextArea = null;

  function log(...args) {
    try { console.debug('[QuickTranslator]', ...args); } catch {}
  }

  function ensureMarkerElement() {
    let el = document.getElementById('qt-loaded-marker');
    if (!el) {
      el = document.createElement('div');
      el.id = 'qt-loaded-marker';
      el.textContent = 'QT';
      el.style.position = 'fixed';
      el.style.right = '6px';
      el.style.bottom = '6px';
      el.style.zIndex = '2147483647';
      el.style.background = '#2b7cff';
      el.style.color = '#fff';
      el.style.fontSize = '10px';
      el.style.lineHeight = '16px';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.textAlign = 'center';
      el.style.borderRadius = '3px';
      el.style.opacity = '0.6';
      el.style.pointerEvents = 'none';
      document.documentElement.appendChild(el);
    }
    return el;
  }

  function updateMarkerVisibility() {
    const el = ensureMarkerElement();
    el.style.display = STATE.showMarker ? 'block' : 'none';
  }

  function getSelectedTextAnywhere() {
    const selection = window.getSelection();
    let text = selection ? selection.toString() : '';
    if (!text) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        if (typeof start === 'number' && typeof end === 'number' && end > start) {
          text = el.value.slice(start, end);
        }
      }
    }
    return text || '';
  }

  function makeButton(label) {
    const btn = document.createElement('button');
    btn.className = 'qt-btn';
    btn.type = 'button';
    btn.textContent = label;
    btn.style.display = 'inline-flex';
    btn.style.flexDirection = 'row';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.whiteSpace = 'nowrap';
    btn.style.writingMode = 'horizontal-tb';
    btn.style.textOrientation = 'mixed';
    return btn;
  }

  function removeFloatingBtn() {
    if (floatingBtn && floatingBtn.parentNode) {
      floatingBtn.parentNode.removeChild(floatingBtn);
    }
    floatingBtn = null;
  }

  function openPanelSafe(selectedText) {
    try {
      openPanel(selectedText);
      log('panel opened');
    } catch (err) {
      try { console.error('[QuickTranslator] openPanel error:', err); } catch {}
    }
  }

  function showFloatingButtonAt(x, y, selectedText) {
    removeFloatingBtn();
    const btn = document.createElement('button');
    btn.className = 'qt-floating-btn';
    btn.textContent = '翻译';
    btn.style.top = `${y + 8}px`;
    btn.style.left = `${x + 8}px`;
    btn.style.position = 'absolute';
    btn.style.zIndex = '2147483647';
    btn.style.pointerEvents = 'auto';
    btn.style.display = 'inline-flex';
    btn.style.whiteSpace = 'nowrap';
    btn.style.writingMode = 'horizontal-tb';
    const handler = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      } catch {}
      setTimeout(() => {
        removeFloatingBtn();
        openPanelSafe(selectedText);
      }, 0);
    };
    btn.addEventListener('mousedown', handler, { capture: true });
    btn.addEventListener('click', handler, { capture: true });
    document.body.appendChild(btn);
    floatingBtn = btn;
    log('floating button shown');
  }

  function applyTheme() {
    if (!panel) return;
    if (STATE.theme === 'dark') {
      panel.classList.add('qt-dark');
    } else {
      panel.classList.remove('qt-dark');
    }
  }

  function detectSourceLangSimple(text) {
    if (!text) return 'en-US';
    if (/[\u4E00-\u9FFF]/.test(text)) return 'zh-CN';
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko-KR';
    return 'en-US';
  }

  function pickVoiceForLang(tag) {
    const voices = window.speechSynthesis.getVoices() || [];
    const lower = String(tag || '').toLowerCase();
    let v = voices.find(x => x.lang && x.lang.toLowerCase() === lower);
    if (v) return v;
    v = voices.find(x => x.lang && lower && x.lang.toLowerCase().startsWith(lower.split('-')[0] + '-'));
    return v || voices[0] || null;
  }

  function speak(text, langTag) {
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langTag;
    const v = pickVoiceForLang(langTag);
    if (v) utter.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  function openPanel(selectedText) {
    closePanel();

    const overlay = document.createElement('div');
    overlay.className = 'qt-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.2)';
    overlay.style.zIndex = '2147483646';
    overlay.style.writingMode = 'horizontal-tb';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });

    panel = document.createElement('div');
    panel.className = 'qt-panel';
    panel.style.position = 'fixed';
    panel.style.top = '10%';
    panel.style.left = '50%';
    panel.style.transform = 'translateX(-50%)';
    panel.style.width = '520px';
    panel.style.maxWidth = '90vw';
    panel.style.background = '#ffffff';
    panel.style.color = '#111111';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)';
    panel.style.zIndex = '2147483647';
    panel.style.writingMode = 'horizontal-tb';
    panel.style.textOrientation = 'mixed';

    const header = document.createElement('div');
    header.className = 'qt-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '10px 12px';
    header.style.background = '#f5f7fb';
    header.style.borderBottom = '1px solid rgba(0,0,0,0.08)';
    header.style.writingMode = 'horizontal-tb';

    const title = document.createElement('div');
    title.innerHTML = `<strong>QuickTranslator</strong> <span class=\"qt-chip\">${STATE.targetLang.toUpperCase()}</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'qt-close';
    closeBtn.innerHTML = '×';
    closeBtn.style.display = 'inline-flex';
    closeBtn.style.writingMode = 'horizontal-tb';
    closeBtn.addEventListener('click', (e) => {
      try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}
      closePanel();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'qt-body';
    body.style.display = 'grid';
    body.style.gridTemplateColumns = '1fr 1fr';
    body.style.gap = '8px';
    body.style.padding = '12px';
    body.style.writingMode = 'horizontal-tb';

    const colLeft = document.createElement('div');
    colLeft.className = 'qt-col';
    colLeft.style.display = 'flex';
    colLeft.style.flexDirection = 'column';
    colLeft.style.gap = '8px';

    const colRight = document.createElement('div');
    colRight.className = 'qt-col';
    colRight.style.display = 'flex';
    colRight.style.flexDirection = 'column';
    colRight.style.gap = '8px';

    sourceTextArea = document.createElement('textarea');
    sourceTextArea.className = 'qt-textarea';
    sourceTextArea.value = selectedText || '';
    sourceTextArea.style.minHeight = '120px';
    sourceTextArea.style.writingMode = 'horizontal-tb';

    targetTextArea = document.createElement('textarea');
    targetTextArea.className = 'qt-textarea';
    targetTextArea.readOnly = true;
    targetTextArea.style.minHeight = '120px';
    targetTextArea.style.writingMode = 'horizontal-tb';

    const controls = document.createElement('div');
    controls.className = 'qt-controls';
    controls.style.display = 'flex';
    controls.style.flexWrap = 'wrap';
    controls.style.gap = '6px';
    controls.style.alignItems = 'center';
    controls.style.writingMode = 'horizontal-tb';

    const translateBtn = makeButton('翻译');
    translateBtn.addEventListener('click', (e) => { try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}; doTranslate(); });

    const copyBtn = makeButton('复制');
    copyBtn.addEventListener('click', async (e) => {
      try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}
      try {
        await navigator.clipboard.writeText(targetTextArea.value);
        copyBtn.textContent = '已复制';
        setTimeout(() => (copyBtn.textContent = '复制'), 1000);
      } catch {}
    });

    const speakTargetBtn = makeButton('朗读译文');
    speakTargetBtn.addEventListener('click', (e) => {
      try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}
      const langTagMap = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', es: 'es-ES' };
      const tag = langTagMap[STATE.targetLang] || STATE.targetLang || 'en-US';
      speak((targetTextArea?.value || '').trim(), tag);
    });

    const speakSourceBtn = makeButton('朗读原文');
    speakSourceBtn.addEventListener('click', (e) => {
      try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}
      const src = (sourceTextArea?.value || '').trim();
      const tag = detectSourceLangSimple(src);
      speak(src, tag);
    });

    const fontSmall = makeButton('A-');
    fontSmall.addEventListener('click', (e) => { try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}; updateFont(-0.1); });
    const fontLarge = makeButton('A+');
    fontLarge.addEventListener('click', (e) => { try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}; updateFont(0.1); });

    const swapLangBtn = makeButton('切换');
    swapLangBtn.addEventListener('click', (e) => {
      try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch {}
      const oldTarget = STATE.targetLang;
      STATE.targetLang = oldTarget === 'zh' ? 'en' : 'zh';
      title.innerHTML = `<strong>QuickTranslator</strong> <span class=\"qt-chip\">${STATE.targetLang.toUpperCase()}</span>`;
    });

    controls.appendChild(translateBtn);
    controls.appendChild(copyBtn);
    controls.appendChild(speakTargetBtn);
    controls.appendChild(speakSourceBtn);
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
    const overlayEl = document.querySelector('.qt-overlay');
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
    sourceTextArea = null;
    targetTextArea = null;
    // Clean up AI button
    if (window.qtAiButton) {
      window.qtAiButton.remove();
      window.qtAiButton = null;
    }
  }

  function formatWordLookup(wordData) {
    if (!wordData || !wordData.isWordLookup) return wordData;
    
    const data = wordData.data;
    let formatted = `📖 ${data.word || ''}\n`;
    
    if (data.phonetic) {
      formatted += `🔊 ${data.phonetic}\n\n`;
    }
    
    if (data.part_of_speech && Array.isArray(data.part_of_speech)) {
      data.part_of_speech.forEach((pos, index) => {
        formatted += `${index + 1}. ${pos.pos || ''}\n`;
        if (pos.definitions && Array.isArray(pos.definitions)) {
          pos.definitions.forEach((def, defIndex) => {
            formatted += `   ${defIndex + 1}) ${def}\n`;
          });
        }
        if (pos.examples && Array.isArray(pos.examples)) {
          pos.examples.forEach((example) => {
            formatted += `   💡 ${example}\n`;
          });
        }
        formatted += '\n';
      });
    }
    
    if (data.translations && data.translations['zh-CN']) {
      formatted += `🇨🇳 中文释义:\n`;
      data.translations['zh-CN'].forEach((trans, index) => {
        formatted += `   ${index + 1}) ${trans}\n`;
      });
      formatted += '\n';
    }
    
    if (data.frequency) {
      formatted += `📊 使用频率: ${data.frequency}\n`;
    }
    
    if (data.tags && Array.isArray(data.tags)) {
      formatted += `🏷️ 标签: ${data.tags.join(', ')}\n`;
    }
    
    return formatted.trim();
  }

  function formatStreamingContent(rawContent) {
    try {
      // Try to parse as JSON and format
      const data = JSON.parse(rawContent);
      return formatWordLookup({ isWordLookup: true, data });
    } catch (e) {
      // If not valid JSON yet, show raw content with loading indicator
      return `🔄 正在查询...\n\n${rawContent}`;
    }
  }

  async function doTranslate() {
    const text = (sourceTextArea?.value || '').trim();
    if (!text) return;
    
    // Check if it's a single word
    const isSingle = text.length > 0 && !/\s/.test(text) && /^[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+$/.test(text);
    
    if (isSingle) {
      // For single words, first show public translation
      setTarget('翻译中…');
      try {
        // Force use public translation source for initial translation
        const publicProvider = STATE.provider === 'deepseek' ? 'mymemory' : STATE.provider;
        const response = await chrome.runtime.sendMessage({
          type: 'qt.translate',
          payload: {
            text,
            target: STATE.targetLang,
            provider: publicProvider
          }
        });
        if (response && response.ok) {
          const result = response.data;
          setTarget(result.translation || result);
          // Add AI lookup button after showing translation
          addAiLookupButton(text);
        } else {
          setTarget(`翻译失败: ${response?.error || '未知错误'}`);
        }
      } catch (e) {
        setTarget(`翻译失败: ${String(e)}`);
      }
    } else {
      // For phrases/sentences, use normal translation
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
          const result = response.data;
          if (result.isWordLookup) {
            setTarget(formatWordLookup(result));
          } else {
            setTarget(result.translation || result);
          }
        } else {
          setTarget(`翻译失败: ${response?.error || '未知错误'}`);
        }
      } catch (e) {
        setTarget(`翻译失败: ${String(e)}`);
      }
    }
  }

  function setTarget(val) {
    if (targetTextArea) targetTextArea.value = val;
  }

  function addAiLookupButton(word) {
    if (!targetTextArea) return;
    
    // Create AI lookup button
    const aiButton = document.createElement('button');
    aiButton.textContent = 'AI 查词释义';
    aiButton.style.cssText = `
      margin-top: 1px;
      padding: 6px 12px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: block;
    `;
    
    // Add click handler
    aiButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      
      aiButton.textContent = 'AI 查询中...';
      aiButton.disabled = true;
      
      try {
        // Use streaming for AI word lookup
        chrome.runtime.sendMessage({
          type: 'qt.word-lookup-stream',
          payload: {
            word: word,
            target: STATE.targetLang,
            provider: 'deepseek'
          }
        });
      } catch (e) {
        setTarget(`AI 查询失败: ${String(e)}`);
        aiButton.textContent = 'AI 查词释义';
        aiButton.disabled = false;
      }
    });
    
    // Insert button after the target textarea
    targetTextArea.parentNode.insertBefore(aiButton, targetTextArea.nextSibling);
    
    // Store reference to the button
    window.qtAiButton = aiButton;
  }

  function hideAiButton() {
    if (window.qtAiButton) {
      window.qtAiButton.style.display = 'none';
    }
  }

  function showAiButton() {
    if (window.qtAiButton) {
      window.qtAiButton.style.display = 'block';
      window.qtAiButton.textContent = 'AI 查词释义';
      window.qtAiButton.disabled = false;
    }
  }

  function onSelectionTrigger() {
    const text = getSelectedTextAnywhere().trim();
    if (!text) {
      removeFloatingBtn();
      return;
    }
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        const x = rect.right + window.scrollX;
        const y = rect.top + window.scrollY;
        showFloatingButtonAt(x, y, text);
        return;
      }
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        const box = el.getBoundingClientRect();
        const x = box.right + window.scrollX - 40;
        const y = box.top + window.scrollY - 10;
        showFloatingButtonAt(x, y, text);
        return;
      }
    } catch {}
  }

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        theme: 'light',
        targetLang: 'zh',
        provider: 'mymemory',
        showMarker: false,
      }, (items) => {
        STATE.theme = items.theme;
        STATE.targetLang = items.targetLang;
        STATE.provider = items.provider;
        STATE.showMarker = !!items.showMarker;
        updateMarkerVisibility();
        resolve();
      });
    });
  }

  function setupHotkeyListener() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'qt.command.translate-selection') {
        const selection = getSelectedTextAnywhere();
        if (selection.trim()) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            const x = rect.right + window.scrollX;
            const y = rect.top + window.scrollY;
            showFloatingButtonAt(x, y, selection);
            openPanelSafe(selection);
          } else {
            openPanelSafe(selection);
          }
        }
      }
      
      // Handle streaming updates
      if (msg && msg.type === 'qt.stream-update') {
        setTarget(formatStreamingContent(msg.data));
      }
      
      if (msg && msg.type === 'qt.stream-complete') {
        setTarget(formatWordLookup(msg.data));
        // Hide AI button after completion
        hideAiButton();
      }
      
      if (msg && msg.type === 'qt.stream-error') {
        setTarget(`查询失败: ${msg.error}`);
        // Show AI button again on error
        showAiButton();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.showMarker) {
        STATE.showMarker = !!changes.showMarker.newValue;
        updateMarkerVisibility();
      }
    });
  }

  async function init() {
    await loadSettings();
    document.addEventListener('mouseup', onSelectionTrigger, true);
    document.addEventListener('keyup', onSelectionTrigger, true);
    document.addEventListener('selectionchange', () => {
      setTimeout(onSelectionTrigger, 0);
    }, true);
    setupHotkeyListener();
    log('content script injected');
  }

  init();
})();
