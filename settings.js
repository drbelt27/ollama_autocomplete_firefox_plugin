let currentPrompts = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadModels();
  renderPrompts();
  setupEventListeners();
});

async function loadSettings() {
  const result = await browser.storage.local.get([
    'ollamaUrl',
    'defaultPrompts',
    'defaultModel',
    'defaultTone',
    'showFloatingWidget',
    'debugMode'
  ]);

  document.getElementById('ollama-url').value = result.ollamaUrl || 'http://localhost:11434';

  currentPrompts = result.defaultPrompts || [
    'Correggi gli errori grammaticali',
    'Rendi il testo più chiaro',
    'Abbrevia il testo mantenendo i concetti chiave',
    'Espandi testo con maggiori dettagli',
    'Traduci in inglese'
  ];

  document.getElementById('model-select').dataset.saved = result.defaultModel || 'llama3';

  document.getElementById('default-tone').value = result.defaultTone || 'professionale';

  document.getElementById('show-floating-widget').checked = result.showFloatingWidget !== false;

  document.getElementById('debug-mode').checked = result.debugMode === true;
}

async function loadModels() {
  const ollamaUrl = document.getElementById('ollama-url').value.trim() || 'http://localhost:11434';
  const debugMode = document.getElementById('debug-mode').checked;
  const select = document.getElementById('model-select');
  select.innerHTML = '';
  select.disabled = true;

  if (debugMode) {
    console.log('[DEBUG] Testing Ollama connection...');
    console.log('[DEBUG] URL:', ollamaUrl + '/api/tags');
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
      throw new Error('Modelli non recuperabili');
    }

    const data = await response.json();

    if (debugMode) {
      console.log('[DEBUG] Response data:', data);
      console.log('[DEBUG] Models found:', data.models?.length || 0);
    }

    (data.models || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      select.appendChild(opt);
    });

    const saved = select.dataset.saved;
    if (saved && select.querySelector(`option[value="${saved}"]`)) select.value = saved;

    select.disabled = false;
    showStatus(document.getElementById('connection-status'), 'Modelli caricati ✓', 'success');

    if (debugMode) {
      console.log('[DEBUG] Connection test successful!');
    }
  } catch (e) {
    if (debugMode) {
      console.error('[DEBUG] Connection test failed!');
      console.error('[DEBUG] Error details:', e);
      console.error('[DEBUG] Error message:', e.message);
      console.error('[DEBUG] Error stack:', e.stack);
    }

    select.innerHTML = `<option value="llama3" selected>llama3</option>`;
    select.disabled = false;
    showStatus(document.getElementById('connection-status'), `Errore: ${e.message}`, 'error');
  }
}

document.getElementById('ollama-url').addEventListener('change', loadModels);

function renderPrompts() {
  const container = document.getElementById('prompts-list');
  container.innerHTML = '';

  if (currentPrompts.length === 0) {
    container.innerHTML = '<p class="help-text">Nessun prompt definito. Aggiungine uno qui sotto.</p>';
    return;
  }

  currentPrompts.forEach((prompt, i) => {
    const item = document.createElement('div');
    item.className = 'prompt-item';

    const text = document.createElement('span');
    text.className = 'prompt-text';
    text.textContent = prompt;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'prompt-remove';
    removeBtn.textContent = 'Rimuovi';
    removeBtn.onclick = () => removePrompt(i);

    item.appendChild(text);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

function setupEventListeners() {
  document.getElementById('add-prompt-btn').onclick = addPrompt;
  document.getElementById('new-prompt').onkeypress = e => { if (e.key === 'Enter') addPrompt(); };
  document.getElementById('test-connection').onclick = loadModels;
  document.getElementById('save-btn').onclick = saveSettings;
  document.getElementById('reset-btn').onclick = resetToDefaults;
}

function addPrompt() {
  const input = document.getElementById('new-prompt');
  const prompt = input.value.trim();

  if (!prompt) return;

  if (currentPrompts.includes(prompt)) {
    alert('Prompt già presente.');
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
  const defaultModel = document.getElementById('model-select').value;
  const defaultTone = document.getElementById('default-tone').value;
  const showFloatingWidget = document.getElementById('show-floating-widget').checked;
  const debugMode = document.getElementById('debug-mode').checked;
  const statusDiv = document.getElementById('save-status');

  if (!ollamaUrl) {
    showStatus(statusDiv, 'URL Ollama non può essere vuoto.', 'error');
    return;
  }

  await browser.storage.local.set({
    ollamaUrl,
    defaultPrompts: currentPrompts,
    defaultModel,
    defaultTone,
    showFloatingWidget,
    debugMode
  });

  showStatus(statusDiv, 'Impostazioni salvate.', 'success');
  setTimeout(() => statusDiv.classList.add('hidden'), 2600);
}

async function resetToDefaults() {
  if (!confirm('Vuoi ripristinare le impostazioni predefinite?')) return;

  document.getElementById('ollama-url').value = 'http://localhost:11434';
  document.getElementById('model-select').value = 'llama3';
  document.getElementById('default-tone').value = 'professionale';
  document.getElementById('show-floating-widget').checked = true;

  currentPrompts = [
    'Correggi gli errori grammaticali',
    'Rendi il testo più chiaro',
    'Abbrevia il testo mantenendo i concetti chiave',
    'Espandi testo con maggiori dettagli',
    'Traduci in inglese'
  ];

  renderPrompts();
  showStatus(document.getElementById('save-status'), 'Default ripristinato. Salva per confermare.', 'success');
}

function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.classList.remove('hidden');
}
