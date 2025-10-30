(function () {
  "use strict";

  if (window.ollamaAssistantInjected) return;
  window.ollamaAssistantInjected = true;

  console.log("Ollama Assistant caricato");

  let floatingSelectionWidget = null;
  let inPageWidget = null;
  let lastSelectedText = "";
  let lastActiveElement = null;
  let lastSelectionStart = 0;
  let lastSelectionEnd = 0;
  let savedRange = null;
  let conversationHistory = [];
  let ollamaUrl = "";
  let defaultModel = "";
  let defaultPrompts = [];

  browser.storage.local
    .get(["ollamaUrl", "defaultModel", "defaultPrompts"])
    .then((result) => {
      ollamaUrl = result.ollamaUrl || "http://localhost:11434";
      defaultModel = result.defaultModel || "llama3";
      defaultPrompts = result.defaultPrompts || [];
    });

  // FIX CKEditor: Trova iframe CKEditor contenitore
  function findParentCKEditorIframe() {
    const iframes = document.querySelectorAll(
      'iframe.cke_wysiwyg_frame, iframe[class*="cke"]'
    );
    for (let iframe of iframes) {
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;
        if (
          iframeDoc &&
          iframeDoc.body &&
          (iframeDoc.body.isContentEditable ||
            iframeDoc.body.contentEditable === "true")
        ) {
          return iframe;
        }
      } catch (e) {
        // Cross-origin, skip
      }
    }
    return null;
  }

  // FIX CKEditor: Ottieni elemento editabile reale (anche dentro iframe)
  function getActiveEditableElement() {
    let element = document.activeElement;

    // Se activeElement è un iframe CKEditor, prendi il body dentro
    if (element && element.tagName === "IFRAME") {
      try {
        const iframeDoc =
          element.contentDocument || element.contentWindow.document;
        const body = iframeDoc.body;
        if (
          body &&
          (body.isContentEditable || body.contentEditable === "true")
        ) {
          return {
            element: body,
            inIframe: true,
            iframe: element,
            iframeDoc: iframeDoc,
          };
        }
      } catch (e) {
        console.log("Cannot access iframe:", e);
      }
    }

    // Controlla se siamo dentro un iframe CKEditor
    const parentIframe = findParentCKEditorIframe();
    if (parentIframe) {
      try {
        const iframeDoc =
          parentIframe.contentDocument || parentIframe.contentWindow.document;
        const body = iframeDoc.body;
        if (
          body &&
          (body.isContentEditable || body.contentEditable === "true")
        ) {
          return {
            element: body,
            inIframe: true,
            iframe: parentIframe,
            iframeDoc: iframeDoc,
          };
        }
      } catch (e) {
        console.log("Cannot access parent iframe:", e);
      }
    }

    return {
      element: element,
      inIframe: false,
      iframe: null,
      iframeDoc: document,
    };
  }

  // Funzione per ottenere HTML pulito (rimuove classi, ID e attributi inutili)
  function getCleanHTML(element) {
    if (!element) return "";

    // Clone l'elemento per non modificare l'originale
    const clone = element.cloneNode(true);

    // Rimuovi script e style tags
    const scripts = clone.querySelectorAll("script, style");
    scripts.forEach((s) => s.remove());

    // Funzione ricorsiva per pulire gli attributi
    function cleanAttributes(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();

        // Tag da mantenere: tag semantici essenziali
        const allowedTags = [
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
        ];

        if (!allowedTags.includes(tagName)) {
          // Sostituisci tag non permessi con span
          const span = node.ownerDocument.createElement("span");
          while (node.firstChild) {
            span.appendChild(node.firstChild);
          }
          node.parentNode?.replaceChild(span, node);
          return cleanAttributes(span);
        }

        // Per i link, mantieni solo href
        if (tagName === "a") {
          const href = node.getAttribute("href");
          const savedHref = node.getAttribute("data-cke-saved-href");
          Array.from(node.attributes).forEach((attr) =>
            node.removeAttribute(attr.name)
          );
          if (savedHref) {
            node.setAttribute("href", savedHref);
          } else if (href) {
            node.setAttribute("href", href);
          }
        } else {
          // Rimuovi TUTTI gli attributi (class, id, style, data-*, ecc.)
          Array.from(node.attributes).forEach((attr) =>
            node.removeAttribute(attr.name)
          );
        }

        // Ricorsione sui figli
        Array.from(node.childNodes).forEach((child) => cleanAttributes(child));
      }
    }

    cleanAttributes(clone);

    // Ritorna HTML pulito
    let cleanedHTML = clone.innerHTML || "";

    return cleanedHTML;
  }

  // FIX CKEditor: Funzione per ottenere testo anche da iframe (CON HTML PULITO)
  function getTextFromElement(element) {
    if (!element) return "";

    // Textarea/Input standard - restituisci value
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      return element.value || "";
    }

    // ContentEditable standard o BODY CKEditor
    if (
      element.isContentEditable ||
      element.contentEditable === "true" ||
      element.tagName === "BODY"
    ) {
      // FIX: Se c'è un range salvato, estrai HTML solo da quel range
      if (savedRange) {
        try {
          const container = savedRange.cloneContents();
          const tempDiv = (element.ownerDocument || document).createElement(
            "div"
          );
          tempDiv.appendChild(container);

          // Pulisci HTML dal range
          const cleanHTML = getCleanHTML(tempDiv);
          console.log("HTML pulito dal range:", cleanHTML.substring(0, 100));
          return cleanHTML;
        } catch (e) {
          console.error("Errore estrazione HTML dal range:", e);
        }
      }

      // Fallback: usa tutto l'elemento, ma pulito
      const cleanHTML = getCleanHTML(element);
      console.log("HTML pulito dall'elemento:", cleanHTML.substring(0, 100));
      return cleanHTML;
    }

    // Se l'elemento è un iframe, prova ad accedere al body dentro
    if (element.tagName === "IFRAME") {
      try {
        const iframeDoc =
          element.contentDocument || element.contentWindow.document;
        const body = iframeDoc.body;
        if (body) {
          const cleanHTML = getCleanHTML(body);
          return cleanHTML;
        }
      } catch (e) {
        console.log("Cannot access iframe:", e);
      }
    }

    return "";
  }

  // Widget floating piccolo per selezione
  function createFloatingWidget() {
    const widget = document.createElement("div");
    widget.id = "ollama-floating-widget";
    widget.innerHTML = `
      <button class="ollama-widget-btn" title="Ollama AI">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    widget.style.cssText = `
      position: absolute; z-index: 999999; display: none;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); padding: 4px;
    `;

    widget.querySelector("button").style.cssText = `
      border: none; background: transparent; color: white; cursor: pointer;
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    `;

    widget.querySelector("button").onclick = () =>
      openInPageWidget(null, false);
    document.body.appendChild(widget);
    return widget;
  }

  // Widget in-page completo ELEGANTE
  function createInPageWidget() {
    const widget = document.createElement("div");
    widget.id = "ollama-inpage-widget";
    widget.innerHTML = `
      <div class="ollama-widget-header">
        <div class="ollama-header-content">
          <div class="ollama-logo">✨</div>
          <h3>Ollama Assistant</h3>
        </div>
        <button class="ollama-close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="ollama-widget-body">
        <div class="ollama-loading hidden">
          <div class="ollama-spinner"></div>
          <p>Elaborazione in corso...</p>
        </div>
        <div class="ollama-controls">
          <label>💬 Prompt:</label>
          <textarea id="ollama-prompt-field" placeholder="Inserisci il tuo prompt personalizzato..."></textarea>
          <div class="ollama-prompts-grid" id="ollama-prompts"></div>
          <button class="ollama-ask-btn" id="ollama-ask-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            Elabora
          </button>
        </div>
        <div class="ollama-preview hidden">
          <label>✨ Risultato:</label>
          <div class="ollama-preview-text" id="ollama-preview-text"></div>
          <div class="ollama-actions">
            <button class="ollama-btn ollama-accept">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Accetta
            </button>
            <button class="ollama-btn ollama-modify">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Modifica
            </button>
            <button class="ollama-btn ollama-discard">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              Scarta
            </button>
          </div>
        </div>
        <div class="ollama-error hidden">
          <div class="error-icon">⚠️</div>
          <p id="ollama-error-text"></p>
          <button class="ollama-btn ollama-retry">Riprova</button>
        </div>
      </div>
    `;

    widget.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 2147483647; background: white; border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05); 
      width: 550px; max-height: 85vh; overflow: hidden; display: none;
      animation: ollama-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    document.body.appendChild(widget);

    // CSS dinamico ELEGANTE con supporto dark mode
    if (!document.getElementById("ollama-widget-styles")) {
      const style = document.createElement("style");
      style.id = "ollama-widget-styles";
      style.textContent = `
        @keyframes ollama-slide-in {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        
        #ollama-inpage-widget { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; 
          color: #1a202c;
        }
        #ollama-inpage-widget * { box-sizing: border-box; }
        
        @media (prefers-color-scheme: dark) {
          #ollama-inpage-widget { background: #1a202c !important; color: #e2e8f0 !important; }
          #ollama-inpage-widget #ollama-prompt-field { 
            background: #2d3748 !important; color: #e2e8f0 !important; 
            border-color: #4a5568 !important; 
          }
          #ollama-inpage-widget .ollama-prompt-btn { 
            background: #2d3748 !important; color: #e2e8f0 !important; 
            border-color: #4a5568 !important; 
          }
          #ollama-inpage-widget .ollama-prompt-btn:hover { background: #374151 !important; }
          #ollama-inpage-widget .ollama-prompt-btn.selected { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; 
          }
          #ollama-inpage-widget .ollama-preview-text { 
            background: #2d3748 !important; color: #e2e8f0 !important; 
            border-color: #4a5568 !important; 
          }
          #ollama-inpage-widget .ollama-widget-body label { color: #cbd5e0 !important; }
          #ollama-inpage-widget .ollama-error { 
            background: #742a2a !important; color: #feb2b2 !important; 
            border-color: #fc8181 !important; 
          }
        }
        
        .ollama-widget-header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; padding: 20px 24px; 
          display: flex; justify-content: space-between; align-items: center;
        }
        
        .ollama-header-content { display: flex; align-items: center; gap: 12px; }
        .ollama-logo { font-size: 24px; }
        .ollama-widget-header h3 { margin: 0; font-size: 20px; font-weight: 600; }
        
        .ollama-close-btn { 
          background: rgba(255,255,255,0.2); border: none; color: white; 
          width: 32px; height: 32px; border-radius: 8px; cursor: pointer; 
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .ollama-close-btn:hover { 
          background: rgba(255,255,255,0.35); 
          transform: scale(1.05); 
        }
        .ollama-close-btn svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3)); }
        
        .ollama-widget-body { padding: 24px; max-height: calc(85vh - 72px); overflow-y: auto; }
        .ollama-widget-body label { 
          display: block; font-weight: 600; margin-bottom: 10px; 
          font-size: 14px; color: #4a5568;
        }
        
        #ollama-prompt-field { 
          width: 100%; min-height: 90px; padding: 12px 16px; 
          border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; 
          resize: vertical; margin-bottom: 16px; font-family: inherit;
          transition: all 0.2s;
        }
        #ollama-prompt-field:focus { 
          outline: none; border-color: #667eea; 
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .ollama-prompts-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 16px; }
        
        .ollama-prompt-btn { 
          padding: 12px 16px; background: white; border: 2px solid #e2e8f0; 
          border-radius: 10px; cursor: pointer; text-align: left; font-size: 14px; 
          transition: all 0.2s; font-weight: 500; color: #2d3748;
          position: relative; overflow: hidden;
        }
        .ollama-prompt-btn::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%);
          opacity: 0; transition: opacity 0.2s;
        }
        .ollama-prompt-btn:hover::before { opacity: 1; }
        .ollama-prompt-btn:hover { border-color: #667eea; transform: translateX(4px); }
        .ollama-prompt-btn.selected { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; border-color: transparent; font-weight: 600;
        }
        
        .ollama-ask-btn { 
          width: 100%; padding: 14px 20px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; border: none; border-radius: 10px; font-weight: 600; 
          cursor: pointer; font-size: 15px; display: flex; align-items: center; 
          justify-content: center; gap: 8px; transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        .ollama-ask-btn:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }
        .ollama-ask-btn:active { transform: translateY(0); }
        
        .ollama-preview-text { 
          background: #f7fafc; border: 2px solid #e2e8f0; padding: 16px; 
          border-radius: 10px; margin-bottom: 16px; white-space: pre-wrap; 
          max-height: 320px; overflow-y: auto; font-size: 14px; line-height: 1.7; 
          color: #2d3748;
        }
        
        .ollama-actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        
        .ollama-btn { 
          padding: 12px 16px; border: none; border-radius: 10px; font-weight: 600; 
          cursor: pointer; font-size: 14px; display: flex; align-items: center; 
          justify-content: center; gap: 6px; transition: all 0.2s;
        }
        .ollama-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .ollama-btn:active { transform: translateY(0); }
        
        .ollama-accept { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; }
        .ollama-modify { background: linear-gradient(135deg, #667eea 0%, #5a67d8 100%); color: white; }
        .ollama-discard { background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); color: white; }
        .ollama-retry { 
          width: 100%; margin-top: 12px; 
          background: linear-gradient(135deg, #718096 0%, #4a5568 100%); 
          color: white; 
        }
        
        .ollama-loading { text-align: center; padding: 50px 20px; }
        .ollama-spinner { 
          width: 50px; height: 50px; margin: 0 auto 20px; 
          border: 4px solid #e2e8f0; border-top-color: #667eea; 
          border-radius: 50%; animation: ollama-spin 0.8s linear infinite; 
        }
        @keyframes ollama-spin { to { transform: rotate(360deg); } }
        .ollama-loading p { color: #718096; font-size: 14px; font-weight: 500; }
        
        .ollama-error { 
          background: #fff5f5; border: 2px solid #fc8181; padding: 20px; 
          border-radius: 10px; color: #c53030; font-size: 14px; line-height: 1.6;
          text-align: center;
        }
        .error-icon { font-size: 32px; margin-bottom: 12px; }
        
        .hidden { display: none !important; }
        
        /* Scrollbar personalizzata */
        #ollama-inpage-widget ::-webkit-scrollbar { width: 8px; }
        #ollama-inpage-widget ::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        #ollama-inpage-widget ::-webkit-scrollbar-thumb { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          border-radius: 10px; 
        }
        #ollama-inpage-widget ::-webkit-scrollbar-thumb:hover { background: #5a67d8; }
      `;
      document.head.appendChild(style);
    }

    // Event listeners
    widget.querySelector(".ollama-close-btn").onclick = () => closeWidget();
    widget.querySelector("#ollama-ask-btn").onclick = () => handleAsk();
    widget.querySelector(".ollama-accept").onclick = () => handleAccept();
    widget.querySelector(".ollama-discard").onclick = () => closeWidget();
    widget.querySelector(".ollama-modify").onclick = () => handleModify();
    widget.querySelector(".ollama-retry").onclick = () => {
      widget.querySelector(".ollama-error").classList.add("hidden");
      widget.querySelector(".ollama-controls").classList.remove("hidden");
    };

    return widget;
  }

  function openInPageWidget(selectedPrompt, isCustom) {
    if (!inPageWidget) {
      inPageWidget = createInPageWidget();
    }

    // Popola prompt
    const promptsContainer = inPageWidget.querySelector("#ollama-prompts");
    promptsContainer.innerHTML = "";
    defaultPrompts.forEach((prompt) => {
      const btn = document.createElement("button");
      btn.className = "ollama-prompt-btn";
      btn.textContent = prompt;
      if (prompt === selectedPrompt) btn.classList.add("selected");
      btn.onclick = () => {
        inPageWidget
          .querySelectorAll(".ollama-prompt-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        inPageWidget.querySelector("#ollama-prompt-field").value = "";
      };
      promptsContainer.appendChild(btn);
    });

    // Reset UI
    inPageWidget.querySelector(".ollama-controls").classList.remove("hidden");
    inPageWidget.querySelector(".ollama-loading").classList.add("hidden");
    inPageWidget.querySelector(".ollama-preview").classList.add("hidden");
    inPageWidget.querySelector(".ollama-error").classList.add("hidden");
    inPageWidget.querySelector("#ollama-prompt-field").value = "";
    inPageWidget.querySelector("#ollama-prompt-field").placeholder =
      "Inserisci il tuo prompt personalizzato...";

    if (isCustom) {
      setTimeout(
        () => inPageWidget.querySelector("#ollama-prompt-field").focus(),
        100
      );
    }

    inPageWidget.style.display = "block";

    // Auto-esegui se prompt selezionato
    if (selectedPrompt && !isCustom) {
      setTimeout(() => handleAsk(), 300);
    }
  }

  function closeWidget() {
    if (inPageWidget) inPageWidget.style.display = "none";
    conversationHistory = [];
  }

  async function handleAsk() {
    const promptField = inPageWidget.querySelector("#ollama-prompt-field");
    const selectedBtn = inPageWidget.querySelector(
      ".ollama-prompt-btn.selected"
    );
    const prompt =
      promptField.value.trim() || (selectedBtn ? selectedBtn.textContent : "");

    if (!prompt) {
      showError("Seleziona un prompt predefinito o scrivi il tuo!");
      return;
    }

    showLoading();

    // Rileva se è HTML
    const isHTML =
      lastSelectedText.includes("<") && lastSelectedText.includes(">");

    let systemPrompt;
    let userMessage;

    if (isHTML) {
      systemPrompt = `You are an HTML content editor. You MUST preserve ALL HTML tags and structure.
Your task: modify ONLY the text content inside the tags, keep ALL tags exactly as they are.

Rules:
- Keep ALL HTML tags: <p>, <h1>, <h2>, <h3>, <br>, <strong>, <em>, <a>, <ul>, <li>, etc.
- Do NOT translate or modify tag names
- Do NOT remove or add tags
- Modify ONLY the text between tags
- Return valid HTML without wrapping it in code blocks or quotes

Example:
Input: <h2>Hello World</h2><p>This is <strong>bold</strong> text</p>
Task: Translate to Spanish
Output: <h2>Hola Mundo</h2><p>Este es texto en <strong>negrita</strong></p>`;

      userMessage = `HTML Content:
${lastSelectedText}

Task: ${prompt}

Return ONLY the modified HTML with preserved structure:`;
    } else {
      systemPrompt = `Rispondi ESCLUSIVAMENTE con il testo richiesto, senza aggiungere virgolette, apici, quote o altri caratteri di formattazione attorno al testo. Mantieni ESATTAMENTE la stessa formattazione, struttura, a capo, spaziatura e stile del testo originale. Non aggiungere emoji, simboli strani o caratteri decorativi. Preserva tutti gli "a capo" (\\n), spazi, indentazioni e punteggiatura originali. Non racchiudere mai la risposta tra virgolette.`;

      userMessage = `Testo originale:\n${lastSelectedText}\n\nRichiesta: ${prompt}\n\nRitorna SOLO il testo modificato mantenendo la formattazione identica all'originale, SENZA virgolette attorno.`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    try {
      const response = await browser.runtime.sendMessage({
        type: "OLLAMA_REQUEST",
        url: `${ollamaUrl}/api/chat`,
        body: { model: defaultModel, stream: false, messages },
      });

      if (!response.success) throw new Error(response.error);

      let aiResponse = response.data.message.content;

      // Rimuovi markdown code blocks e virgolette
      aiResponse = aiResponse
        .replace(/^```html\n?/g, "")
        .replace(/^``````$/g, "")
        .trim();
      aiResponse = aiResponse.replace(/^["']|["']$/g, "").trim();

      // Se la risposta non contiene HTML ma dovrebbe, mostra errore
      if (isHTML && (!aiResponse.includes("<") || !aiResponse.includes(">"))) {
        console.warn(
          "L'AI ha restituito testo senza HTML, ma era richiesto HTML"
        );
        showError(
          'L\'AI ha rimosso i tag HTML. Riprova o usa un prompt diverso.\n\nSuggerimento: specifica "mantieni la formattazione HTML" nel prompt.'
        );
        return;
      }

      conversationHistory.push({ role: "user", content: userMessage });
      conversationHistory.push({ role: "assistant", content: aiResponse });

      showPreview(aiResponse);
    } catch (error) {
      showError(
        `Errore: ${error.message}\n\nVerifica che Ollama sia attivo su ${ollamaUrl}`
      );
    }
  }

  function showLoading() {
    inPageWidget.querySelector(".ollama-controls").classList.add("hidden");
    inPageWidget.querySelector(".ollama-preview").classList.add("hidden");
    inPageWidget.querySelector(".ollama-error").classList.add("hidden");
    inPageWidget.querySelector(".ollama-loading").classList.remove("hidden");
  }

  function showPreview(text) {
    inPageWidget.querySelector(".ollama-loading").classList.add("hidden");
    inPageWidget.querySelector(".ollama-controls").classList.add("hidden");
    inPageWidget.querySelector(".ollama-error").classList.add("hidden");

    const previewElement = inPageWidget.querySelector("#ollama-preview-text");

    // FIX: Se il testo contiene HTML, mostralo come HTML
    if (text.includes("<") && text.includes(">")) {
      previewElement.innerHTML = text;
    } else {
      previewElement.textContent = text;
    }

    inPageWidget.querySelector(".ollama-preview").classList.remove("hidden");
  }

  function showError(msg) {
    inPageWidget.querySelector(".ollama-loading").classList.add("hidden");
    inPageWidget.querySelector(".ollama-preview").classList.add("hidden");
    inPageWidget.querySelector(".ollama-controls").classList.add("hidden");
    inPageWidget.querySelector("#ollama-error-text").textContent = msg;
    inPageWidget.querySelector(".ollama-error").classList.remove("hidden");
  }

  function handleAccept() {
    const previewElement = inPageWidget.querySelector("#ollama-preview-text");

    // FIX: Prendi innerHTML se contiene HTML, altrimenti textContent
    let text;
    if (
      previewElement.innerHTML.includes("<") &&
      previewElement.innerHTML.includes(">")
    ) {
      text = previewElement.innerHTML;
    } else {
      text = previewElement.textContent;
    }

    console.log("Accettazione testo (con HTML se presente)");
    replaceTextInElement(text);
    closeWidget();
  }

  function handleModify() {
    inPageWidget.querySelector(".ollama-preview").classList.add("hidden");
    inPageWidget.querySelector(".ollama-controls").classList.remove("hidden");
    inPageWidget.querySelector("#ollama-prompt-field").value = "";
    inPageWidget.querySelector("#ollama-prompt-field").placeholder =
      "Descrivi la modifica desiderata...";
    inPageWidget
      .querySelectorAll(".ollama-prompt-btn")
      .forEach((b) => b.classList.remove("selected"));
  }

  function replaceTextInElement(newText) {
  if (!lastActiveElement) {
    console.error('Nessun elemento attivo salvato');
    showError('Errore: impossibile sostituire il testo. Elemento non trovato.');
    return;
  }
  
  console.log('Inizio sostituzione testo');
  console.log('Elemento:', lastActiveElement.tagName);
  console.log('Testo contiene HTML:', newText.includes('<'));
  
  // Determina il documento (principale o iframe)
  let doc = document;
  if (lastActiveElement.ownerDocument) {
    doc = lastActiveElement.ownerDocument;
  }
  
  try {
    // TEXTAREA o INPUT
    if (lastActiveElement.tagName === 'TEXTAREA' || lastActiveElement.tagName === 'INPUT') {
      console.log('Sostituzione in TEXTAREA/INPUT');
      
      const fullValue = lastActiveElement.value;
      const before = fullValue.substring(0, lastSelectionStart);
      const after = fullValue.substring(lastSelectionEnd);
      
      lastActiveElement.value = before + newText + after;
      
      const newPosition = lastSelectionStart + newText.length;
      lastActiveElement.setSelectionRange(newPosition, newPosition);
      
      lastActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
      lastActiveElement.dispatchEvent(new Event('change', { bubbles: true }));
      lastActiveElement.focus();
      
      console.log('Sostituzione completata in textarea/input');
      return;
    }
    
    // CONTENTEDITABLE o BODY (CKEditor)
    if (lastActiveElement.isContentEditable || lastActiveElement.contentEditable === 'true' || lastActiveElement.tagName === 'BODY') {
      console.log('Sostituzione in CONTENTEDITABLE/CKEditor BODY');
      
      lastActiveElement.focus();
      
      // USA SEMPRE il range salvato
      if (savedRange) {
        console.log('Uso range salvato per sostituzione precisa');
        const selection = doc.getSelection ? doc.getSelection() : window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
        
        // Elimina contenuto selezionato
        savedRange.deleteContents();
        
        // FIX: Se il testo contiene HTML, inserisci come HTML
        if (newText.includes('<') && newText.includes('>')) {
          console.log('Inserimento HTML nel range');
          
          // Crea elemento temporaneo per parsare HTML
          const tempDiv = doc.createElement('div');
          tempDiv.innerHTML = newText;
          
          // Inserisci tutti i nodi uno per uno nell'ordine corretto
          const nodes = Array.from(tempDiv.childNodes);
          let lastNode = null;
          
          nodes.forEach((node, index) => {
            const clonedNode = node.cloneNode(true);
            savedRange.insertNode(clonedNode);
            lastNode = clonedNode;
            
            // Sposta il range dopo il nodo appena inserito
            if (index < nodes.length - 1) {
              savedRange.setStartAfter(clonedNode);
              savedRange.collapse(true);
            }
          });
          
          // Posiziona cursore alla fine
          if (lastNode) {
            savedRange.setStartAfter(lastNode);
            savedRange.collapse(true);
          }
        } else {
          // Testo semplice
          console.log('Inserimento testo semplice nel range');
          const lines = newText.split('\n');
          lines.forEach((line, index) => {
            const textNode = doc.createTextNode(line);
            savedRange.insertNode(textNode);
            
            if (index < lines.length - 1) {
              const br = doc.createElement('br');
              savedRange.insertNode(br);
              savedRange.setStartAfter(br);
            } else {
              savedRange.setStartAfter(textNode);
            }
          });
          
          savedRange.collapse(false);
        }
        
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } else {
        // Se non c'è range salvato, crea selezione per tutto il contenuto
        console.warn('Nessun range salvato! Creo selezione per tutto il contenuto editabile');
        
        const range = doc.createRange();
        range.selectNodeContents(lastActiveElement);
        
        const selection = doc.getSelection ? doc.getSelection() : window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        range.deleteContents();
        
        // Inserisci nuovo contenuto
        if (newText.includes('<') && newText.includes('>')) {
          const tempDiv = doc.createElement('div');
          tempDiv.innerHTML = newText;
          
          const nodes = Array.from(tempDiv.childNodes);
          
          nodes.forEach((node, index) => {
            const clonedNode = node.cloneNode(true);
            range.insertNode(clonedNode);
            
            if (index < nodes.length - 1) {
              range.setStartAfter(clonedNode);
              range.collapse(true);
            }
          });
        } else {
          const textNode = doc.createTextNode(newText);
          range.insertNode(textNode);
        }
        
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      
      lastActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
      lastActiveElement.dispatchEvent(new Event('change', { bubbles: true }));
      lastActiveElement.focus();
      
      console.log('Sostituzione completata in contenteditable/CKEditor');
      return;
    }
    
    console.warn('Elemento non gestito:', lastActiveElement.tagName);
    showError('Errore: tipo di elemento non supportato per la sostituzione.');
    
  } catch (error) {
    console.error('Errore sostituzione testo:', error);
    showError('Errore durante la sostituzione del testo: ' + error.message);
  }
}


  // Selezione testo - MODIFICATO per CKEditor
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      // FIX: Ottieni elemento editabile reale
      const activeInfo = getActiveEditableElement();
      const activeElement = activeInfo.element;
      const doc = activeInfo.iframeDoc;

      const selection = doc.getSelection
        ? doc.getSelection()
        : window.getSelection();
      const selectedText = selection.toString().trim();

      // Se non c'è selezione, prendi tutto il testo dall'elemento attivo
      if (!selectedText || selectedText.length === 0) {
        const fullText = getTextFromElement(activeElement);

        if (fullText && fullText.length > 0) {
          lastSelectedText = fullText;
          lastActiveElement = activeElement;

          if (
            activeElement.tagName === "TEXTAREA" ||
            activeElement.tagName === "INPUT"
          ) {
            lastSelectionStart = 0;
            lastSelectionEnd = fullText.length;
          } else if (
            activeElement.isContentEditable ||
            activeElement.tagName === "BODY"
          ) {
            lastSelectionStart = 0;
            lastSelectionEnd = fullText.length;
            // Crea range per tutto il contenuto
            const range = doc.createRange();
            range.selectNodeContents(activeElement);
            savedRange = range.cloneRange();
          }

          console.log(
            "Nessuna selezione: preso tutto il testo dall'elemento attivo"
          );
        }
        return;
      }

      // C'è selezione
      lastActiveElement = activeElement;

      console.log("Testo selezionato:", selectedText.substring(0, 30));
      console.log("Elemento:", activeElement.tagName);

      // Salva posizione selezione
      if (
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "INPUT"
      ) {
        lastSelectionStart = activeElement.selectionStart;
        lastSelectionEnd = activeElement.selectionEnd;
        lastSelectedText = selectedText;
      } else if (
        activeElement.isContentEditable ||
        activeElement.tagName === "BODY"
      ) {
        if (selection.rangeCount > 0) {
          savedRange = selection.getRangeAt(0).cloneRange();
          console.log("Range salvato per contenteditable/CKEditor");

          // FIX: Ottieni HTML pulito dal range salvato subito
          try {
            const container = savedRange.cloneContents();
            const tempDiv = doc.createElement("div");
            tempDiv.appendChild(container);
            lastSelectedText = getCleanHTML(tempDiv);
            console.log(
              "HTML pulito estratto dal range:",
              lastSelectedText.substring(0, 100)
            );
          } catch (e) {
            console.error("Errore estrazione HTML:", e);
            lastSelectedText = selectedText;
          }
        } else {
          lastSelectedText = selectedText;
        }

        lastSelectionStart = 0;
        lastSelectionEnd = lastSelectedText.length;
      }

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (!floatingSelectionWidget) {
          floatingSelectionWidget = createFloatingWidget();
        }

        // Calcola posizione considerando iframe
        let offsetX = 0;
        let offsetY = 0;

        if (activeInfo.inIframe && activeInfo.iframe) {
          const iframeRect = activeInfo.iframe.getBoundingClientRect();
          offsetX = iframeRect.left;
          offsetY = iframeRect.top;
        }

        floatingSelectionWidget.style.left =
          rect.left + offsetX + rect.width / 2 + window.scrollX - 20 + "px";
        floatingSelectionWidget.style.top =
          rect.top + offsetY + window.scrollY - 50 + "px";
        floatingSelectionWidget.style.display = "block";

        setTimeout(() => {
          if (floatingSelectionWidget)
            floatingSelectionWidget.style.display = "none";
        }, 5000);
      }
    }, 10);
  });

  // Messaggi da background - MODIFICATO per CKEditor
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_WIDGET') {
  // FIX: Ottieni elemento editabile reale
  const activeInfo = getActiveEditableElement();
  const activeElement = activeInfo.element;
  const doc = activeInfo.iframeDoc;
  
  const selection = doc.getSelection ? doc.getSelection() : window.getSelection();
  const selectedText = selection.toString().trim();
  
  lastActiveElement = activeElement;
  
  console.log('Widget aperto da menu contestuale');
  console.log('Elemento attivo:', activeElement.tagName);
  console.log('In iframe:', activeInfo.inIframe);
  
  // FIX CRITICO: Salva il range SUBITO se c'è selezione
  if (selectedText && selectedText.length > 0) {
    // C'è testo selezionato
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      lastSelectionStart = activeElement.selectionStart || 0;
      lastSelectionEnd = activeElement.selectionEnd || selectedText.length;
      lastSelectedText = selectedText;
    } else if (activeElement.isContentEditable || activeElement.tagName === 'BODY') {
      // SALVA IL RANGE SUBITO
      if (selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
        console.log('Range salvato dal menu contestuale');
        
        // Estrai HTML pulito dal range
        try {
          const container = savedRange.cloneContents();
          const tempDiv = doc.createElement('div');
          tempDiv.appendChild(container);
          lastSelectedText = getCleanHTML(tempDiv);
          console.log('HTML pulito estratto:', lastSelectedText.substring(0, 100));
        } catch (e) {
          console.error('Errore estrazione HTML:', e);
          lastSelectedText = selectedText;
        }
      } else {
        lastSelectedText = selectedText;
      }
      
      lastSelectionStart = 0;
      lastSelectionEnd = lastSelectedText.length;
    }
  } else {
    // Nessuna selezione, prendi tutto
    lastSelectedText = getTextFromElement(activeElement);
    
    if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      lastSelectionStart = 0;
      lastSelectionEnd = lastSelectedText.length;
    } else if (activeElement.isContentEditable || activeElement.tagName === 'BODY') {
      // Crea range per tutto il contenuto
      const range = doc.createRange();
      range.selectNodeContents(activeElement);
      savedRange = range.cloneRange();
      console.log('Range creato per tutto il contenuto');
      lastSelectionStart = 0;
      lastSelectionEnd = lastSelectedText.length;
    }
  }


      console.log("Testo catturato:", lastSelectedText.substring(0, 50));

      // FIX: Validazione testo
      if (!lastSelectedText || lastSelectedText.trim().length === 0) {
        // Mostra messaggio errore
        if (!inPageWidget) {
          inPageWidget = createInPageWidget();
        }
        inPageWidget.style.display = "block";
        showError(
          "⚠️ Nessun testo rilevato!\n\nSeleziona del testo o posizionati in un campo editabile prima di usare Ollama Assistant."
        );
        sendResponse({ status: "error", message: "No text detected" });
        return true;
      }


      openInPageWidget(message.selectedPrompt, message.isCustom);
      sendResponse({ status: "ok" });
      return true;
    }

    if (message.type === "GET_CONTEXT_TEXT") {
      // FIX: Ottieni elemento editabile reale
      const activeInfo = getActiveEditableElement();
      const activeElement = activeInfo.element;
      const doc = activeInfo.iframeDoc;

      const selection = doc.getSelection
        ? doc.getSelection()
        : window.getSelection();
      let text = selection.toString().trim();

      // Se non c'è selezione, prendi tutto
      if (!text) {
        text = getTextFromElement(activeElement);
      }

      sendResponse({ text, elementType: "text" });
      return true;
    }
  });
})();
