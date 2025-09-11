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
  if (/[\u4E00-\u9FFF]/.test(text)) return 'ZH-CN';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'JA';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'KO';
  return 'EN';
}

function isSingleWord(text) {
  const trimmed = (text || '').trim();
  return trimmed.length > 0 && !/\s/.test(trimmed) && /^[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+$/.test(trimmed);
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

function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, (vals) => resolve(vals || {}));
  });
}

async function lookupWordWithDeepSeek(word, target, onStream) {
  const { deepseekKey = '', deepseekBase = '' } = await getFromStorage(['deepseekKey', 'deepseekBase']);
  if (!deepseekKey) throw new Error('DeepSeek API Key 未配置');
  const base = (deepseekBase && deepseekBase.trim()) || 'https://api.deepseek.com';
  const url = base.replace(/\/$/, '') + '/v1/chat/completions';
  const prompt = `请为单词 "${word}" 提供详细的词典信息，以 JSON 格式返回。所有释义和例句都请用中文提供：

{
  "word": "${word}",
  "phonetic": "音标（如果有）",
  "part_of_speech": [
    {
      "pos": "词性（如 名词、动词、形容词 等）",
      "definitions": ["中文释义1", "中文释义2"],
      "examples": ["中文例句1", "中文例句2"]
    }
  ],
  "translations": {
    "zh-CN": ["中文释义1", "中文释义2"]
  },
  "frequency": "使用频率（high/medium/low）",
  "tags": ["标签如 academic/informal/slang"]
}

重要要求：
1. definitions 字段中的释义必须用中文
2. examples 字段中的例句必须用中文
3. pos 字段中的词性用中文（如：名词、动词、形容词等）
4. 请确保返回有效的 JSON 格式，不要添加其他文字。`;
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a helpful dictionary assistant. Always return valid JSON only. When providing word definitions and examples, use Chinese language for better understanding.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    stream: true
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = new Error(`DeepSeek HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              if (onStream) onStream(fullContent);
            }
          } catch (e) {
            // Ignore parsing errors for streaming
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  try {
    return JSON.parse(fullContent.trim());
  } catch (e) {
    throw new Error('AI 返回的不是有效 JSON 格式');
  }
}

async function translateWithDeepSeek(text, target) {
  const { deepseekKey = '', deepseekBase = '' } = await getFromStorage(['deepseekKey', 'deepseekBase']);
  if (!deepseekKey) throw new Error('DeepSeek API Key 未配置');
  const base = (deepseekBase && deepseekBase.trim()) || 'https://api.deepseek.com';
  const url = base.replace(/\/$/, '') + '/v1/chat/completions';
  const prompt = `你是专业的翻译助手。将用户提供的文本翻译为目标语言（${target}）。仅输出翻译后的文本，不要添加解释或格式。\n\n文本：\n${text}`;
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a helpful translation assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    stream: false
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = new Error(`DeepSeek HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return content.trim();
}

async function doTranslate({ text, target, provider }) {
  const chosen = provider || DEFAULTS.provider;
  
  // Check if it's a single word and we're using an AI provider
  if (isSingleWord(text) && (chosen === 'deepseek')) {
    try {
      const wordData = await lookupWordWithDeepSeek(text, target);
      return { isWordLookup: true, data: wordData };
    } catch (e) {
      // Fall back to regular translation on word lookup failure
      console.warn('Word lookup failed, falling back to translation:', e);
    }
  }
  
  if (chosen === 'libre') return translateWithLibre(text, target);
  if (chosen === 'deepseek') {
    try {
      return await translateWithDeepSeek(text, target);
    } catch (e) {
      // Graceful fallback on DeepSeek errors (e.g., 402 credit required)
      try {
        return await translateWithLibre(text, target);
      } catch (_) {
        throw e; // surface original DeepSeek error if fallback also fails
      }
    }
  }
  try {
    return await translateWithMyMemory(text, target);
  } catch (e) {
    return await translateWithLibre(text, target);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'qt.translate') {
    const { text, target, provider } = message.payload || {};
    doTranslate({ text, target, provider })
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true; // async
  }
  if (message?.type === 'qt.word-lookup-stream') {
    const { word, target, provider } = message.payload || {};
    if (isSingleWord(word) && provider === 'deepseek') {
      lookupWordWithDeepSeek(word, target, (streamContent) => {
        // Send streaming updates back to content script
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'qt.stream-update',
          data: streamContent
        }).catch(() => {}); // Ignore errors if tab is closed
      }).then((wordData) => {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'qt.stream-complete',
          data: { isWordLookup: true, data: wordData }
        }).catch(() => {});
      }).catch((error) => {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'qt.stream-error',
          error: String(error)
        }).catch(() => {});
      });
    }
    return true; // async
  }
  if (message?.type === 'qt.command.translate-selection') {
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
    }
  }
});
