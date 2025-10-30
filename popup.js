let conversationHistory = [];
let currentTextarea = null;
let ollamaUrl = '';
let modelsAvailable = [];
let defaultPrompts = [];
let selectedPrompt = '';
let lastRequestModel = '';

console.log('Popup script inizializzato');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup DOM caricato');
  await loadSettings();
  await loadModelsInWidget();
  await loadTextareaData();
  renderPredefinedPrompts();
  setupEventListeners();
  updateAskBtnState();
  
  // NUOVO: Controlla se c'è un prompt veloce
  await checkQuickPrompt();
  
  // Pulisci badge
  browser.runtime.sendMessage({ type: 'CLEAR_BADGE' });
});


async function loadSettings() {
  console.log('Caricamento impostazioni...');
  const result = await browser.storage.local.get(['ollamaUrl', 'defaultModel', 'defaultPrompts']);
  ollamaUrl = result.ollamaUrl || 'http://localhost:11434';
  defaultPrompts = result.defaultPrompts || [
    'Correggi gli errori grammaticali',
    'Rendi il testo più chiaro',
    'Abbrevia il testo mantenendo i concetti chiave',
    'Espandi testo con maggiori dettagli',
    'Traduci in inglese'
  ];
  lastRequestModel = result.defaultModel || 'llama3';
  console.log('Impostazioni caricate:', { ollamaUrl, defaultModel: lastRequestModel });
}

async function loadModelsInWidget() {
  console.log('Caricamento modelli...');
  const select = document.getElementById('model');
  select.innerHTML = '<option value="">Caricamento...</option>';
  select.disabled = true;
  
  try {
    // USA background script per fetch modelli (bypass CORS)
    const response = await browser.runtime.sendMessage({
      type: 'OLLAMA_REQUEST',
      url: `${ollamaUrl}/api/tags`,
      body: {}
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    const data = response.data;
    modelsAvailable = (data.models || []).map(m => m.name);
    console.log('Modelli disponibili:', modelsAvailable);
    
    select.innerHTML = '';
    modelsAvailable.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      select.appendChild(opt);
    });
    
    select.value = lastRequestModel;
    select.disabled = false;
  } catch (error) {
    console.error('Errore caricamento modelli:', error);
    modelsAvailable = [lastRequestModel];
    select.innerHTML = `<option value="${lastRequestModel}">${lastRequestModel}</option>`;
    select.disabled = false;
  }
}

async function loadTextareaData() {
  console.log('Richiesta dati textarea al background...');
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CURRENT_TEXTAREA' });
    console.log('Risposta background:', response);
    currentTextarea = response;
    
    if (!currentTextarea || !currentTextarea.text) {
      console.warn('Nessun testo disponibile');
      showError('Nessun testo da elaborare.\n\nSeleziona del testo e usa il widget floating o il menu contestuale (tasto destro).');
    } else {
      console.log('Testo caricato:', currentTextarea.text.substring(0, 100) + '...');
    }
  } catch (error) {
    console.error('Errore recupero textarea:', error);
    showError('Errore nel recupero del testo: ' + error.message);
  }
}

async function checkQuickPrompt() {
  // Controlla se c'è un prompt veloce selezionato dal menu contestuale
  const result = await browser.storage.local.get(['quickPrompt', 'quickPromptActive']);
  
  if (result.quickPromptActive && result.quickPrompt) {
    console.log('Quick prompt attivo:', result.quickPrompt);
    
    // Seleziona automaticamente il prompt
    const promptBtns = document.querySelectorAll('.prompt-btn');
    promptBtns.forEach(btn => {
      if (btn.textContent === result.quickPrompt) {
        btn.classList.add('selected');
        selectedPrompt = result.quickPrompt;
      }
    });
    
    // Pulisci quick prompt
    await browser.storage.local.set({ 
      quickPrompt: null, 
      quickPromptActive: false 
    });
    
    // Aggiorna stato bottone
    updateAskBtnState();
    
    // Auto-click su "Chiedi" dopo mezzo secondo
    setTimeout(() => {
      if (document.getElementById('ask-btn').disabled === false) {
        document.getElementById('ask-btn').click();
      }
    }, 500);
  }
}


function renderPredefinedPrompts() {
  const container = document.getElementById('predefined-prompts');
  container.innerHTML = '';
  
  defaultPrompts.forEach(prompt => {
    const btn = document.createElement('button');
    btn.className = 'prompt-btn';
    btn.textContent = prompt;
    btn.onclick = () => handlePromptClick(btn, prompt);
    container.appendChild(btn);
  });
}

function handlePromptClick(btnElement, prompt) {
  const allBtns = document.querySelectorAll('.prompt-btn');
  
  if (selectedPrompt === prompt) {
    btnElement.classList.remove('selected');
    selectedPrompt = '';
  } else {
    allBtns.forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');
    selectedPrompt = prompt;
    document.getElementById('custom-prompt-input').value = '';
  }
  
  updateAskBtnState();
}

function setupEventListeners() {
  const customInput = document.getElementById('custom-prompt-input');
  customInput.addEventListener('input', () => {
    const val = customInput.value.trim();
    if (val) {
      selectedPrompt = '';
      document.querySelectorAll('.prompt-btn').forEach(btn => btn.classList.remove('selected'));
    }
    updateAskBtnState();
  });
  
  document.getElementById('model').addEventListener('change', updateAskBtnState);
  document.getElementById('ask-btn').addEventListener('click', handleAskClick);
  document.getElementById('accept-btn').addEventListener('click', handleAccept);
  document.getElementById('discard-btn').addEventListener('click', handleDiscard);
  document.getElementById('modify-btn').addEventListener('click', handleModifyRequest);
  document.getElementById('submit-modify-btn').addEventListener('click', handleSubmitModify);
  document.getElementById('retry-btn').addEventListener('click', resetToControls);
}

function updateAskBtnState() {
  const modelSelected = document.getElementById('model').value;
  const customPrompt = document.getElementById('custom-prompt-input').value.trim();
  
  const hasPrompt = selectedPrompt || customPrompt;
  const enable = modelSelected && hasPrompt && !(selectedPrompt && customPrompt);
  
  document.getElementById('ask-btn').disabled = !enable;
}

async function handleAskClick() {
  const model = document.getElementById('model').value;
  const customPrompt = document.getElementById('custom-prompt-input').value.trim();
  const prompt = customPrompt || selectedPrompt;
  
  console.log('Richiesta con modello:', model, 'e prompt:', prompt);
  
  if (!model || !prompt) {
    showError('Seleziona un modello e un prompt!');
    return;
  }
  
  if (!currentTextarea || !currentTextarea.text) {
    showError('Nessun testo da elaborare.\n\nSeleziona del testo nella pagina.');
    return;
  }
  
  lastRequestModel = model;
  await makeOllamaRequest(model, prompt);
}

async function makeOllamaRequest(model, prompt) {
  showLoading();
  
  const tone = document.getElementById('tone').value;
  const text = currentTextarea.text;
  
  const userMessage = `Sto scrivendo questo testo: "${text}". ${prompt}. Usa un tono ${tone}. Rispondi solo con il testo migliorato, senza emoji o caratteri strani.`;
  
  const messages = [
    { role: 'system', content: 'Rispondi solo con il testo richiesto senza emoji o caratteri strani.' },
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];
  
  console.log('Invio richiesta a Ollama via background script (bypass CORS)');
  
  try {
    // USA BACKGROUND SCRIPT per bypassare CORS
    const response = await browser.runtime.sendMessage({
      type: 'OLLAMA_REQUEST',
      url: `${ollamaUrl}/api/chat`,
      body: {
        model: model,
        stream: false,
        messages: messages
      }
    });
    
    console.log('Risposta background:', response);
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    const data = response.data;
    console.log('Risposta Ollama:', data);
    
    if (!data.message || !data.message.content) {
      throw new Error('Risposta vuota dal modello');
    }
    
    const aiResponse = data.message.content;
    
    conversationHistory.push({ role: 'user', content: userMessage });
    conversationHistory.push({ role: 'assistant', content: aiResponse });
    
    showPreview(aiResponse);
  } catch (error) {
    console.error('Errore chiamata Ollama:', error);
    showError(`Errore comunicazione con Ollama:\n${error.message}\n\nVerifica:\n• Server attivo su ${ollamaUrl}\n• Modello "${model}" disponibile\n\nSe l'errore persiste, configura CORS:\nOLLAMA_ORIGINS="*" ollama serve`);
  }
}

function showLoading() {
  hideAllSections();
  document.getElementById('loading-section').classList.remove('hidden');
}

function showPreview(text) {
  hideAllSections();
  document.getElementById('preview-text').textContent = text;
  document.getElementById('preview-section').classList.remove('hidden');
}

function showError(message) {
  hideAllSections();
  document.getElementById('error-text').textContent = message;
  document.getElementById('error-section').classList.remove('hidden');
}

function hideAllSections() {
  ['controls-section', 'loading-section', 'preview-section', 'modify-section', 'error-section']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
}

function resetToControls() {
  hideAllSections();
  document.getElementById('controls-section').classList.remove('hidden');
}

async function handleAccept() {
  const previewText = document.getElementById('preview-text').textContent;
  console.log('Accettazione testo...');
  
  try {
    await browser.runtime.sendMessage({
      type: 'REPLACE_TEXT',
      newText: previewText
    });
    conversationHistory = [];
    window.close();
  } catch (error) {
    console.error('Errore sostituzione:', error);
    showError('Errore nella sostituzione del testo: ' + error.message);
  }
}

async function handleDiscard() {
  console.log('Scarto modifiche...');
  try {
    await browser.runtime.sendMessage({ type: 'CANCEL' });
    conversationHistory = [];
    window.close();
  } catch (error) {
    console.error('Errore:', error);
    window.close();
  }
}

function handleModifyRequest() {
  document.getElementById('preview-section').classList.add('hidden');
  document.getElementById('modify-section').classList.remove('hidden');
}

async function handleSubmitModify() {
  const modifyText = document.getElementById('modify-input').value.trim();
  
  if (!modifyText) {
    alert('Descrivi la modifica desiderata.');
    return;
  }
  
  console.log('Richiesta modifica:', modifyText);
  await makeOllamaRequest(lastRequestModel, modifyText);
  document.getElementById('modify-input').value = '';
}
