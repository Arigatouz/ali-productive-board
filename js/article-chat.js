// ===== article-chat.js — AI chat about articles using Perplexity/Claude =====

import { callAI, extractUrls, openInNewTab, getAIConfig } from './ai-config.js';
import { showStatus } from './ui.js';
import { showCyberLoader, hideCyberLoader } from './loader.js';

async function fetchArticleText(url, config) {
  try {
    let fetchUrl = url;
    if (config?.cors_proxy?.includes('workers.dev')) {
      const workerOrigin = new URL(config.cors_proxy).origin;
      fetchUrl = `${workerOrigin}/proxy?url=${encodeURIComponent(url)}`;
    }
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,nav,header,footer,aside,[role="banner"],[role="navigation"],[role="complementary"],noscript').forEach(el => el.remove());
    const article = doc.querySelector('article,[role="main"],main,.post-content,.article-content,.entry-content,.content') || doc.body;
    const text = (article?.textContent || '').replace(/\s{3,}/g, '\n\n').trim();
    return text.slice(0, 12000);
  } catch {
    return '';
  }
}

let chatHistory = [];
let currentArticleContent = '';
let currentArticleTitle = '';
let currentSummary = '';
let summaryHtml = '';
let isInitialized = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Post-processes marked HTML: citation links [n] → pill badge, all links → new tab
function linkifyCitations(html) {
  let out = html.replace(
    /<a href="([^"]+)">(\[\d+\])<\/a>/g,
    '<a href="$1" class="ac-citation" target="_blank" rel="noopener">$2</a>'
  );
  out = out.replace(/<a href="([^"]+)"(?![^>]*target=)>/g, '<a href="$1" target="_blank" rel="noopener">');
  return out;
}

function renderMessages(container) {
  if (!container) return;
  const messagesHtml = chatHistory
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      if (m.role === 'user') {
        return `<div class="ac-msg ac-msg-user"><div class="ac-msg-role">You</div><div class="ac-msg-text">${escapeHtml(m.content)}</div></div>`;
      }
      const rendered = linkifyCitations(window.marked.parse(m.content || ''));
      const urls = extractUrls(m.content);
      const urlLinks = urls.length
        ? `<div class="ac-msg-links">${urls.map(u => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener" class="ac-link">${escapeHtml(u)}</a>`).join('')}</div>`
        : '';
      return `<div class="ac-msg ac-msg-assistant"><div class="ac-msg-role">AI</div><div class="ac-msg-text">${rendered}</div>${urlLinks}</div>`;
    })
    .join('');
  container.innerHTML = summaryHtml + messagesHtml;
  container.scrollTop = container.scrollHeight;
}

function setMessageLoading(container, loading) {
  if (!container) return;
  const existing = container.querySelector('.ac-loading');
  if (loading && !existing) {
    const div = document.createElement('div');
    div.className = 'ac-msg ac-msg-assistant ac-loading';
    div.innerHTML = '<div class="ac-msg-role">AI</div><div class="ac-msg-text"><span class="ac-dots"><span>.</span><span>.</span><span>.</span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  } else if (!loading && existing) {
    existing.remove();
  }
}

async function sendChat(userInput) {
  const config = getAIConfig();
  if (!config.cors_proxy) {
    showStatus('Configure the CORS proxy (worker URL) in Settings to use AI');
    return;
  }

  chatHistory.push({ role: 'user', content: userInput });

  const systemParts = ['You are a helpful research assistant helping the user understand and discuss articles.'];
  if (currentArticleContent) systemParts.push(`Article content:\n\n${currentArticleContent}`);
  if (currentSummary) systemParts.push(`Article summary already provided to user:\n\n${currentSummary}`);
  if (!currentArticleContent && !currentSummary) systemParts.push('No article selected yet. Help the user find or discuss topics.');
  systemParts.push('Respond concisely. Include full URLs when referencing sources. Support Arabic and English.');

  const messages = [
    { role: 'system', content: systemParts.join('\n\n') },
    ...chatHistory.filter(m => m.role === 'user' || m.role === 'assistant'),
  ];

  const container = document.getElementById('acMessages');
  renderMessages(container);
  setMessageLoading(container, true);
  showCyberLoader('Processing Query');

  try {
    const response = await callAI(messages);
    chatHistory.push({ role: 'assistant', content: response });
    renderMessages(container);
  } catch (err) {
    chatHistory.push({ role: 'assistant', content: `Error: ${err.message}` });
    renderMessages(container);
    showStatus('AI request failed — check your API key');
  } finally {
    hideCyberLoader();
    setMessageLoading(container, false);
  }
}

export function initArticleChat(config) {
  const input = document.getElementById('acInput');
  const sendBtn = document.getElementById('acSendBtn');
  const clearBtn = document.getElementById('acClearBtn');
  const urlInput = document.getElementById('acUrlInput');
  const fetchBtn = document.getElementById('acFetchBtn');
  const container = document.getElementById('acMessages');

  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = input.value.trim();
        if (text) { input.value = ''; sendChat(text); }
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const text = input?.value.trim();
      if (text) { input.value = ''; sendChat(text); }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chatHistory = [];
      currentArticleContent = '';
      currentArticleTitle = '';
      currentSummary = '';
      summaryHtml = '';
      renderMessages(container);
      const titleEl = document.getElementById('acArticleTitle');
      if (titleEl) titleEl.textContent = '';
    });
  }

  if (fetchBtn && urlInput) {
    fetchBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) return;

      fetchBtn.disabled = true;
      showCyberLoader('Fetching Article');

      try {
        fetchBtn.textContent = 'Reading…';
        const config = getAIConfig();
        const articleText = await fetchArticleText(url, config);
        const hasContent = articleText.length > 200;

        const messages = hasContent
          ? [
              { role: 'system', content: 'You are a research assistant. Summarize the article content provided. Be concise: title, 3-5 key takeaways as bullets, and a 2-3 sentence conclusion. Respond in markdown.' },
              { role: 'user', content: `Article URL: ${url}\n\nArticle content:\n\n${articleText}` },
            ]
          : [
              { role: 'system', content: 'You are a research assistant. Summarize the article at the given URL based on what you know. Be concise: title, 3-5 key takeaways as bullets, and a 2-3 sentence conclusion. Respond in markdown.' },
              { role: 'user', content: `Please summarize this article: ${url}` },
            ];

        fetchBtn.textContent = 'Summarizing…';
        const response = await callAI(messages, { maxTokens: 600 });
        currentArticleContent = hasContent ? articleText : '';
        currentSummary = response;
        currentArticleTitle = url;
        const titleEl = document.getElementById('acArticleTitle');
        if (titleEl) titleEl.textContent = url;

        // Pin summary at top — keep it visible while follow-up questions are asked below
        chatHistory = [];
        const rendered = linkifyCitations(window.marked ? window.marked.parse(response) : response);
        summaryHtml = `<div class="ac-msg ac-msg-assistant ac-msg-summary"><div class="ac-msg-role">Summary</div><div class="ac-msg-text">${rendered}</div></div>`;
        if (container) {
          container.innerHTML = summaryHtml;
          container.scrollTop = 0;
        }
        showStatus('Article loaded — ask questions about it');
      } catch (err) {
        showStatus('Failed to fetch article: ' + err.message);
      } finally {
        hideCyberLoader();
        fetchBtn.textContent = 'Fetch';
        fetchBtn.disabled = false;
      }
    });
  }

  // Delegate clicks on rendered links
  container?.addEventListener('click', (e) => {
    if (e.target.matches('a[href]') && e.target.href) {
      e.preventDefault();
      openInNewTab(e.target.href);
    }
  });

  isInitialized = true;
}

export function renderArticleChat() {
  const container = document.getElementById('acMessages');
  if (container) renderMessages(container);
}