(function () {
  "use strict";

  const DEFAULT_URL = "http://localhost:11434";
  const DEFAULT_MODEL = "llama3";
  const DEFAULT_TONE = "professionale";
  const LANGUAGE_PREF_DEFAULT = "system";
  const DEFAULT_LANGUAGE = "it";

  // Helper per logging condizionale - verrà usato lo stato per determinare se loggare
  function debugLog(...args) {
    if (state.debugMode) {
      console.log('[Ollama Debug]', ...args);
    }
  }

  function debugWarn(...args) {
    if (state.debugMode) {
      console.warn('[Ollama Debug]', ...args);
    }
  }

  function debugError(...args) {
    if (state.debugMode) {
      console.error('[Ollama Debug]', ...args);
    }
  }

  if (window.ollamaAssistantInjected) return;
  window.ollamaAssistantInjected = true;

  if (!shouldInject()) return;

  function formatTemplate(template, values = {}) {
    if (!template) return "";
    return template.replace(/\$\{(\w+)\}/g, (_, key) =>
      typeof values[key] === "undefined" ? "" : String(values[key])
    );
  }

  // Fallback se OllamaI18N non è caricato
  const FALLBACK_STRINGS = {
    ai: {
      htmlSystem: "You are an HTML editor assistant. CRITICAL RULES:\n1. PRESERVE ALL HTML tags, attributes, and structure EXACTLY as received\n2. PRESERVE ALL formatting tags like <strong>, <em>, <b>, <i>, <u>, <br>, paragraphs, lists, etc.\n3. Only modify the TEXT CONTENT inside tags, never remove or change the HTML structure\n4. If text has formatting (bold, italic, lists), KEEP that formatting in the output\n5. Return ONLY the modified HTML without code blocks, explanations, or quotes",
      htmlUserTemplate: "HTML content:\n${text}\n\nInstruction: ${prompt}\nTone: ${tone}.\n\nIMPORTANT: Modify only the text content. Keep ALL HTML tags and formatting EXACTLY as in the original.",
      plainSystem: "You transform user text. Always keep the same language as the input unless the user explicitly asks for a translation. Return only the transformed text without quotes, code blocks, or explanations.",
      plainUserTemplate: "Original text:\n${text}\n\nRequest: ${prompt}\nTone: ${tone}.\nReturn only the improved text.",
    },
    widget: {
      title: "Ollama Assistant",
      closeLabel: "Chiudi",
      toneLabel: "Tono",
      promptLabel: "Prompt",
      promptPlaceholder: "Scrivi il tuo prompt...",
      customPromptPlaceholder: "Descrivi la tua istruzione...",
      selectTextAlert: "Seleziona del testo prima di aprire l'assistente.",
      selectPromptError: "Seleziona un prompt o scrivi un'istruzione.",
      askButton: "Elabora",
      accept: "Accetta",
      modify: "Modifica",
      discard: "Scarta",
      retry: "Riprova",
      loading: "Elaborazione in corso...",
    },
    tones: [
      { value: "formale", label: "Formale" },
      { value: "professionale", label: "Professionale" },
      { value: "amichevole", label: "Amichevole" },
      { value: "casual", label: "Casual" },
    ],
    toneMentions: {
      formale: "formal",
      professionale: "professional",
      amichevole: "friendly",
      casual: "casual",
    },
    prompts: [
      "Correggi gli errori grammaticali",
      "Rendi il testo più chiaro",
      "Riassumi mantenendo i concetti chiave"
    ],
  };

  const getLanguagePack = () => {
    if (typeof window.OllamaI18N === 'undefined') {
      console.warn('OllamaI18N non disponibile nel content script, uso fallback');
      return FALLBACK_STRINGS;
    }
    const lang = window.OllamaI18N.resolveLanguage(LANGUAGE_PREF_DEFAULT);
    return window.OllamaI18N.get(lang);
  };

  const state = {
    floatingWidget: null,
    inPageWidget: null,
    widgetHost: null,
    widgetShadow: null,
    conversationHistory: [],
    lastSelectedText: "",
    lastActiveElement: null,
    lastSelectionStart: 0,
    lastSelectionEnd: 0,
    savedRange: null,
    savedSelection: null, // Backup della selezione prima che venga persa
    isWidgetOpen: false, // Previene aperture multiple
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    widgetStart: { x: 0, y: 0 },
    currentDragHandle: null,
    selectedTone: DEFAULT_TONE,
    selectionTimeout: null,
    languagePreference: LANGUAGE_PREF_DEFAULT,
    language: typeof window.OllamaI18N !== 'undefined' ? window.OllamaI18N.resolveLanguage(LANGUAGE_PREF_DEFAULT) : DEFAULT_LANGUAGE,
    strings: getLanguagePack(),
    debugMode: false, // Flag per abilitare i log di debug
    config: {
      ollamaUrl: DEFAULT_URL,
      defaultModel: DEFAULT_MODEL,
      defaultPrompts: [],
      defaultTone: DEFAULT_TONE,
      showFloatingWidget: true,
    },
  };
  state.config.defaultPrompts = state.strings.prompts ? [...state.strings.prompts] : [];

  init();

  async function init() {
    await hydrateSettings();
    subscribeToStorageChanges();

    document.addEventListener("mouseup", handleSelectionChange, true);
    document.addEventListener("keyup", handleSelectionChange, true);
    document.addEventListener("selectionchange", () => {
      clearTimeout(state.selectionTimeout);
      state.selectionTimeout = setTimeout(() => captureSelection(false), 60);
    });
    document.addEventListener("mousemove", handleWidgetDragMove);
    document.addEventListener("mouseup", handleWidgetDragEnd);

    browser.runtime.onMessage.addListener(handleRuntimeMessage);
  }
  function shouldInject() {
    try {
      if (window.top === window.self) {
        return true;
      }
      try {
        return window.top.location.hostname === window.location.hostname;
      } catch (error) {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async function hydrateSettings() {
    const stored = await browser.storage.local.get([
      "ollamaUrl",
      "defaultModel",
      "defaultPrompts",
      "defaultTone",
      "showFloatingWidget",
      "language",
      "debugMode",
    ]);

    state.languagePreference = stored.language || LANGUAGE_PREF_DEFAULT;
    if (typeof window.OllamaI18N !== 'undefined') {
      state.language = window.OllamaI18N.resolveLanguage(state.languagePreference);
      state.strings = window.OllamaI18N.get(state.language);
    }
    state.config.ollamaUrl = stored.ollamaUrl || DEFAULT_URL;
    state.config.defaultModel = stored.defaultModel || DEFAULT_MODEL;
    state.config.defaultPrompts =
      stored.defaultPrompts && stored.defaultPrompts.length
        ? stored.defaultPrompts
        : [...state.strings.prompts];
    state.config.defaultTone = stored.defaultTone || DEFAULT_TONE;
    state.config.showFloatingWidget = stored.showFloatingWidget !== false;
    state.selectedTone = state.config.defaultTone;
    state.debugMode = stored.debugMode === true;
  }

  function subscribeToStorageChanges() {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.ollamaUrl) {
        state.config.ollamaUrl = changes.ollamaUrl.newValue || DEFAULT_URL;
      }
      if (changes.defaultModel) {
        state.config.defaultModel = changes.defaultModel.newValue || DEFAULT_MODEL;
      }
      if (changes.defaultPrompts) {
        state.config.defaultPrompts = changes.defaultPrompts.newValue || [];
        renderPromptButtons();
      }
      if (changes.defaultTone) {
        state.config.defaultTone = changes.defaultTone.newValue || DEFAULT_TONE;
        state.selectedTone = state.config.defaultTone;
        renderToneButtons();
      }
      if (changes.debugMode) {
        state.debugMode = changes.debugMode.newValue === true;
      }
      if (changes.language) {
        state.languagePreference = changes.language.newValue || LANGUAGE_PREF_DEFAULT;
        if (typeof window.OllamaI18N !== 'undefined') {
          state.language = window.OllamaI18N.resolveLanguage(state.languagePreference);
          state.strings = window.OllamaI18N.get(state.language);
        }
        if (!state.config.defaultPrompts.length) {
          state.config.defaultPrompts = [...state.strings.prompts];
        }
        if (state.widgetHost) {
          state.widgetHost.remove();
          state.widgetHost = null;
          state.widgetShadow = null;
        }
        state.currentDragHandle = null;
        state.inPageWidget = null;
        if (state.floatingWidget) {
          const button = state.floatingWidget.querySelector("button");
          if (button) button.title = state.strings.widget.title;
        }
        renderToneButtons();
        renderPromptButtons();
      }
      if (changes.showFloatingWidget) {
        state.config.showFloatingWidget = changes.showFloatingWidget.newValue !== false;
        if (!state.config.showFloatingWidget && state.floatingWidget) {
          state.floatingWidget.style.display = "none";
        }
      }
    });
  }

  function resolveEditableContext() {
    const activeElement = document.activeElement;
    debugLog('Resolving context for:', activeElement?.tagName, activeElement?.className);

    // Check if active element is an iframe
    if (activeElement && activeElement.tagName === "IFRAME") {
      try {
        const iframeDoc = activeElement.contentDocument || activeElement.contentWindow.document;
        const body = iframeDoc.body;
        if (body && (body.isContentEditable || body.contentEditable === "true")) {
          debugLog('Found editable iframe body');
          return { element: body, iframe: activeElement, iframeDoc, inIframe: true };
        }
      } catch (error) {
        debugWarn('Cannot access iframe:', error.message);
        return { element: document.body, iframe: null, iframeDoc: document, inIframe: false };
      }
    }

    // Check for CKEditor iframe
    const ckIframe = findCkEditorIframe();
    if (ckIframe) {
      try {
        const iframeDoc = ckIframe.contentDocument || ckIframe.contentWindow.document;
        debugLog('Found CKEditor iframe');
        return { element: iframeDoc.body, iframe: ckIframe, iframeDoc, inIframe: true };
      } catch (error) {
        debugWarn('Cannot access CKEditor iframe:', error.message);
      }
    }

    // Check if active element itself is editable
    if (activeElement && isEditableElement(activeElement)) {
      debugLog('Active element is editable:', activeElement.tagName);
      return { element: activeElement, iframe: null, iframeDoc: document, inIframe: false };
    }

    // Fallback to document.body
    debugLog('Using fallback: document.body');
    return { element: document.body, iframe: null, iframeDoc: document, inIframe: false };
  }

  function findCkEditorIframe() {
    const iframes = document.querySelectorAll("iframe.cke_wysiwyg_frame, iframe[class*='cke']");
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (
          iframeDoc &&
          iframeDoc.body &&
          (iframeDoc.body.isContentEditable || iframeDoc.body.contentEditable === "true")
        ) {
          return iframe;
        }
      } catch (error) {
        // Ignore cross-origin frames.
      }
    }
    return null;
  }

  function getCleanHTML(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll("script, style").forEach((el) => el.remove());

    const allowedTags = new Set([
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "span",
      "div",
      "code",
      "pre",
      "blockquote",
    ]);

    const cleanNode = (current) => {
      if (current.nodeType !== Node.ELEMENT_NODE) return;
      const tagName = current.tagName.toLowerCase();
      if (!allowedTags.has(tagName)) {
        const span = current.ownerDocument.createElement("span");
        while (current.firstChild) {
          span.appendChild(current.firstChild);
        }
        current.parentNode?.replaceChild(span, current);
        cleanNode(span);
        return;
      }

      if (tagName === "a") {
        const href = current.getAttribute("href");
        const saved = current.getAttribute("data-cke-saved-href");
        Array.from(current.attributes).forEach((attr) => current.removeAttribute(attr.name));
        if (saved) {
          current.setAttribute("href", saved);
        } else if (href) {
          current.setAttribute("href", href);
        }
      } else {
        Array.from(current.attributes).forEach((attr) => current.removeAttribute(attr.name));
      }

      Array.from(current.childNodes).forEach(cleanNode);
    };

    cleanNode(clone);
    return clone.innerHTML || "";
  }

  function getTextFromElement(element) {
    if (!element) return "";
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      return element.value || "";
    }

    if (element.isContentEditable || element.contentEditable === "true" || element.tagName === "BODY") {
      if (state.savedRange) {
        try {
          const fragment = state.savedRange.cloneContents();
          const temp = (element.ownerDocument || document).createElement("div");
          temp.appendChild(fragment);
          return getCleanHTML(temp);
        } catch (error) {
          return element.innerHTML || element.textContent || "";
        }
      }
      return getCleanHTML(element);
    }

    if (element.tagName === "IFRAME") {
      try {
        const iframeDoc = element.contentDocument || element.contentWindow.document;
        return getCleanHTML(iframeDoc.body);
      } catch (error) {
        return "";
      }
    }

    return element.textContent || "";
  }

  function isEditableElement(element) {
    if (!element) return false;
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") return true;
    if (element.isContentEditable || element.contentEditable === "true") return true;
    if (element.tagName === "IFRAME") {
      try {
        const iframeDoc = element.contentDocument || element.contentWindow.document;
        if (
          iframeDoc &&
          iframeDoc.body &&
          (iframeDoc.body.isContentEditable || iframeDoc.body.contentEditable === "true")
        ) {
          return true;
        }
      } catch (error) {
        return false;
      }
    }
    return false;
  }
  function handleSelectionChange() {
    clearTimeout(state.selectionTimeout);
    // Quando l'utente fa una nuova selezione, invalida quella salvata
    state.savedSelection = null;
    state.selectionTimeout = setTimeout(() => captureSelection(true), 40);
  }

  function captureSelection(updateFloatingWidget) {
    const context = resolveEditableContext();
    const doc = context.iframeDoc;
    const selection = doc.getSelection ? doc.getSelection() : window.getSelection();

    // Per elementi contentEditable, estrai HTML invece di solo testo
    let selectedText = "";
    const isContentEditableContext = context.element &&
      (context.element.isContentEditable || context.element.contentEditable === "true" || context.element.tagName === "BODY");

    if (selection && selection.rangeCount > 0 && isContentEditableContext) {
      try {
        const range = selection.getRangeAt(0);
        const fragment = range.cloneContents();
        const tempDiv = doc.createElement("div");
        tempDiv.appendChild(fragment);
        const htmlContent = getCleanHTML(tempDiv);

        // Se abbiamo HTML significativo, usalo; altrimenti usa il testo plain
        if (htmlContent && htmlContent.trim().length > 0 && /<[a-z][\s\S]*>/i.test(htmlContent)) {
          selectedText = htmlContent;
          debugLog('Extracted HTML from selection');
        } else {
          selectedText = selection.toString().trim();
          debugLog('Using plain text from selection (no HTML tags found)');
        }
      } catch (error) {
        debugWarn('Error extracting HTML from selection, falling back to text:', error.message);
        selectedText = selection ? selection.toString().trim() : "";
      }
    } else {
      selectedText = selection ? selection.toString().trim() : "";
    }

    // Debug logging
    debugLog('Capture Selection:', {
      hasSelection: !!selection,
      rangeCount: selection?.rangeCount || 0,
      selectedText: selectedText.substring(0, 100),
      selectedTextLength: selectedText.length,
      elementTag: context.element?.tagName,
      isContentEditable: context.element?.isContentEditable,
      inIframe: context.inIframe,
      hasSavedSelection: !!state.savedSelection,
      containsHtml: /<[a-z][\s\S]*>/i.test(selectedText)
    });

    // Se abbiamo già una selezione salvata e valida, usiamola invece di catturarne una nuova
    // Questo previene la perdita della selezione quando il focus cambia
    if (state.savedSelection && state.savedSelection.text && state.savedSelection.text.trim().length > 0) {
      debugLog('Using previously saved selection:', state.savedSelection.text.substring(0, 50));
      state.lastSelectedText = state.savedSelection.text;
      state.lastActiveElement = state.savedSelection.element;
      state.savedRange = state.savedSelection.range;
      state.lastSelectionStart = state.savedSelection.start;
      state.lastSelectionEnd = state.savedSelection.end;

      const hasValidText = state.lastSelectedText && state.lastSelectedText.trim().length > 0;
      debugLog('Using saved selection, hasValidText:', hasValidText);
      return hasValidText;
    }

    state.lastActiveElement = context.element;

    if (selectedText && selectedText.length > 0) {
      state.lastSelectedText = selectedText;
      debugLog('Using user selection:', selectedText.substring(0, 50));

      if (context.element && (context.element.tagName === "TEXTAREA" || context.element.tagName === "INPUT")) {
        state.lastSelectionStart = context.element.selectionStart || 0;
        state.lastSelectionEnd = context.element.selectionEnd || selectedText.length;
        // Salva la selezione per uso futuro
        state.savedSelection = {
          text: selectedText,
          element: context.element,
          range: null,
          start: state.lastSelectionStart,
          end: state.lastSelectionEnd
        };
      } else if (
        context.element &&
        (context.element.isContentEditable || context.element.tagName === "BODY") &&
        selection.rangeCount > 0
      ) {
        try {
          state.savedRange = selection.getRangeAt(0).cloneRange();
          state.lastSelectionStart = 0;
          state.lastSelectionEnd = selectedText.length;
          // Salva la selezione per uso futuro
          state.savedSelection = {
            text: selectedText,
            element: context.element,
            range: state.savedRange.cloneRange(),
            start: 0,
            end: selectedText.length
          };
          debugLog('Range saved successfully');
        } catch (error) {
          debugError('Error saving range:', error);
        }
      }
    } else {
      debugLog('No selection, trying fallback');
      const fallback = getTextFromElement(context.element);
      debugLog('Fallback text length:', fallback.length);

      state.lastSelectedText = fallback;
      if (context.element && (context.element.tagName === "TEXTAREA" || context.element.tagName === "INPUT")) {
        state.lastSelectionStart = 0;
        state.lastSelectionEnd = fallback.length;
      } else if (context.element && (context.element.isContentEditable || context.element.tagName === "BODY")) {
        try {
          const range = doc.createRange();
          range.selectNodeContents(context.element);
          state.savedRange = range.cloneRange();
          state.lastSelectionStart = 0;
          state.lastSelectionEnd = fallback.length;
        } catch (error) {
          debugError('Error creating fallback range:', error);
        }
      }
    }

    const hasValidText = state.lastSelectedText && state.lastSelectedText.trim().length > 0;
    debugLog('Final state:', {
      hasValidText: hasValidText,
      textLength: state.lastSelectedText?.length || 0,
      willShowWidget: updateFloatingWidget && hasValidText,
      savedSelectionExists: !!state.savedSelection
    });

    if (updateFloatingWidget && hasValidText) {
      maybeShowFloatingWidget(context, selection);
    }

    return hasValidText;
  }

  function ensureGlobalStyles() {
    if (document.getElementById("ollama-global-styles")) return;
    const style = document.createElement("style");
    style.id = "ollama-global-styles";
    style.textContent = `
      #ollama-floating-widget {
        position: absolute;
        z-index: 2147483647;
        display: none;
      }
      #ollama-floating-widget .ollama-widget-content {
        background: #ffffff;
        border-radius: 10px;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
        padding: 4px;
      }
      #ollama-floating-widget .ollama-widget-btn {
        width: 42px;
        height: 42px;
        border: none;
        background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
        color: #fff;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      #ollama-floating-widget .ollama-widget-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 18px rgba(37, 99, 235, 0.35);
      }
      #ollama-floating-widget svg {
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFloatingWidget() {
    if (state.floatingWidget) return state.floatingWidget;
     ensureGlobalStyles();
    const widget = document.createElement("div");
    widget.id = "ollama-floating-widget";
    widget.className = "ollama-floating-widget";
    widget.innerHTML = `
      <div class="ollama-widget-content">
        <button class="ollama-widget-btn" title="${state.strings.widget.title}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </button>
      </div>
    `;
    widget.style.position = "absolute";
    widget.style.zIndex = "2147483647";
    widget.style.display = "none";

    // Usa event listener con debounce per prevenire click multipli
    const button = widget.querySelector("button");
    let clickTimeout = null;
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Previeni click multipli sia con debounce che con il flag isWidgetOpen
      if (clickTimeout || state.isWidgetOpen) {
        debugLog('Click ignored (debounce or widget already open)');
        return;
      }

      clickTimeout = setTimeout(() => {
        clickTimeout = null;
      }, 500); // Aumentato a 500ms per maggiore sicurezza

      openWidget(null, false);
    });

    document.body.appendChild(widget);
    state.floatingWidget = widget;
    return widget;
  }

  function maybeShowFloatingWidget(context, selection) {
    if (!state.config.showFloatingWidget) {
      if (state.floatingWidget) state.floatingWidget.style.display = "none";
      return;
    }

    if (!isEditableElement(context.element)) {
      if (state.floatingWidget) state.floatingWidget.style.display = "none";
      return;
    }

    if (!selection || selection.rangeCount === 0) {
      if (state.floatingWidget) state.floatingWidget.style.display = "none";
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      if (state.floatingWidget) state.floatingWidget.style.display = "none";
      return;
    }

    const widget = ensureFloatingWidget();
    let offsetX = 0;
    let offsetY = 0;
    if (context.inIframe && context.iframe) {
      const iframeRect = context.iframe.getBoundingClientRect();
      offsetX = iframeRect.left;
      offsetY = iframeRect.top;
    }

    widget.style.left = `${rect.left + offsetX + rect.width / 2 + window.scrollX - 20}px`;
    widget.style.top = `${rect.top + offsetY + window.scrollY - 50}px`;
    widget.style.display = "block";

    setTimeout(() => {
      if (state.floatingWidget) state.floatingWidget.style.display = "none";
    }, 5000);
  }
  function ensureWidget() {
    if (state.inPageWidget) return state.inPageWidget;
    ensureGlobalStyles();
    if (!state.widgetHost) {
      state.widgetHost = document.createElement("div");
      state.widgetHost.id = "ollama-widget-host";
      state.widgetShadow = state.widgetHost.attachShadow({ mode: "open" });
      document.body.appendChild(state.widgetHost);
    } else if (!state.widgetShadow) {
      state.widgetShadow =
        state.widgetHost.shadowRoot ||
        state.widgetHost.attachShadow({ mode: "open" });
    }

    const shadow = state.widgetShadow;
    shadow.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = getInPageWidgetStyles();
    shadow.appendChild(style);

    const t = state.strings.widget;
    const widget = document.createElement("div");
    widget.id = "ollama-inpage-widget";
    widget.innerHTML = `
      <div class="ollama-widget-header" id="ollama-drag-handle">
        <div class="ollama-header-content">
          <img class="ollama-logo" alt="Ollama Logo" />
          <h3>${t.title}</h3>
        </div>
        <button class="ollama-close-btn" title="${t.closeLabel || "Close"}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="ollama-widget-body">
        <div class="ollama-loading hidden">
          <div class="ollama-spinner"></div>
          <p class="ollama-loading-text">${t.loading}</p>
        </div>
        <div class="ollama-controls">
          <label>${t.toneLabel}</label>
          <div class="ollama-tone-buttons" id="ollama-tone-buttons"></div>
          <label>${t.promptLabel}</label>
          <textarea id="ollama-prompt-field" placeholder="${t.customPromptPlaceholder || t.promptPlaceholder}"></textarea>
          <div class="ollama-prompts-grid" id="ollama-prompts"></div>
          <button class="ollama-ask-btn" id="ollama-ask-btn">${t.askButton}</button>
        </div>
        <div class="ollama-preview hidden">
          <label>${t.resultLabel}</label>
          <div class="ollama-preview-text" id="ollama-preview-text"></div>
          <div class="ollama-actions">
            <button class="ollama-btn ollama-accept">${t.accept}</button>
            <button class="ollama-btn ollama-modify">${t.modify}</button>
            <button class="ollama-btn ollama-discard">${t.discard}</button>
          </div>
        </div>
        <div class="ollama-error hidden">
          <div class="error-icon">!</div>
          <p id="ollama-error-text"></p>
          <button class="ollama-btn ollama-retry">${t.retry}</button>
        </div>
      </div>
    `;

    widget.style.position = "fixed";
    widget.style.top = "50%";
    widget.style.left = "50%";
    widget.style.transform = "translate(-50%, -50%)";
    widget.style.zIndex = "2147483647";
    widget.style.display = "none";

    shadow.appendChild(widget);
    wireWidgetEvents(widget);

    const logoImg = widget.querySelector(".ollama-logo");
    if (logoImg) {
      logoImg.src = browser.runtime.getURL("icons/icon-48.png");
    }

    state.inPageWidget = widget;
    return widget;
  }
  function getInPageWidgetStyles() {
    return `
      #ollama-inpage-widget,
      #ollama-inpage-widget * {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #1f2933;
      }
      #ollama-inpage-widget h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #fff;
      }
      #ollama-inpage-widget label {
        color: #1f2933;
        font-weight: 600;
        margin-bottom: 10px;
        display: block;
      }
      #ollama-inpage-widget {
        width: 520px;
        max-height: 85vh;
        background: #ffffff;
        border-radius: 18px;
        box-shadow: 0 25px 70px rgba(15, 23, 42, 0.35);
      }
      .ollama-widget-header {
        background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
        color: #fff;
        padding: 18px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: grab;
        user-select: none;
      }
      .ollama-header-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .ollama-logo {
        width: 32px;
        height: 32px;
        border-radius: 8px;
      }
      .ollama-close-btn {
        border: none;
        background: transparent;
        color: #fff;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
      }
      .ollama-close-btn:hover {
        background: rgba(255, 255, 255, 0.18);
      }
      .ollama-widget-body {
        padding: 24px;
        max-height: calc(85vh - 72px);
        overflow-y: auto;
        background: #f8fafc;
      }
      .ollama-tone-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 16px;
      }
      .ollama-tone-btn,
      .ollama-prompt-btn {
        border: 2px solid #d9e2ec;
        border-radius: 10px;
        padding: 10px 12px;
        background: #f8fafc;
        cursor: pointer;
        font-weight: 500;
        color: #1f2933;
        transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .ollama-tone-btn:not(.selected),
      .ollama-prompt-btn:not(.selected) {
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      .ollama-tone-btn:hover:not(.selected),
      .ollama-prompt-btn:hover:not(.selected) {
        background: #edf2ff;
        border-color: #a3bffa;
      }
      .ollama-tone-btn.selected,
      .ollama-prompt-btn.selected {
        background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 10px 24px rgba(37, 99, 235, 0.35);
      }
      #ollama-prompt-field {
        width: 100%;
        min-height: 90px;
        padding: 12px 16px;
        border: 2px solid #d9e2ec;
        border-radius: 12px;
        margin-bottom: 16px;
        resize: vertical;
        font-size: 14px;
        background: #fff;
        color: #1f2933 !important;
      }
      .ollama-prompts-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin-bottom: 16px;
      }
      .ollama-ask-btn {
        width: 100%;
        padding: 14px 20px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .ollama-ask-btn:hover {
        box-shadow: 0 12px 24px rgba(16, 185, 129, 0.35);
        transform: translateY(-1px);
      }
      .ollama-loading,
      .ollama-preview,
      .ollama-error {
        margin-top: 20px;
      }
      .ollama-loading-text {
        color: #1f2933 !important;
      }
      .ollama-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #d9e2ec;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: ollama-spin 0.8s linear infinite;
        margin: 0 auto 16px;
      }
      @keyframes ollama-spin {
        to { transform: rotate(360deg); }
      }
      .ollama-preview-text {
        border: 2px solid #d9e2ec;
        border-radius: 12px;
        padding: 16px;
        max-height: 320px;
        overflow-y: auto;
        white-space: pre-wrap;
        background: #fff;
        color: #1f2933 !important;
      }
      .ollama-preview-text * {
        color: inherit !important;
      }
      .ollama-actions {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 16px;
      }
      .ollama-btn {
        border: none;
        border-radius: 12px;
        padding: 12px 16px;
        cursor: pointer;
        font-weight: 600;
      }
      .ollama-accept { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #fff; }
      .ollama-modify { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #fff; }
      .ollama-discard { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #fff; }
      .ollama-retry {
        background: linear-gradient(135deg, #475569 0%, #1e293b 100%);
        color: #fff;
        width: 100%;
      }
      .ollama-error {
        border: 2px solid #fecaca;
        border-radius: 12px;
        padding: 20px;
        background: #fff5f5;
        text-align: center;
      }
      .ollama-error p {
        color: #1f2933 !important;
      }
      .ollama-error .error-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid #ef4444;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
        font-weight: 700;
        color: #ef4444 !important;
      }
      .hidden { display: none !important; }
    `;
  }
  function wireWidgetEvents(widget) {
    const dragHandle = widget.querySelector("#ollama-drag-handle");
    dragHandle.addEventListener("mousedown", (event) => {
      if (event.target.closest(".ollama-close-btn")) return;
      state.isDragging = true;
      state.dragStart = { x: event.clientX, y: event.clientY };
      const rect = widget.getBoundingClientRect();
      state.widgetStart = { x: rect.left, y: rect.top };
      dragHandle.style.cursor = "grabbing";
      state.currentDragHandle = dragHandle;
      widget.style.transition = "none";
      event.preventDefault();
    });

    widget.querySelector(".ollama-close-btn").addEventListener("click", closeWidget);
    widget.querySelector("#ollama-ask-btn").addEventListener("click", handleAskFromWidget);
    widget.querySelector(".ollama-accept").addEventListener("click", handleAcceptFromWidget);
    widget.querySelector(".ollama-discard").addEventListener("click", closeWidget);
    widget.querySelector(".ollama-modify").addEventListener("click", () => {
      widget.querySelector(".ollama-preview").classList.add("hidden");
      widget.querySelector(".ollama-controls").classList.remove("hidden");
      const promptField = widget.querySelector("#ollama-prompt-field");
      if (promptField) {
        promptField.placeholder =
          state.strings.widget.modifyPlaceholder ||
          state.strings.widget.customPromptPlaceholder ||
          state.strings.widget.promptPlaceholder;
        promptField.focus();
      }
    });
    widget.querySelector(".ollama-retry").addEventListener("click", () => {
      widget.querySelector(".ollama-error").classList.add("hidden");
      widget.querySelector(".ollama-controls").classList.remove("hidden");
      const promptField = widget.querySelector("#ollama-prompt-field");
      if (promptField) {
        promptField.placeholder =
          state.strings.widget.customPromptPlaceholder ||
          state.strings.widget.promptPlaceholder;
      }
    });
  }

  function handleWidgetDragMove(event) {
    if (!state.isDragging || !state.inPageWidget) return;
    const deltaX = event.clientX - state.dragStart.x;
    const deltaY = event.clientY - state.dragStart.y;
    state.inPageWidget.style.left = `${state.widgetStart.x + deltaX}px`;
    state.inPageWidget.style.top = `${state.widgetStart.y + deltaY}px`;
    state.inPageWidget.style.transform = "none";
  }

  function handleWidgetDragEnd() {
    if (!state.isDragging) return;
    state.isDragging = false;
    if (state.currentDragHandle) {
      state.currentDragHandle.style.cursor = "grab";
      state.currentDragHandle = null;
    }
  }

  function renderToneButtons() {
    if (!state.inPageWidget) return;
    const container = state.inPageWidget.querySelector("#ollama-tone-buttons");
    if (!container) return;
    container.innerHTML = "";
    (state.strings.tones || []).forEach((tone) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ollama-tone-btn";
      button.dataset.tone = tone.value;
      button.textContent = tone.label;
      if (tone.value === state.selectedTone) {
        button.classList.add("selected");
      }
      button.addEventListener("click", () => {
        state.selectedTone = tone.value;
        renderToneButtons();
      });
      container.appendChild(button);
    });
  }

  function renderPromptButtons(selectedPrompt) {
    if (!state.inPageWidget) return;
    const container = state.inPageWidget.querySelector("#ollama-prompts");
    container.innerHTML = "";
    state.config.defaultPrompts.forEach((prompt) => {
      const button = document.createElement("button");
      button.className = "ollama-prompt-btn";
      button.textContent = prompt;
      if (prompt === selectedPrompt) button.classList.add("selected");
      button.addEventListener("click", () => {
        container.querySelectorAll(".ollama-prompt-btn").forEach((btn) => btn.classList.remove("selected"));
        button.classList.add("selected");
        state.inPageWidget.querySelector("#ollama-prompt-field").value = "";
      });
      container.appendChild(button);
    });
  }


  function openWidget(selectedPrompt, isCustomPrompt) {
    // Previeni aperture multiple
    if (state.isWidgetOpen) {
      debugLog('Widget already open, ignoring request');
      return;
    }

    debugLog('Opening widget...');

    // Imposta il flag SUBITO per prevenire doppie aperture
    state.isWidgetOpen = true;

    // Prima di chiamare captureSelection, assicurati di NON invalidare la selezione esistente
    // se non abbiamo ancora una savedSelection valida
    const needsCapture = !state.savedSelection || !state.savedSelection.text;

    if (needsCapture) {
      debugLog('Need to capture selection first');
      // Temporaneamente disabilita l'invalidazione della selezione
      const tempSavedSelection = state.savedSelection;
      const hasText = captureSelection(false);

      // Se captureSelection non ha trovato niente ma avevamo una selezione temporanea, ripristinala
      if (!hasText && tempSavedSelection) {
        state.savedSelection = tempSavedSelection;
      }
    }

    debugLog('Has text:', !!state.lastSelectedText);
    debugLog('Last selected text:', state.lastSelectedText?.substring(0, 100));

    if (!state.lastSelectedText || state.lastSelectedText.trim().length === 0) {
      debugError('No text captured, showing alert');
      state.isWidgetOpen = false; // Reset il flag se non possiamo aprire
      alert(state.strings.widget.selectTextAlert);
      return;
    }

    debugLog('Widget state set to open');

    const widget = ensureWidget();
    widget.style.display = "block";
    widget.querySelector(".ollama-controls").classList.remove("hidden");
    widget.querySelector(".ollama-loading").classList.add("hidden");
    widget.querySelector(".ollama-preview").classList.add("hidden");
    widget.querySelector(".ollama-error").classList.add("hidden");
    const promptField = widget.querySelector("#ollama-prompt-field");
    if (promptField) {
      promptField.value = "";
      promptField.placeholder =
        state.strings.widget.customPromptPlaceholder ||
        state.strings.widget.promptPlaceholder;
    }
    widget.querySelector("#ollama-ask-btn").textContent =
      state.strings.widget.askButton;

    renderToneButtons();
    renderPromptButtons(selectedPrompt);

    if (selectedPrompt && !isCustomPrompt) {
      setTimeout(handleAskFromWidget, 200);
    } else if (isCustomPrompt) {
      setTimeout(() => widget.querySelector("#ollama-prompt-field").focus(), 150);
    }
  }

  function closeWidget() {
    if (!state.inPageWidget) return;
    state.inPageWidget.style.display = "none";
    state.conversationHistory = [];
    state.isDragging = false;
    state.currentDragHandle = null;
    // Pulisci la selezione salvata quando chiudi il widget
    state.savedSelection = null;
    // Resetta il flag per permettere nuove aperture
    state.isWidgetOpen = false;
    debugLog('Widget closed, saved selection cleared, widget state reset');
  }
  function handleAskFromWidget() {
    if (!state.inPageWidget) return;
    const promptField = state.inPageWidget.querySelector("#ollama-prompt-field");
    const selectedBtn = state.inPageWidget.querySelector(".ollama-prompt-btn.selected");
    const prompt = promptField.value.trim() || (selectedBtn ? selectedBtn.textContent : "");

    if (!prompt) {
      showError(state.strings.widget.selectPromptError);
      return;
    }

    if (!state.lastSelectedText) {
      showError(state.strings.widget.noTextError);
      return;
    }

    showLoading();
    requestOllama(prompt)
      .then((message) => showPreview(message))
      .catch((error) => {
        const packErrors = state.strings.popup?.errors;
        const message =
          packErrors?.ollama && error?.message
            ? packErrors.ollama(
                state.config.ollamaUrl,
                state.config.defaultModel,
                error.message
              )
            : error?.message || packErrors?.connectionFailed || "Ollama request failed. Check your connection.";
        showError(message);
      });
  }

  function showLoading() {
    if (!state.inPageWidget) return;
    state.inPageWidget.querySelector(".ollama-controls").classList.add("hidden");
    state.inPageWidget.querySelector(".ollama-preview").classList.add("hidden");
    state.inPageWidget.querySelector(".ollama-error").classList.add("hidden");
    state.inPageWidget.querySelector(".ollama-loading").classList.remove("hidden");
  }

  function showPreview(content) {
    if (!state.inPageWidget) return;
    const preview = state.inPageWidget.querySelector("#ollama-preview-text");
    if (/<[a-z][\s\S]*>/i.test(content)) {
      preview.innerHTML = content;
    } else {
      preview.textContent = content;
    }
    state.inPageWidget.querySelector(".ollama-loading").classList.add("hidden");
    state.inPageWidget.querySelector(".ollama-error").classList.add("hidden");
    state.inPageWidget.querySelector(".ollama-controls").classList.add("hidden");
    state.inPageWidget.querySelector(".ollama-preview").classList.remove("hidden");
  }

  function showError(message) {
    if (!state.inPageWidget) return;
    state.inPageWidget.querySelector(".ollama-loading").classList.add("hidden");
    state.inPageWidget.querySelector(".ollama-controls").classList.add("hidden");
    const container = state.inPageWidget.querySelector(".ollama-error");
    container.querySelector("#ollama-error-text").textContent = message;
    container.classList.remove("hidden");
  }

  async function requestOllama(prompt) {
    const containsHtml = /<\/?[a-z][\s\S]*>/i.test(state.lastSelectedText);
    debugLog('Request Ollama:', {
      containsHtml: containsHtml,
      textPreview: state.lastSelectedText.substring(0, 100),
      promptType: containsHtml ? 'HTML' : 'Plain'
    });

    const toneText =
      state.strings.toneMentions?.[state.selectedTone] || state.selectedTone;
    const systemPrompt = containsHtml
      ? state.strings.ai.htmlSystem
      : state.strings.ai.plainSystem;
    const template = containsHtml
      ? state.strings.ai.htmlUserTemplate
      : state.strings.ai.plainUserTemplate;

    debugLog('System prompt being used:', systemPrompt.substring(0, 150) + '...');

    const userPrompt = formatTemplate(template, {
      text: state.lastSelectedText,
      prompt,
      tone: toneText,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...state.conversationHistory,
      { role: "user", content: userPrompt },
    ];

    const response = await browser.runtime.sendMessage({
      type: "OLLAMA_REQUEST",
      url: `${state.config.ollamaUrl}/api/chat`,
      body: {
        model: state.config.defaultModel,
        stream: false,
        messages,
      },
    });

    if (!response.success) {
      throw new Error(response.error || "Unknown error");
    }

    let message = response.data?.message?.content;
    if (!message) {
      throw new Error(state.strings.widget.emptyResponse || "Empty response from Ollama");
    }

    message = message.replace(/^```[a-z]*\n?/gi, "").replace(/```$/gi, "").trim();
    message = message.replace(/^['"]|['"]$/g, "").trim();

    if (containsHtml && !/<\/?[a-z]/i.test(message)) {
      throw new Error(state.strings.widget.htmlMissing);
    }

    state.conversationHistory.push({ role: "user", content: userPrompt });
    state.conversationHistory.push({ role: "assistant", content: message });

    return message;
  }
  function handleAcceptFromWidget() {
    if (!state.inPageWidget) return;
    const preview = state.inPageWidget.querySelector("#ollama-preview-text");
    const html = preview.innerHTML.trim();
    const text = preview.textContent.trim();
    const hasHtml = /<\/?[a-z]/i.test(html);
    replaceTextInElement(hasHtml ? html : text);
    // Pulisci la selezione salvata dopo l'inserimento
    state.savedSelection = null;
    closeWidget();
  }

  function replaceTextInElement(newText) {
    if (!state.lastActiveElement) {
      alert(state.strings.widget.insertError);
      return;
    }

    const element = state.lastActiveElement;
    const doc = element.ownerDocument || document;

    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      const value = element.value || "";
      const before = value.substring(0, state.lastSelectionStart);
      const after = value.substring(state.lastSelectionEnd);
      element.value = `${before}${newText}${after}`;
      const caret = state.lastSelectionStart + newText.length;
      element.setSelectionRange(caret, caret);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.focus();
      return;
    }

    if (element.isContentEditable || element.contentEditable === "true" || element.tagName === "BODY") {
      const selection = doc.getSelection ? doc.getSelection() : window.getSelection();
      const range = state.savedRange ? state.savedRange.cloneRange() : doc.createRange();

      if (!state.savedRange) {
        range.selectNodeContents(element);
      }

      selection.removeAllRanges();
      selection.addRange(range);
      range.deleteContents();

      if (/<\/?[a-z]/i.test(newText)) {
        insertHtmlRange(doc, range, newText);
      } else {
        insertPlainTextRange(doc, range, newText);
      }

      selection.removeAllRanges();
      selection.addRange(range);
      state.savedRange = range.cloneRange();
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.focus();
      return;
    }

    alert(state.strings.widget.unsupportedElement);
  }

  function insertHtmlRange(doc, range, html) {
    const tempDiv = doc.createElement("div");
    tempDiv.innerHTML = html;
    const nodes = Array.from(tempDiv.childNodes);
    let lastNode = null;

    nodes.forEach((node, index) => {
      const cloned = node.cloneNode(true);
      range.insertNode(cloned);
      lastNode = cloned;
      if (index < nodes.length - 1) {
        range.setStartAfter(cloned);
        range.collapse(true);
      }
    });

    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
    }
  }

  function insertPlainTextRange(doc, range, text) {
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      const textNode = doc.createTextNode(line);
      range.insertNode(textNode);
      if (index < lines.length - 1) {
        const br = doc.createElement("br");
        range.setStartAfter(textNode);
        range.collapse(true);
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
      } else {
        range.setStartAfter(textNode);
        range.collapse(true);
      }
    });
  }
  function handleRuntimeMessage(message, _sender, sendResponse) {
    if (message.type === "OPEN_WIDGET") {
      // Previeni aperture multiple
      if (state.isWidgetOpen) {
        debugLog('Widget already open, ignoring OPEN_WIDGET message');
        sendResponse({ status: "error", message: "Widget already open" });
        return true;
      }

      // Catturiamo la selezione prima se necessario
      if (!state.savedSelection || !state.savedSelection.text) {
        captureSelection(false);
      }
      if (!state.lastSelectedText && (!state.savedSelection || !state.savedSelection.text)) {
        alert(state.strings.widget.selectTextAlert);
        sendResponse({ status: "error", message: "No text" });
        return true;
      }
      openWidget(message.selectedPrompt, message.isCustom);
      sendResponse({ status: "ok" });
      return true;
    }

    if (message.type === "GET_CONTEXT_TEXT") {
      captureSelection(false);
      sendResponse({
        text: state.lastSelectedText || "",
        hasText: Boolean(state.lastSelectedText),
      });
      return true;
    }

    if (message.type === "REPLACE_TEXT") {
      replaceTextInElement(message.newText || "");
      sendResponse({ status: "ok" });
      return true;
    }

    if (message.type === "CANCEL") {
      closeWidget();
      sendResponse({ status: "ok" });
      return true;
    }

    return false;
  }
})();
