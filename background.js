let currentTextarea = null;
let defaultPrompts = [];

async function initializeExtension() {
  const result = await browser.storage.local.get(['ollamaUrl', 'defaultPrompts', 'defaultModel']);
  
  if (!result.ollamaUrl) {
    await browser.storage.local.set({ ollamaUrl: 'http://localhost:11434' });
  }
  
  if (!result.defaultPrompts) {
    defaultPrompts = [
      'Correggi gli errori grammaticali',
      'Rendi il testo più chiaro',
      'Abbrevia il testo mantenendo i concetti chiave',
      'Espandi testo con maggiori dettagli',
      'Traduci in inglese'
    ];
    await browser.storage.local.set({ defaultPrompts: defaultPrompts });
  } else {
    defaultPrompts = result.defaultPrompts;
  }
  
  if (!result.defaultModel) {
    await browser.storage.local.set({ defaultModel: 'llama3' });
  }
  
  console.log('Estensione inizializzata, prompt:', defaultPrompts);
  createContextMenu();
}

function createContextMenu() {
  console.log('Creazione menu contestuale');
  
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "ollama-assistant",
      title: "Ollama Assistant",
      contexts: ["selection", "editable"]
    });
    
    defaultPrompts.forEach((prompt, index) => {
      browser.contextMenus.create({
        id: `ollama-prompt-${index}`,
        parentId: "ollama-assistant",
        title: prompt,
        contexts: ["selection", "editable"]
      });
    });
    
    browser.contextMenus.create({
      id: "ollama-separator",
      parentId: "ollama-assistant",
      type: "separator",
      contexts: ["selection", "editable"]
    });
    
    browser.contextMenus.create({
      id: "ollama-custom",
      parentId: "ollama-assistant",
      title: "✏️ Prompt personalizzato...",
      contexts: ["selection", "editable"]
    });
    
    console.log('Menu contestuale creato');
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.defaultPrompts) {
    defaultPrompts = changes.defaultPrompts.newValue;
    createContextMenu();
  }
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Menu cliccato:', info.menuItemId);
  
  let selectedPrompt = null;
  let isCustom = false;
  
  if (info.menuItemId.startsWith('ollama-prompt-')) {
    const promptIndex = parseInt(info.menuItemId.replace('ollama-prompt-', ''));
    selectedPrompt = defaultPrompts[promptIndex];
  } else if (info.menuItemId === 'ollama-custom') {
    isCustom = true;
  } else if (info.menuItemId === 'ollama-assistant') {
    isCustom = true;
  }
  
  try {
    await browser.tabs.sendMessage(tab.id, {
      type: 'OPEN_WIDGET',
      selectionText: info.selectionText,
      selectedPrompt: selectedPrompt,
      isCustom: isCustom
    });
    console.log('Messaggio inviato con successo');
  } catch (err) {
    console.error('Errore apertura widget:', err);
    
    // Mostra notifica all'utente
    browser.notifications.create({
      type: "basic",
      title: "Ollama Assistant",
      message: "Ricarica la pagina (F5) per usare l'estensione su questa scheda."
    }).catch(() => {
      console.log('Impossibile mostrare notifica');
    });
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background ricevuto:', message.type);
  
  if (message.type === 'OLLAMA_REQUEST') {
    fetch(message.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.body)
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`HTTP ${response.status}: ${text || 'Errore sconosciuto'}`);
        });
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true;
  }
  
  if (message.type === 'GET_CURRENT_TEXTAREA') {
    sendResponse(currentTextarea);
    return true;
  }
  
  return false;
});

browser.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

browser.runtime.onStartup.addListener(() => {
  initializeExtension();
});

initializeExtension();
