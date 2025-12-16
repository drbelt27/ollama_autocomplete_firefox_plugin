const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';
const DEFAULT_TONE = 'professionale';
const LANGUAGE_PREF_DEFAULT = 'system';

let currentPrompts = [];
let languagePreference = LANGUAGE_PREF_DEFAULT;
let resolvedLanguage = window.OllamaI18N.resolveLanguage(languagePreference);
let languagePack = window.OllamaI18N.get(resolvedLanguage);

document.addEventListener('DOMContentLoaded', async () => {
  initLanguageSelect();
  applySettingsTranslations();
  await loadSettings();
  applySettingsTranslations();
  await loadModels();
  renderPrompts();
  setupEventListeners();
});

function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el && typeof text === 'string') {
    el.textContent = text;
  }
}

function applySettingsTranslations() {
  const strings = languagePack.settings || {};
  const headings = strings.headings || {};
  const labels = strings.labels || {};
  const help = strings.help || {};
  const buttons = strings.buttons || {};
  const placeholders = strings.placeholders || {};

  document.title = strings.title || document.title;
  setText('#settings-page-title', strings.title);
  setText('#server-section-title', headings.server);
  setText('#preferences-section-title', headings.assistant);
  setText('#prompts-section-title', headings.prompts);
  setText('#label-ollama-url', labels.ollamaUrl);
  setText('#label-model-select', labels.model);
  setText('#label-language-select', labels.language);
  setText('#help-ollama-url', help.ollamaUrl);
  setText('#help-model-select', help.model);
  setText('#help-language-select', help.language);
  setText('#label-default-tone', labels.tone);
  setText('#help-default-tone', help.tone);
  const showFloatingLabel = document.querySelector('#label-show-floating .label-text');
  if (showFloatingLabel) showFloatingLabel.textContent = labels.showFloating || '';
  setText('#help-show-floating', help.showFloating);
  const debugLabel = document.querySelector('#label-debug-mode .label-text');
  if (debugLabel) debugLabel.textContent = labels.debugMode || '';
  setText('#help-debug-mode', help.debugMode);
  setText('#label-prompts-list', labels.promptsList);

  const systemOption = document.querySelector('#language-select option[value="system"]');
  if (systemOption && strings.languageSystemOption) {
    systemOption.textContent = strings.languageSystemOption;
  }

  setText('#test-connection', buttons.testConnection);
  setText('#add-prompt-btn', buttons.addPrompt);
  setText('#save-btn', buttons.save);
  setText('#reset-btn', buttons.reset);

  const urlInput = document.getElementById('ollama-url');
  if (urlInput) urlInput.placeholder = placeholders.ollamaUrl || DEFAULT_OLLAMA_URL;
  const newPromptInput = document.getElementById('new-prompt');
  if (newPromptInput) newPromptInput.placeholder = placeholders.newPrompt || '';

  const toneSelect = document.getElementById('default-tone');
  if (toneSelect) {
    const previousValue = toneSelect.value || toneSelect.dataset.current || DEFAULT_TONE;
    toneSelect.dataset.current = previousValue;
    toneSelect.innerHTML = '';
    (languagePack.tones || []).forEach((tone) => {
      const option = document.createElement('option');
      option.value = tone.value;
      option.textContent = tone.label;
      toneSelect.appendChild(option);
    });
    toneSelect.value = previousValue;
    if (!toneSelect.value && toneSelect.options.length) {
      toneSelect.selectedIndex = 0;
    }
  }
}

function initLanguageSelect() {
  const select = document.getElementById('language-select');
  select.innerHTML = '';
  const systemOption = document.createElement('option');
  systemOption.value = 'system';
  systemOption.textContent = languagePack.settings.languageSystemOption || 'System (Automatic)';
  select.appendChild(systemOption);

  window.OllamaI18N.list().forEach(({ code, label }) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    select.appendChild(option);
  });
}

async function loadSettings() {
  const result = await browser.storage.local.get([
    'ollamaUrl',
    'defaultPrompts',
    'defaultModel',
    'defaultTone',
    'showFloatingWidget',
    'debugMode',
    'language'
  ]);

  languagePreference = result.language || LANGUAGE_PREF_DEFAULT;
  resolvedLanguage = window.OllamaI18N.resolveLanguage(languagePreference);
  languagePack = window.OllamaI18N.get(resolvedLanguage);

  document.getElementById('language-select').value = languagePreference;
  const urlInput = document.getElementById('ollama-url');
  urlInput.value = result.ollamaUrl || DEFAULT_OLLAMA_URL;

  currentPrompts = result.defaultPrompts && result.defaultPrompts.length
    ? result.defaultPrompts
    : [...languagePack.prompts];

  const modelSelect = document.getElementById('model-select');
  modelSelect.dataset.saved = result.defaultModel || DEFAULT_MODEL;

  const toneSelect = document.getElementById('default-tone');
  toneSelect.dataset.current = result.defaultTone || DEFAULT_TONE;
  toneSelect.value = result.defaultTone || DEFAULT_TONE;

  document.getElementById('show-floating-widget').checked = result.showFloatingWidget !== false;
  document.getElementById('debug-mode').checked = result.debugMode === true;
}

async function loadModels() {
  const ollamaUrl = document.getElementById('ollama-url').value.trim() || DEFAULT_OLLAMA_URL;
  const debugMode = document.getElementById('debug-mode').checked;
  const select = document.getElementById('model-select');
  const statusTarget = document.getElementById('connection-status');
  select.innerHTML = '';
  select.disabled = true;

  if (debugMode) {
    console.log('[DEBUG] Testing Ollama connection...');
    console.log('[DEBUG] URL:', `${ollamaUrl}/api/tags`);
  }

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);

    if (debugMode) {
      console.log('[DEBUG] Response status:', response.status, response.statusText);
      console.log('[DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));
    }

    if (!response.ok) {
      if (debugMode) {
        const errorText = await response.text();
        console.error('[DEBUG] Error response body:', errorText);
      }
      throw new Error(languagePack.settings.status.connectionFailed || 'Unable to fetch models');
    }

    const data = await response.json();

    if (debugMode) {
      console.log('[DEBUG] Response data:', data);
      console.log('[DEBUG] Models found:', data.models?.length || 0);
    }

    (data.models || []).forEach((model) => {
      const opt = document.createElement('option');
      opt.value = model.name;
      opt.textContent = model.name;
      select.appendChild(opt);
    });

    const saved = select.dataset.saved;
    if (saved && select.querySelector(`option[value="${saved}"]`)) {
      select.value = saved;
    }

    select.disabled = false;
    showStatus(statusTarget, languagePack.settings.status.connectionSuccess, 'success');
  } catch (error) {
    if (debugMode) {
      console.error('[DEBUG] Connection test failed!', error);
    }

    select.innerHTML = `<option value="${DEFAULT_MODEL}" selected>${DEFAULT_MODEL}</option>`;
    select.disabled = false;
    const prefix = languagePack.settings.status.connectionError || 'Connection error:';
    showStatus(statusTarget, `${prefix} ${error.message}`, 'error');
  }
}

document.getElementById('ollama-url').addEventListener('change', loadModels);

function renderPrompts() {
  const container = document.getElementById('prompts-list');
  container.innerHTML = '';

  if (currentPrompts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'help-text';
    empty.textContent = languagePack.settings.prompts.empty;
    container.appendChild(empty);
    return;
  }

  currentPrompts.forEach((prompt, index) => {
    const item = document.createElement('div');
    item.className = 'prompt-item';

    const text = document.createElement('span');
    text.className = 'prompt-text';
    text.textContent = prompt;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'prompt-remove';
    removeBtn.textContent = languagePack.settings.prompts.remove;
    removeBtn.onclick = () => removePrompt(index);

    item.appendChild(text);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

function setupEventListeners() {
  document.getElementById('add-prompt-btn').onclick = addPrompt;
  document.getElementById('new-prompt').onkeypress = (event) => {
    if (event.key === 'Enter') addPrompt();
  };
  document.getElementById('test-connection').onclick = loadModels;
  document.getElementById('save-btn').onclick = saveSettings;
  document.getElementById('reset-btn').onclick = resetToDefaults;
  document.getElementById('language-select').addEventListener('change', handleLanguageChange);
}

function handleLanguageChange(event) {
  languagePreference = event.target.value;
  resolvedLanguage = window.OllamaI18N.resolveLanguage(languagePreference);
  languagePack = window.OllamaI18N.get(resolvedLanguage);
  applySettingsTranslations();
  currentPrompts = [...languagePack.prompts];
  renderPrompts();
  showStatus(
    document.getElementById('save-status'),
    languagePack.settings.status.languageChanged,
    'success'
  );
}

function addPrompt() {
  const input = document.getElementById('new-prompt');
  const prompt = input.value.trim();

  if (!prompt) return;

  if (currentPrompts.includes(prompt)) {
    alert(languagePack.settings.alerts.promptExists);
    return;
  }

  currentPrompts.push(prompt);
  input.value = '';
  renderPrompts();
}

function removePrompt(index) {
  currentPrompts.splice(index, 1);
  renderPrompts();
}

async function saveSettings() {
  const ollamaUrl = document.getElementById('ollama-url').value.trim();
  const defaultModel = document.getElementById('model-select').value || DEFAULT_MODEL;
  const defaultTone = document.getElementById('default-tone').value || DEFAULT_TONE;
  const showFloatingWidget = document.getElementById('show-floating-widget').checked;
  const debugMode = document.getElementById('debug-mode').checked;
  const statusDiv = document.getElementById('save-status');
  const promptsMatchDefault = arraysEqual(currentPrompts, languagePack.prompts);

  if (!ollamaUrl) {
    showStatus(statusDiv, languagePack.settings.status.urlEmpty, 'error');
    return;
  }

  await browser.storage.local.set({
    ollamaUrl,
    defaultPrompts: currentPrompts,
    defaultModel,
    defaultTone,
    showFloatingWidget,
    debugMode,
    language: languagePreference,
    promptsLanguage: promptsMatchDefault ? resolvedLanguage : 'custom'
  });

  showStatus(statusDiv, languagePack.settings.status.saved, 'success');
  setTimeout(() => statusDiv.classList.add('hidden'), 2600);
}

async function resetToDefaults() {
  if (!confirm(languagePack.settings.alerts.resetConfirm)) return;

  document.getElementById('ollama-url').value = DEFAULT_OLLAMA_URL;
  const modelSelect = document.getElementById('model-select');
  modelSelect.value = DEFAULT_MODEL;
  modelSelect.dataset.saved = DEFAULT_MODEL;
  const toneSelect = document.getElementById('default-tone');
  toneSelect.value = DEFAULT_TONE;
  toneSelect.dataset.current = DEFAULT_TONE;
  document.getElementById('show-floating-widget').checked = true;

  languagePreference = LANGUAGE_PREF_DEFAULT;
  resolvedLanguage = window.OllamaI18N.resolveLanguage(languagePreference);
  languagePack = window.OllamaI18N.get(resolvedLanguage);
  document.getElementById('language-select').value = languagePreference;

  applySettingsTranslations();
  currentPrompts = [...languagePack.prompts];
  renderPrompts();
  showStatus(
    document.getElementById('save-status'),
    languagePack.settings.status.defaultsRestored,
    'success'
  );
}

function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.classList.remove('hidden');
}

function arraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
