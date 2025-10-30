let currentPrompts = [];
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadModels();
  renderPrompts();
  setupEventListeners();
});

async function loadSettings() {
  const result = await browser.storage.local.get(['ollamaUrl', 'defaultPrompts', 'defaultModel']);
  document.getElementById('ollama-url').value = result.ollamaUrl || 'http://localhost:11434';
  currentPrompts = result.defaultPrompts || [
    'Correggi gli errori grammaticali',
    'Rendi il testo più chiaro',
    'Abbrevia il testo mantenendo i concetti chiave',
    'Espandi testo con maggiori dettagli',
    'Traduci in inglese'
  ];
  document.getElementById('model-select').dataset.saved = result.defaultModel || "llama3";
}

async function loadModels() {
  const ollamaUrl = document.getElementById('ollama-url').value.trim() || 'http://localhost:11434';
  const select = document.getElementById('model-select');
  select.innerHTML = '';
  select.disabled = true;
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) throw new Error("Modelli non recuperabili");
    const data = await response.json();
    (data.models || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
    // Seleziona default da settings se esiste
    const saved = select.dataset.saved;
    if (saved && select.querySelector(`option[value="${saved}"]`)) select.value = saved;
    select.disabled = false;
    showStatus(document.getElementById('connection-status'), 'Modelli caricati', 'success');
  } catch (e) {
    select.innerHTML = `<option value="llama3" selected>llama3</option>`;
    select.disabled = false;
    showStatus(document.getElementById('connection-status'), 'Errore modelli: usa modello di default', 'error');
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
  const statusDiv = document.getElementById('save-status');
  if (!ollamaUrl) {
    showStatus(statusDiv, 'URL Ollama non può essere vuoto.', 'error');
    return;
  }
  await browser.storage.local.set({
    ollamaUrl,
    defaultPrompts: currentPrompts,
    defaultModel
  });
  showStatus(statusDiv, 'Impostazioni salvate.', 'success');
  setTimeout(() => statusDiv.classList.add('hidden'), 2600);
}

async function resetToDefaults() {
  if (!confirm('Vuoi ripristinare le impostazioni predefinite?')) return;
  document.getElementById('ollama-url').value = 'http://localhost:11434';
  document.getElementById('model-select').value = 'llama3';
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
