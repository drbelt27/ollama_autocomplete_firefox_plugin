const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3";
const MENU_ICON_SIZES = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
};

let cachedPrompts = [];

// Ottieni i prompt predefiniti tradotti
function getDefaultPrompts() {
  return [
    browser.i18n.getMessage("prompt1"),
    browser.i18n.getMessage("prompt2"),
    browser.i18n.getMessage("prompt3"),
    browser.i18n.getMessage("prompt4"),
    browser.i18n.getMessage("prompt5"),
  ].filter(p => p); // Filtra eventuali stringhe vuote
}

async function initializeExtension() {
  const stored = await browser.storage.local.get([
    "ollamaUrl",
    "defaultPrompts",
    "defaultModel",
  ]);

  const updates = {};

  if (!stored.ollamaUrl) {
    updates.ollamaUrl = DEFAULT_OLLAMA_URL;
  }

  if (!stored.defaultModel) {
    updates.defaultModel = DEFAULT_MODEL;
  }

  // Usa i prompt salvati o quelli predefiniti tradotti
  if (!stored.defaultPrompts || !stored.defaultPrompts.length) {
    cachedPrompts = getDefaultPrompts();
    updates.defaultPrompts = [...cachedPrompts];
  } else {
    cachedPrompts = stored.defaultPrompts;
  }

  if (Object.keys(updates).length) {
    await browser.storage.local.set(updates);
  }

  buildContextMenu();
  console.log('Menu contestuale inizializzato con', cachedPrompts.length, 'prompts');
}

function buildContextMenu() {
  console.log('Creazione menu contestuale');

  browser.contextMenus.removeAll().then(() => {
    // Menu principale
    browser.contextMenus.create({
      id: "ollama-assistant",
      title: browser.i18n.getMessage("contextMenuTitle"),
      contexts: ["selection", "editable"],
      icons: MENU_ICON_SIZES,
    });

    // Aggiungi i prompt predefiniti
    cachedPrompts.forEach((prompt, index) => {
      browser.contextMenus.create({
        id: `ollama-prompt-${index}`,
        parentId: "ollama-assistant",
        title: prompt,
        contexts: ["selection", "editable"],
      });
    });

    // Separatore se ci sono prompt
    if (cachedPrompts.length) {
      browser.contextMenus.create({
        id: "ollama-separator",
        parentId: "ollama-assistant",
        type: "separator",
        contexts: ["selection", "editable"],
      });
    }

    // Prompt personalizzato
    browser.contextMenus.create({
      id: "ollama-custom",
      parentId: "ollama-assistant",
      title: browser.i18n.getMessage("contextMenuCustomPrompt"),
      contexts: ["selection", "editable"],
    });

    console.log('Menu contestuale creato con successo con', cachedPrompts.length, 'prompts');
  }).catch(error => {
    console.error('Errore creazione menu contestuale:', error);
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.defaultPrompts) {
    cachedPrompts = changes.defaultPrompts.newValue || [];
    buildContextMenu();
  }
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  let selectedPrompt = null;
  let isCustom = false;

  if (info.menuItemId.startsWith("ollama-prompt-")) {
    const index = parseInt(info.menuItemId.replace("ollama-prompt-", ""), 10);
    selectedPrompt = cachedPrompts[index] || null;
  } else if (
    info.menuItemId === "ollama-custom" ||
    info.menuItemId === "ollama-assistant"
  ) {
    isCustom = true;
  }

  try {
    await browser.tabs.sendMessage(tab.id, {
      type: "OPEN_WIDGET",
      selectionText: info.selectionText,
      selectedPrompt,
      isCustom,
    });
  } catch (error) {
    browser.notifications
      .create({
        type: "basic",
        title: browser.i18n.getMessage("contextMenuTitle"),
        message: browser.i18n.getMessage("contextMenuNotification"),
      })
      .catch(() => {});
  }
});

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "OLLAMA_REQUEST") return false;

  fetch(message.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.body),
  })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(`HTTP ${response.status}: ${text || "Unknown error"}`);
        });
      }
      return response.json();
    })
    .then((data) => sendResponse({ success: true, data }))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true;
});

browser.runtime.onInstalled.addListener(initializeExtension);
browser.runtime.onStartup.addListener(initializeExtension);

initializeExtension();
