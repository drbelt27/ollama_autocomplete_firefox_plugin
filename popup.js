const DEFAULT_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3";
const DEFAULT_TONE = "professionale";
const LANGUAGE_PREF_DEFAULT = "system";

const state = {
  ollamaUrl: DEFAULT_URL,
  defaultModel: DEFAULT_MODEL,
  defaultTone: DEFAULT_TONE,
  selectedTone: DEFAULT_TONE,
  defaultPrompts: [],
  selectedPrompt: "",
  languagePreference: LANGUAGE_PREF_DEFAULT,
  languageCode: "en",
  languagePack: window.OllamaI18N.get("en"),
  currentText: "",
  hasHtmlContext: false,
  conversationHistory: [],
  lastResponse: "",
  activeModel: DEFAULT_MODEL,
};

document.addEventListener("DOMContentLoaded", init);

function formatTemplate(template, values = {}) {
  if (!template) return "";
  return template.replace(/\$\{(\w+)\}/g, (_, key) =>
    typeof values[key] === "undefined" ? "" : String(values[key])
  );
}

async function init() {
  await loadSettings();
  applyPopupTranslations();
  setupEventListeners();

  const connectionOk = await checkOllamaConnection();
  if (!connectionOk) {
    showConnectionError();
    return;
  }

  await loadModelsInWidget();
  await loadTextareaData();
  renderPredefinedPrompts();
  updateAskBtnState();
  await checkQuickPrompt();
  hideConnectionError();
}

async function loadSettings() {
  const stored = await browser.storage.local.get([
    "ollamaUrl",
    "defaultPrompts",
    "defaultModel",
    "defaultTone",
    "language",
  ]);

  state.ollamaUrl = stored.ollamaUrl || DEFAULT_URL;
  state.defaultModel = stored.defaultModel || DEFAULT_MODEL;
  state.activeModel = state.defaultModel;
  state.defaultTone = stored.defaultTone || DEFAULT_TONE;
  state.selectedTone = state.defaultTone;
  state.languagePreference = stored.language || LANGUAGE_PREF_DEFAULT;
  state.languageCode = window.OllamaI18N.resolveLanguage(state.languagePreference);
  state.languagePack = window.OllamaI18N.get(state.languageCode);
  state.defaultPrompts =
    stored.defaultPrompts && stored.defaultPrompts.length
      ? stored.defaultPrompts
      : [...state.languagePack.prompts];
  state.conversationHistory = [];
  state.selectedPrompt = "";
  state.lastResponse = "";

  document
    .querySelectorAll(".tone-btn")
    .forEach((btn) => btn.classList.toggle("selected", btn.dataset.tone === state.selectedTone));
}

function applyPopupTranslations() {
  const pack = state.languagePack.popup;
  document.title = pack.title;
  const headerTitle = document.querySelector("header h2");
  if (headerTitle) headerTitle.textContent = pack.title;

  const errorTitle = document.querySelector("#connection-error-section .error-message p");
  if (errorTitle) errorTitle.textContent = pack.connectionErrorTitle;
  const errorHelp = document.querySelector("#connection-error-section .error-message .help-text");
  if (errorHelp) errorHelp.textContent = pack.connectionErrorHelp;

  const retryConnectionBtn = document.getElementById("retry-connection-btn");
  if (retryConnectionBtn) retryConnectionBtn.textContent = pack.buttons.retry;
  const openSettingsBtn = document.getElementById("open-settings-btn");
  if (openSettingsBtn) openSettingsBtn.textContent = pack.buttons.settings;

  const modelLabel = document.querySelector(".model-selector label");
  if (modelLabel) modelLabel.textContent = `${pack.labels.model}:`;
  const toneLabel = document.querySelector(".tone-selector label");
  if (toneLabel) toneLabel.textContent = `${pack.labels.tone}:`;
  const lengthLabel = document.querySelector(".length-selector label");
  if (lengthLabel) lengthLabel.textContent = `${pack.labels.length}:`;
  const promptsLabel = document.querySelector(".prompts-section label");
  if (promptsLabel) promptsLabel.textContent = `${pack.labels.prompts}:`;
  const customPromptLabel = document.querySelector(".custom-prompt label");
  if (customPromptLabel) customPromptLabel.textContent = `${pack.labels.customPrompt}:`;

  const customPromptInput = document.getElementById("custom-prompt-input");
  if (customPromptInput) customPromptInput.placeholder = pack.placeholders.customPrompt;
  const modifyLabel = document.querySelector("#modify-section label");
  if (modifyLabel) modifyLabel.textContent = pack.labels.modify;
  const modifyInput = document.getElementById("modify-input");
  if (modifyInput) modifyInput.placeholder = pack.placeholders.modify;

  const lengthSelect = document.getElementById("length");
  if (lengthSelect) {
    Array.from(lengthSelect.options).forEach((option) => {
      if (pack.lengthOptions[option.value]) {
        option.textContent = pack.lengthOptions[option.value];
      }
    });
  }

  const askBtn = document.getElementById("ask-btn");
  if (askBtn) askBtn.textContent = pack.buttons.ask;
  const loadingText = document.querySelector("#loading-section p");
  if (loadingText) loadingText.textContent = pack.loading;
  const previewTitle = document.querySelector("#preview-section h3");
  if (previewTitle) previewTitle.textContent = `${pack.previewTitle}:`;
  const acceptBtn = document.getElementById("accept-btn");
  if (acceptBtn) acceptBtn.textContent = pack.buttons.accept;
  const discardBtn = document.getElementById("discard-btn");
  if (discardBtn) discardBtn.textContent = pack.buttons.discard;
  const modifyBtn = document.getElementById("modify-btn");
  if (modifyBtn) modifyBtn.textContent = pack.buttons.modify;
  const submitModifyBtn = document.getElementById("submit-modify-btn");
  if (submitModifyBtn) submitModifyBtn.textContent = pack.buttons.submitModify;
  const retryBtn = document.getElementById("retry-btn");
  if (retryBtn) retryBtn.textContent = pack.buttons.errorRetry;

  document.querySelectorAll(".tone-btn").forEach((btn) => {
    const toneValue = btn.dataset.tone;
    const toneData = state.languagePack.tones.find((tone) => tone.value === toneValue);
    if (toneData) btn.textContent = toneData.label;
  });
}

function setupEventListeners() {
  const openSettingsBtn = document.getElementById("open-settings-btn");
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
      browser.runtime.openOptionsPage();
      window.close();
    });
  }
  const retryConnectionBtn = document.getElementById("retry-connection-btn");
  if (retryConnectionBtn) {
    retryConnectionBtn.addEventListener("click", async () => {
      retryConnectionBtn.disabled = true;
      await loadSettings();
      applyPopupTranslations();
      const ok = await checkOllamaConnection();
      retryConnectionBtn.disabled = false;
      if (ok) {
        hideConnectionError();
        await loadModelsInWidget();
        await loadTextareaData();
        renderPredefinedPrompts();
        updateAskBtnState();
      } else {
        showConnectionError();
      }
    });
  }

  document.querySelectorAll(".tone-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tone-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.selectedTone = btn.dataset.tone;
    });
  });

  const customInput = document.getElementById("custom-prompt-input");
  if (customInput) {
    customInput.addEventListener("input", () => {
      const val = customInput.value.trim();
      if (val) {
        state.selectedPrompt = "";
        document.querySelectorAll(".prompt-btn").forEach((btn) => btn.classList.remove("selected"));
      }
      updateAskBtnState();
    });
  }

  const modelSelect = document.getElementById("model");
  if (modelSelect) {
    modelSelect.addEventListener("change", updateAskBtnState);
  }

  const askBtn = document.getElementById("ask-btn");
  if (askBtn) askBtn.addEventListener("click", handleAskClick);
  const acceptBtn = document.getElementById("accept-btn");
  if (acceptBtn) acceptBtn.addEventListener("click", handleAccept);
  const discardBtn = document.getElementById("discard-btn");
  if (discardBtn) discardBtn.addEventListener("click", handleDiscard);
  const modifyBtn = document.getElementById("modify-btn");
  if (modifyBtn) modifyBtn.addEventListener("click", handleModifyRequest);
  const submitModifyBtn = document.getElementById("submit-modify-btn");
  if (submitModifyBtn) submitModifyBtn.addEventListener("click", handleSubmitModify);
  const retryBtn = document.getElementById("retry-btn");
  if (retryBtn) retryBtn.addEventListener("click", resetToControls);
}

async function checkOllamaConnection() {
  try {
    const response = await browser.runtime.sendMessage({
      type: "OLLAMA_REQUEST",
      url: `${state.ollamaUrl}/api/tags`,
      body: {},
    });
    return response.success;
  } catch (error) {
    console.error("Connection check failed", error);
    return false;
  }
}

function showConnectionError() {
  document.getElementById("connection-error-section").classList.remove("hidden");
  document.getElementById("controls-section").classList.add("hidden");
}

function hideConnectionError() {
  document.getElementById("connection-error-section").classList.add("hidden");
  document.getElementById("controls-section").classList.remove("hidden");
}

async function loadModelsInWidget() {
  const select = document.getElementById("model");
  if (!select) return;
  select.innerHTML = `<option value="">${state.languagePack.popup.loading || "..."}</option>`;
  select.disabled = true;

  try {
    const response = await browser.runtime.sendMessage({
      type: "OLLAMA_REQUEST",
      url: `${state.ollamaUrl}/api/tags`,
      body: {},
    });
    if (!response.success) throw new Error(response.error || "Failed to load models");
    const models = (response.data.models || []).map((model) => model.name);
    select.innerHTML = "";
    models.forEach((model) => {
      const opt = document.createElement("option");
      opt.value = model;
      opt.textContent = model;
      select.appendChild(opt);
    });
    if (!models.includes(state.defaultModel)) {
      state.defaultModel = models[0] || DEFAULT_MODEL;
    }
    select.value = state.defaultModel;
    select.disabled = false;
  } catch (error) {
    console.error("Model loading failed", error);
    select.innerHTML = "";
    const fallback = document.createElement("option");
    fallback.value = state.defaultModel;
    fallback.textContent = state.defaultModel;
    select.appendChild(fallback);
    select.disabled = false;
  }
}

async function loadTextareaData() {
  try {
    const response = await sendMessageToActiveTab({ type: "GET_CONTEXT_TEXT" });
    state.currentText = response?.text || "";
    state.hasHtmlContext = /<\/?[a-z][\s\S]*>/i.test(state.currentText);
    if (!state.currentText) {
      showError(state.languagePack.popup.errors.missingText);
    }
  } catch (error) {
    console.error("Failed to read active tab", error);
    showError(state.languagePack.popup.errors.missingText);
  }
}

async function sendMessageToActiveTab(payload) {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || tab.id == null) {
    throw new Error("No active tab");
  }
  return browser.tabs.sendMessage(tab.id, payload);
}

function renderPredefinedPrompts() {
  const container = document.getElementById("predefined-prompts");
  if (!container) return;
  container.innerHTML = "";

  state.defaultPrompts.forEach((prompt) => {
    const btn = document.createElement("button");
    btn.className = "prompt-btn";
    btn.textContent = prompt;
    btn.addEventListener("click", () => handlePromptClick(btn, prompt));
    container.appendChild(btn);
  });
}

function handlePromptClick(btn, prompt) {
  const alreadySelected = state.selectedPrompt === prompt;
  document.querySelectorAll(".prompt-btn").forEach((button) => button.classList.remove("selected"));
  if (alreadySelected) {
    state.selectedPrompt = "";
    btn.classList.remove("selected");
  } else {
    state.selectedPrompt = prompt;
    btn.classList.add("selected");
    const customInput = document.getElementById("custom-prompt-input");
    if (customInput) customInput.value = "";
  }
  updateAskBtnState();
}

function updateAskBtnState() {
  const modelSelected = document.getElementById("model")?.value;
  const customPrompt = document.getElementById("custom-prompt-input")?.value.trim();
  const hasPrompt = state.selectedPrompt || customPrompt;
  const enable = Boolean(modelSelected && hasPrompt && !(state.selectedPrompt && customPrompt));
  const askBtn = document.getElementById("ask-btn");
  if (askBtn) askBtn.disabled = !enable;
}

async function handleAskClick() {
  const model = document.getElementById("model")?.value;
  const customPrompt = document.getElementById("custom-prompt-input")?.value.trim();
  const prompt = customPrompt || state.selectedPrompt;

  if (!model || !prompt) {
    showError(state.languagePack.popup.errors.missingPrompt);
    return;
  }
  if (!state.currentText) {
    showError(state.languagePack.popup.errors.missingText);
    return;
  }

  state.activeModel = model;
  await makeOllamaRequest(model, prompt);
}

async function makeOllamaRequest(model, prompt) {
  showLoading();
  const toneMention =
    state.languagePack.toneMentions?.[state.selectedTone] || state.selectedTone;
  const lengthValue = document.getElementById("length")?.value || "media";
  const lengthInstruction =
    state.languagePack.popup.lengthInstructions[lengthValue] || "";
  const expectsHtml = state.hasHtmlContext;
  const aiPack = state.languagePack.ai || {};
  const systemPrompt = expectsHtml
    ? aiPack.htmlSystem
    : state.languagePack.popup.systemPrompt;
  const template = expectsHtml
    ? aiPack.htmlUserTemplate
    : state.languagePack.popup.requestTemplate;
  const userMessage = formatTemplate(template, {
    text: state.currentText,
    prompt,
    tone: toneMention,
    lengthInstruction,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    ...state.conversationHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await browser.runtime.sendMessage({
      type: "OLLAMA_REQUEST",
      url: `${state.ollamaUrl}/api/chat`,
      body: { model, stream: false, messages },
    });
    if (!response.success) throw new Error(response.error || "Request failed");

    let message = response.data?.message?.content || "";
    if (!message) throw new Error("Empty response from Ollama");
    message = message.replace(/^```[a-zA-Z0-9]*\n?/g, "").replace(/```$/g, "").trim();
    message = message.replace(/^['"]|['"]$/g, "").trim();

    if (expectsHtml && !/<\/?[a-z]/i.test(message)) {
      showError(state.languagePack.popup.errors.htmlMissing);
      return;
    }

    state.conversationHistory.push({ role: "user", content: userMessage });
    state.conversationHistory.push({ role: "assistant", content: message });
    state.lastResponse = message;
    showPreview(message, expectsHtml);
  } catch (error) {
    const packErrors = state.languagePack.popup.errors;
    const message =
      packErrors?.ollama && error?.message
        ? packErrors.ollama(state.ollamaUrl, model, error.message)
        : error?.message || packErrors?.connectionFailed || "Ollama request failed.";
    showError(message);
  }
}

function showLoading() {
  ["controls-section", "preview-section", "modify-section", "error-section"].forEach((id) =>
    document.getElementById(id)?.classList.add("hidden")
  );
  document.getElementById("loading-section")?.classList.remove("hidden");
}

function showPreview(text, isHtml) {
  ["controls-section", "loading-section", "modify-section", "error-section"].forEach((id) =>
    document.getElementById(id)?.classList.add("hidden")
  );
  const previewBox = document.getElementById("preview-text");
  if (previewBox) {
    if (isHtml || /<\/?[a-z]/i.test(text)) {
      previewBox.innerHTML = text;
    } else {
      previewBox.textContent = text;
    }
  }
  document.getElementById("preview-section")?.classList.remove("hidden");
}

function showError(message) {
  ["controls-section", "loading-section", "preview-section", "modify-section"].forEach((id) =>
    document.getElementById(id)?.classList.add("hidden")
  );
  const errorText = document.getElementById("error-text");
  if (errorText) errorText.textContent = message;
  document.getElementById("error-section")?.classList.remove("hidden");
}

function resetToControls() {
  ["loading-section", "preview-section", "modify-section", "error-section"].forEach((id) =>
    document.getElementById(id)?.classList.add("hidden")
  );
  document.getElementById("controls-section")?.classList.remove("hidden");
}

async function handleAccept() {
  if (!state.lastResponse) return;
  try {
    await sendMessageToActiveTab({ type: "REPLACE_TEXT", newText: state.lastResponse });
    state.conversationHistory = [];
    window.close();
  } catch (error) {
    console.error("Failed to insert text", error);
    showError("Unable to insert the generated text.");
  }
}

async function handleDiscard() {
  try {
    await sendMessageToActiveTab({ type: "CANCEL" });
  } catch (error) {
    console.warn("Discard message failed", error);
  }
  state.conversationHistory = [];
  window.close();
}

function handleModifyRequest() {
  document.getElementById("preview-section")?.classList.add("hidden");
  document.getElementById("modify-section")?.classList.remove("hidden");
}

async function handleSubmitModify() {
  const modifyInput = document.getElementById("modify-input");
  if (!modifyInput) return;
  const modifyText = modifyInput.value.trim();
  if (!modifyText) {
    alert(state.languagePack.popup.errors.modifyEmpty);
    return;
  }
  await makeOllamaRequest(state.activeModel || state.defaultModel, modifyText);
  modifyInput.value = "";
}

async function checkQuickPrompt() {
  const stored = await browser.storage.local.get(["quickPrompt", "quickPromptActive"]);
  if (stored.quickPromptActive && stored.quickPrompt) {
    document.querySelectorAll(".prompt-btn").forEach((btn) => {
      if (btn.textContent === stored.quickPrompt) {
        btn.classList.add("selected");
        state.selectedPrompt = stored.quickPrompt;
      }
    });
    await browser.storage.local.set({ quickPrompt: null, quickPromptActive: false });
    updateAskBtnState();
    setTimeout(() => {
      const askBtn = document.getElementById("ask-btn");
      if (askBtn && !askBtn.disabled) {
        askBtn.click();
      }
    }, 400);
  }
}
