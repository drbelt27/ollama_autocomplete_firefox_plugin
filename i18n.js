(function () {
  const DEFAULT_LANGUAGE = "en";

  const AI_BASE = {
    htmlSystem:
      "You are an HTML editor. Preserve every HTML tag and structure exactly as received. Always respond in the same language as the provided HTML unless the user explicitly asks to translate to another language.",
    htmlUserTemplate:
      "HTML content:\n${text}\n\nInstruction: ${prompt}\nTone: ${tone}.\nReturn only the modified HTML, keep the same language unless a translation is explicitly requested, and never wrap the result in code fences.",
    plainSystem:
      "You transform user text. Always keep the same language as the input unless the user explicitly asks for a translation. Never add quotes, emojis, or decorative characters around the answer.",
    plainUserTemplate:
      "Original text:\n${text}\n\nRequest: ${prompt}\nTone: ${tone}.\nKeep the same language unless translation is explicitly requested, and return only the improved text while preserving formatting.",
  };

  const POPUP_SYSTEM_PROMPT =
    "Reply only with the requested text. Keep the same language used in the provided content unless the user explicitly requests a translation. Do not add emojis or decorative characters.";
  const POPUP_REQUEST_TEMPLATE =
    'I am working on this text: "${text}". ${prompt}. Use a ${tone} tone. ${lengthInstruction} Reply only with the improved text, without emojis or strange characters, and keep the same language unless I explicitly asked for a translation.';

  function clone(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => clone(item));
    }
    const copy = {};
    Object.keys(obj).forEach((key) => {
      copy[key] = clone(obj[key]);
    });
    return copy;
  }

  function mergeNested(base, overrides) {
    const src = overrides || {};
    const target = Array.isArray(base) ? base.slice() : clone(base);
    Object.keys(src).forEach((key) => {
      const value = src[key];
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof target[key] === "object" &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        target[key] = mergeNested(target[key], value);
      } else if (Array.isArray(value)) {
        target[key] = value.slice();
      } else {
        target[key] = value;
      }
    });
    return target;
  }

  function normalizeCode(code) {
    if (!code) return DEFAULT_LANGUAGE;
    const normalized = String(code).toLowerCase().split("-")[0];
    return LANGUAGE_PACKS[normalized] ? normalized : DEFAULT_LANGUAGE;
  }

  function detectSystemLanguage() {
    const nav =
      (typeof navigator !== "undefined" && navigator) ||
      (typeof self !== "undefined" && self.navigator);
    if (!nav) return DEFAULT_LANGUAGE;
    const raw = nav.language || (Array.isArray(nav.languages) && nav.languages[0]);
    return normalizeCode(raw || DEFAULT_LANGUAGE);
  }

  function resolveLanguage(preference) {
    if (!preference || preference === "system") {
      return detectSystemLanguage();
    }
    return normalizeCode(preference);
  }

  const POPUP_DEFAULTS = {
    systemPrompt: POPUP_SYSTEM_PROMPT,
    requestTemplate: POPUP_REQUEST_TEMPLATE,
    title: "Ollama Assistant",
    connectionErrorTitle: "Ollama is not reachable",
    connectionErrorHelp: "Configure the server URL in the settings or try again.",
    loading: "Processing...",
    previewTitle: "Preview",
    labels: {
      model: "Model",
      tone: "Tone",
      length: "Response length",
      prompts: "Quick prompts",
      customPrompt: "Custom prompt",
      modify: "Describe the change",
    },
    placeholders: {
      customPrompt: "Write your instruction...",
      modify: "Ex: make it more formal, add examples...",
    },
    lengthOptions: {
      breve: "Short",
      media: "Medium",
      lunga: "Long",
      dettagliata: "Very detailed",
    },
    lengthInstructions: {
      breve: "Answer concisely.",
      media: "Provide a balanced answer.",
      lunga: "Provide a detailed answer.",
      dettagliata: "Provide a very detailed answer.",
    },
    buttons: {
      retry: "Retry",
      settings: "Settings",
      ask: "Ask",
      accept: "Accept",
      discard: "Discard",
      modify: "Request change",
      submitModify: "Send change",
      errorRetry: "Retry",
    },
    errors: {
      missingPrompt: "Select a model and a prompt!",
      missingText: "No text detected. Select some content on the page.",
      modifyEmpty: "Describe the change you need.",
      htmlMissing:
        "The AI returned text without HTML although HTML was required. Ask it to keep the formatting.",
      connectionFailed:
        "Connection failed. Ensure Ollama is running and reachable.",
      ollama: (url, model, error) =>
        `Ollama request failed:\n${error}\n\nCheck that:\n- The server is reachable at ${url}\n- The model "${model}" is available\n\nIf the issue persists, run ollama serve with OLLAMA_ORIGINS="*".`,
    },
  };

  const WIDGET_DEFAULTS = {
    title: "Ollama Assistant",
    closeLabel: "Close",
    toneLabel: "Tone",
    promptLabel: "Prompt",
    promptButton: "Prompt",
    promptPlaceholder: "Write your instruction...",
    customPromptPlaceholder: "Describe your instruction...",
    askButton: "Run",
    resultLabel: "Result",
    accept: "Accept",
    modify: "Modify",
    discard: "Discard",
    retry: "Try again",
    loading: "Processing with Ollama...",
    noTextError:
      "No text detected! Select content inside an editable field before using Ollama Assistant.",
    selectTextAlert:
      "Select text inside an editable field before launching the assistant.",
    selectPromptError:
      "Select a predefined prompt or write your own instruction.",
    insertError:
      "Unable to insert the generated text because no editable element was found.",
    unsupportedElement:
      "This element type does not support automatic replacement.",
    htmlMissing:
      "The AI returned plain text even though HTML was requested. Ask it to preserve formatting and try again.",
    modifyPlaceholder: "Describe the change you need...",
    emptyResponse: "The model returned an empty response. Try again.",
  };

  const SETTINGS_DEFAULTS = {
    languageSystemOption: "System (Automatic)",
    title: "Ollama Assistant Settings",
    headings: {
      server: "Server Configuration",
      assistant: "Assistant Preferences",
      prompts: "Quick Prompts",
    },
    labels: {
      ollamaUrl: "Ollama server URL",
      model: "Default model",
      language: "Interface language",
      tone: "Default tone",
      showFloating: "Show floating widget when text is selected",
      debugMode: "Enable debug mode",
      promptsList: "Prompt list",
      newPrompt: "New prompt",
    },
    help: {
      ollamaUrl: "Enter the full Ollama URL (e.g. http://localhost:11434).",
      model:
        "Pick the base model. You can still change it from the popup later.",
      language: "Choose the language for labels, prompts, and widget text.",
      tone: "Tone that is preselected when opening the assistant.",
      showFloating:
        "Disable this if you prefer the toolbar or context menu instead of the floating button.",
      debugMode:
        "Logs detailed Ollama responses in the console to troubleshoot connection issues.",
    },
    buttons: {
      testConnection: "Test Connection & Models",
      addPrompt: "Add",
      save: "Save Settings",
      reset: "Restore Defaults",
    },
    placeholders: {
      ollamaUrl: "http://localhost:11434",
      newPrompt: "New prompt...",
    },
    prompts: {
      empty: "No prompts defined. Add one below.",
      remove: "Remove",
    },
    alerts: {
      promptExists: "Prompt already present.",
      resetConfirm: "Restore default settings?",
    },
    status: {
      saved: "Settings saved.",
      urlEmpty: "The Ollama URL cannot be empty.",
      connectionSuccess: "Models loaded successfully.",
      connectionError: "Connection error:",
      connectionFailed: "Unable to fetch models.",
      defaultsRestored: "Defaults restored. Save to confirm.",
      languageChanged: "Language updated. Save to apply the new prompts.",
    },
  };

  function basePack(code, data) {
    return {
      code,
      label: data.label || code.toUpperCase(),
      ai: clone(AI_BASE),
      contextMenu: data.contextMenu ? clone(data.contextMenu) : null,
      tones: data.tones ? data.tones.slice() : [],
      toneMentions: clone(data.toneMentions || {}),
      prompts: data.prompts ? data.prompts.slice() : [],
      popup: mergeNested(POPUP_DEFAULTS, data.popup || {}),
      widget: mergeNested(WIDGET_DEFAULTS, data.widget || {}),
      settings: Object.assign({}, SETTINGS_DEFAULTS, data.settings || {}),
    };
  }

  const LANGUAGE_PACKS = {
    en: basePack("en", {
      label: "English",
      prompts: [
        "Fix grammar mistakes",
        "Make the text clearer",
        "Summarize the main ideas",
        "Expand the text with more details",
        "Translate to English",
      ],
      contextMenu: {
        title: "Ollama Assistant",
        customPrompt: "Custom prompt...",
        notification:
          "Reload this page (F5) to enable the assistant on this tab.",
      },
      tones: [
        { value: "formale", label: "Formal" },
        { value: "professionale", label: "Professional" },
        { value: "amichevole", label: "Friendly" },
        { value: "casual", label: "Casual" },
      ],
      toneMentions: {
        formale: "formal",
        professionale: "professional",
        amichevole: "friendly",
        casual: "casual",
      },
    }),
    it: basePack("it", {
      label: "Italiano",
      prompts: [
        "Correggi gli errori grammaticali",
        "Rendi il testo più chiaro",
        "Riassumi mantenendo i concetti chiave",
        "Espandi il testo con maggiori dettagli",
        "Traduci in inglese",
      ],
      contextMenu: {
        title: "Ollama Assistant",
        customPrompt: "Prompt personalizzato...",
        notification:
          "Ricarica la pagina (F5) per usare l'assistente su questa scheda.",
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
      widget: {
        title: "Assistente Ollama",
        closeLabel: "Chiudi",
        toneLabel: "Tono",
        promptLabel: "Prompt",
        promptPlaceholder: "Scrivi il tuo prompt...",
        customPromptPlaceholder: "Descrivi la tua istruzione...",
        askButton: "Elabora",
        selectPromptError:
          "Seleziona un prompt predefinito o scrivi tu un'istruzione.",
        insertError:
          "Impossibile inserire il testo generato perché non è stato trovato alcun campo editabile.",
        htmlMissing:
          "Il modello ha restituito testo senza HTML anche se era richiesto. Chiedi di mantenere la formattazione.",
        modifyPlaceholder: "Es. rendi il testo più formale...",
        noTextError:
          "Nessun testo rilevato. Seleziona del contenuto in un campo editabile.",
        selectTextAlert:
          "Seleziona del testo in un campo editabile prima di aprire l'assistente.",
        emptyResponse: "Il modello ha restituito una risposta vuota. Riprova.",
      },
      popup: {
        title: "Assistente AI Ollama",
        connectionErrorTitle: "Connessione a Ollama non disponibile",
        connectionErrorHelp:
          "Configura l'URL del server nelle impostazioni o riprova la connessione.",
        loading: "Elaborazione in corso...",
        previewTitle: "Anteprima",
        labels: {
          model: "Modello",
          tone: "Tono",
          length: "Lunghezza risposta",
          prompts: "Prompt predefiniti",
          customPrompt: "Prompt personalizzato",
          modify: "Descrivi la modifica",
        },
        placeholders: {
          customPrompt: "Scrivi il tuo prompt...",
          modify: "Es. rendi il testo più formale, aggiungi esempi...",
        },
        lengthOptions: {
          breve: "Breve",
          media: "Media",
          lunga: "Lunga",
          dettagliata: "Molto dettagliata",
        },
        lengthInstructions: {
          breve: "Rispondi in modo conciso.",
          media: "Fornisci una risposta equilibrata.",
          lunga: "Fornisci una risposta dettagliata.",
          dettagliata: "Fornisci una risposta molto completa.",
        },
        buttons: {
          retry: "Riprova",
          settings: "Impostazioni",
          ask: "Chiedi",
          accept: "Accetta",
          discard: "Scarta",
          modify: "Richiedi modifica",
          submitModify: "Invia modifica",
          errorRetry: "Riprova",
        },
        errors: {
          missingPrompt: "Seleziona un modello e un prompt!",
          missingText:
            "Nessun testo da elaborare. Seleziona del testo nella pagina.",
          modifyEmpty: "Descrivi la modifica desiderata.",
          htmlMissing:
            "L'AI ha restituito testo senza HTML anche se era richiesto. Specifica di mantenere la formattazione.",
          connectionFailed:
            "Connessione fallita. Verifica che Ollama sia in esecuzione.",
          ollama: (url, model, error) =>
            `Errore di comunicazione con Ollama:\n${error}\n\nVerifica che:\n- Il server sia raggiungibile su ${url}\n- Il modello "${model}" sia disponibile\n\nSe l'errore persiste, avvia ollama serve con OLLAMA_ORIGINS="*".`,
        },
      },
      settings: {
        languageSystemOption: "Sistema (Automatico)",
        title: "Impostazioni Ollama Assistant",
        headings: {
          server: "Configurazione server",
          assistant: "Preferenze assistente",
          prompts: "Prompt predefiniti",
        },
        labels: {
          ollamaUrl: "URL server Ollama",
          model: "Modello predefinito",
          language: "Lingua interfaccia",
          tone: "Tono predefinito",
          showFloating: "Mostra il widget floating quando selezioni il testo",
          debugMode: "Abilita modalità debug",
          promptsList: "Elenco prompt",
          newPrompt: "Nuovo prompt",
        },
        help: {
          ollamaUrl:
            "Inserisci l'URL completo di Ollama (es. http://localhost:11434).",
          model:
            "Seleziona il modello di base. Potrai cambiarlo anche dal popup.",
          language:
            "Scegli la lingua per etichette, prompt rapidi e testo del widget.",
          tone: "Tono predefinito quando apri l'assistente.",
          showFloating:
            "Disattiva se preferisci usare solo toolbar o menu contestuale.",
          debugMode:
            "Mostra nel log risposte dettagliate di Ollama per diagnosticare problemi di connessione.",
        },
        buttons: {
          testConnection: "Testa connessione e modelli",
          addPrompt: "Aggiungi",
          save: "Salva impostazioni",
          reset: "Ripristina default",
        },
        placeholders: {
          ollamaUrl: "http://localhost:11434",
          newPrompt: "Nuovo prompt...",
        },
        prompts: {
          empty: "Nessun prompt definito. Aggiungine uno qui sotto.",
          remove: "Rimuovi",
        },
        alerts: {
          promptExists: "Prompt già presente.",
          resetConfirm: "Vuoi ripristinare le impostazioni predefinite?",
        },
        status: {
          saved: "Impostazioni salvate.",
          urlEmpty: "L'URL di Ollama non può essere vuoto.",
          connectionSuccess: "Modelli caricati con successo.",
          connectionError: "Errore di connessione:",
          connectionFailed: "Impossibile recuperare i modelli.",
          defaultsRestored: "Default ripristinati. Salva per confermare.",
          languageChanged:
            "Lingua aggiornata. Salva per applicare i nuovi prompt.",
        },
      },
    }),
    de: basePack("de", {
      label: "Deutsch",
      prompts: [
        "Korrigiere Grammatikfehler",
        "Formuliere den Text klarer",
        "Fasse die Kernaussagen zusammen",
        "Erweitere den Text mit mehr Details",
        "Übersetze ins Englische",
      ],
      contextMenu: {
        title: "Ollama Assistant",
        customPrompt: "Eigener Prompt...",
        notification:
          "Lade diese Seite (F5) neu, um den Assistenten auf diesem Tab zu aktivieren.",
      },
      tones: [
        { value: "formale", label: "Formell" },
        { value: "professionale", label: "Professionell" },
        { value: "amichevole", label: "Freundlich" },
        { value: "casual", label: "Locker" },
      ],
      toneMentions: {
        formale: "formal",
        professionale: "professional",
        amichevole: "friendly",
        casual: "casual",
      },
      widget: {
        title: "Ollama Assistent",
        closeLabel: "Schließen",
        toneLabel: "Ton",
        promptLabel: "Prompt",
        promptPlaceholder: "Schreibe deine Anweisung...",
        customPromptPlaceholder: "Beschreibe deine Anweisung...",
        askButton: "Ausführen",
        selectPromptError:
          "Wähle einen Schnell-Prompt oder schreibe deine eigene Anweisung.",
        insertError:
          "Kein Editor gefunden, daher konnte der Text nicht eingefügt werden.",
        htmlMissing:
          "Das Modell lieferte Text ohne HTML, obwohl HTML gefordert war. Bitte fordere explizit das Beibehalten der Formatierung.",
        modifyPlaceholder: "Beschreibe die gewünschte Änderung...",
        noTextError:
          "Kein Text gefunden. Markiere Text in einem bearbeitbaren Feld.",
        selectTextAlert:
          "Wähle Text in einem bearbeitbaren Feld aus, bevor du den Assistenten startest.",
        emptyResponse:
          "Das Modell hat keine Antwort geliefert. Bitte versuche es erneut.",
      },
      popup: {
        title: "Ollama KI-Assistent",
        connectionErrorTitle: "Ollama ist nicht erreichbar",
        connectionErrorHelp:
          "Konfiguriere die Server-URL in den Einstellungen oder versuche es erneut.",
        loading: "Verarbeitung läuft...",
        previewTitle: "Vorschau",
        labels: {
          model: "Modell",
          tone: "Ton",
          length: "Antwortlänge",
          prompts: "Schnell-Prompts",
          customPrompt: "Eigener Prompt",
          modify: "Änderung beschreiben",
        },
        placeholders: {
          customPrompt: "Schreibe deine Anweisung...",
          modify: "Z. B. formeller formulieren, Beispiele ergänzen...",
        },
        lengthOptions: {
          breve: "Kurz",
          media: "Mittel",
          lunga: "Lang",
          dettagliata: "Sehr detailliert",
        },
        lengthInstructions: {
          breve: "Antworte kurz und prägnant.",
          media: "Gib eine ausgewogene Antwort.",
          lunga: "Antworte ausführlich.",
          dettagliata: "Antworte sehr ausführlich und umfassend.",
        },
        buttons: {
          retry: "Erneut versuchen",
          settings: "Einstellungen",
          ask: "Anfragen",
          accept: "Übernehmen",
          discard: "Verwerfen",
          modify: "Änderung anfordern",
          submitModify: "Änderung senden",
          errorRetry: "Erneut versuchen",
        },
        errors: {
          missingPrompt: "Wähle ein Modell und einen Prompt!",
          missingText:
            "Kein Text zum Verarbeiten. Markiere Text auf der Seite.",
          modifyEmpty: "Beschreibe die gewünschte Änderung.",
          htmlMissing:
            "Die KI lieferte Text ohne HTML, obwohl HTML gefordert war. Fordere explizit das Beibehalten der Formatierung.",
          connectionFailed:
            "Verbindung fehlgeschlagen. Stelle sicher, dass Ollama läuft.",
          ollama: (url, model, error) =>
            `Fehler bei der Ollama-Anfrage:\n${error}\n\nPrüfe bitte:\n- Erreichbarkeit von ${url}\n- Modell "${model}" verfügbar?\n\nFalls das Problem bleibt, starte ollama serve mit OLLAMA_ORIGINS="*".`,
        },
      },
      settings: {
        languageSystemOption: "System (Automatisch)",
        title: "Ollama Assistant Einstellungen",
        headings: {
          server: "Serverkonfiguration",
          assistant: "Assistenten-Einstellungen",
          prompts: "Schnell-Prompts",
        },
        labels: {
          ollamaUrl: "Ollama-Server-URL",
          model: "Standardmodell",
          language: "Oberflächensprache",
          tone: "Standardton",
          showFloating:
            "Floating-Widget anzeigen, wenn Text markiert wird",
          debugMode: "Debugmodus aktivieren",
          promptsList: "Prompt-Liste",
          newPrompt: "Neuer Prompt",
        },
        help: {
          ollamaUrl:
            "Gib die komplette Ollama-URL ein (z. B. http://localhost:11434).",
          model:
            "Wähle das Basismodell. Du kannst es auch im Popup ändern.",
          language:
            "Wähle die Sprache für Labels, Schnellprompts und Widgettexte.",
          tone: "Ton, der standardmäßig im Assistenten ausgewählt ist.",
          showFloating:
            "Deaktiviere dies, wenn du lieber Toolbar oder Kontextmenü nutzt.",
          debugMode:
            "Zeigt detaillierte Ollama-Antworten in der Konsole für die Fehlersuche an.",
        },
        buttons: {
          testConnection: "Verbindung und Modelle testen",
          addPrompt: "Hinzufügen",
          save: "Einstellungen speichern",
          reset: "Standard wiederherstellen",
        },
        placeholders: {
          ollamaUrl: "http://localhost:11434",
          newPrompt: "Neuer Prompt...",
        },
        prompts: {
          empty: "Keine Prompts vorhanden. Füge unten welche hinzu.",
          remove: "Entfernen",
        },
        alerts: {
          promptExists: "Prompt ist bereits vorhanden.",
          resetConfirm: "Standardeinstellungen wiederherstellen?",
        },
        status: {
          saved: "Einstellungen gespeichert.",
          urlEmpty: "Die Ollama-URL darf nicht leer sein.",
          connectionSuccess: "Modelle erfolgreich geladen.",
          connectionError: "Verbindungsfehler:",
          connectionFailed: "Modelle konnten nicht geladen werden.",
          defaultsRestored: "Standards wiederhergestellt. Zum Bestätigen speichern.",
          languageChanged:
            "Sprache aktualisiert. Speichere, um die neuen Prompts anzuwenden.",
        },
      },
    }),
    fr: basePack("fr", {
      label: "Français",
      prompts: [
        "Corrige les fautes de grammaire",
        "Rends le texte plus clair",
        "Résume les idées principales",
        "Développe le texte avec plus de détails",
        "Traduis en anglais",
      ],
      contextMenu: {
        title: "Assistant Ollama",
        customPrompt: "Invite personnalisée...",
        notification:
          "Recharge la page (F5) pour activer l'assistant sur cet onglet.",
      },
      tones: [
        { value: "formale", label: "Formel" },
        { value: "professionale", label: "Professionnel" },
        { value: "amichevole", label: "Amical" },
        { value: "casual", label: "Décontracté" },
      ],
      toneMentions: {
        formale: "formal",
        professionale: "professional",
        amichevole: "friendly",
        casual: "casual",
      },
      widget: {
        title: "Assistant Ollama",
        closeLabel: "Fermer",
        toneLabel: "Ton",
        promptLabel: "Invite",
        promptPlaceholder: "Écris ton instruction...",
        customPromptPlaceholder: "Décris ton instruction...",
        askButton: "Lancer",
        selectPromptError:
          "Choisis une invite rapide ou écris la tienne.",
        insertError:
          "Impossible d'insérer le texte généré car aucun champ éditable n'a été trouvé.",
        htmlMissing:
          "Le modèle a renvoyé du texte sans HTML alors que c'était requis. Demande de conserver la mise en forme.",
        modifyPlaceholder: "Décris la modification souhaitée...",
        noTextError:
          "Aucun texte détecté. Sélectionne du contenu dans un champ éditable.",
        selectTextAlert:
          "Sélectionne du texte dans une zone éditable avant de lancer l'assistant.",
        emptyResponse:
          "Le modèle a renvoyé une réponse vide. Réessaie.",
      },
      popup: {
        title: "Assistant IA Ollama",
        connectionErrorTitle: "Impossible de joindre Ollama",
        connectionErrorHelp:
          "Configure l'URL du serveur dans les paramètres ou réessaie.",
        loading: "Traitement en cours...",
        previewTitle: "Aperçu",
        labels: {
          model: "Modèle",
          tone: "Ton",
          length: "Longueur de la réponse",
          prompts: "Invites rapides",
          customPrompt: "Invite personnalisée",
          modify: "Décris la modification",
        },
        placeholders: {
          customPrompt: "Écris ton instruction...",
          modify: "Ex : rends le texte plus formel, ajoute des exemples...",
        },
        lengthOptions: {
          breve: "Courte",
          media: "Moyenne",
          lunga: "Longue",
          dettagliata: "Très détaillée",
        },
        lengthInstructions: {
          breve: "Réponds de façon concise.",
          media: "Réponds de manière équilibrée.",
          lunga: "Réponds en détail.",
          dettagliata: "Réponds avec de nombreux détails.",
        },
        buttons: {
          retry: "Réessayer",
          settings: "Paramètres",
          ask: "Demander",
          accept: "Accepter",
          discard: "Ignorer",
          modify: "Demander une modification",
          submitModify: "Envoyer la modification",
          errorRetry: "Réessayer",
        },
        errors: {
          missingPrompt: "Sélectionne un modèle et une invite !",
          missingText:
            "Aucun texte à traiter. Sélectionne du texte sur la page.",
          modifyEmpty: "Décris la modification souhaitée.",
          htmlMissing:
            "L'IA a renvoyé du texte sans HTML alors que c'était requis. Demande-lui de conserver la mise en forme.",
          connectionFailed:
            "Connexion impossible. Vérifie qu'Ollama fonctionne.",
          ollama: (url, model, error) =>
            `Erreur lors de l'appel à Ollama :\n${error}\n\nVérifie :\n- L'accès à ${url}\n- La disponibilité du modèle "${model}"\n\nSi le problème persiste, lance ollama serve avec OLLAMA_ORIGINS="*".`,
        },
      },
      settings: {
        languageSystemOption: "Système (Automatique)",
        title: "Paramètres Ollama Assistant",
        headings: {
          server: "Configuration du serveur",
          assistant: "Préférences de l'assistant",
          prompts: "Invites rapides",
        },
        labels: {
          ollamaUrl: "URL du serveur Ollama",
          model: "Modèle par défaut",
          language: "Langue de l'interface",
          tone: "Ton par défaut",
          showFloating:
            "Afficher le widget flottant lors de la sélection de texte",
          debugMode: "Activer le mode débogage",
          promptsList: "Liste des invites",
          newPrompt: "Nouvelle invite",
        },
        help: {
          ollamaUrl:
            "Saisis l'URL complète d'Ollama (ex. http://localhost:11434).",
          model:
            "Choisis le modèle de base. Tu pourras encore le changer depuis le popup.",
          language:
            "Choisis la langue des libellés, des invites rapides et du widget.",
          tone: "Ton sélectionné par défaut quand l'assistant s'ouvre.",
          showFloating:
            "Désactive-le si tu préfères n'utiliser que la barre d'outils ou le menu contextuel.",
          debugMode:
            "Affiche dans la console les réponses détaillées d'Ollama pour diagnostiquer les connexions.",
        },
        buttons: {
          testConnection: "Tester la connexion et les modèles",
          addPrompt: "Ajouter",
          save: "Enregistrer les paramètres",
          reset: "Restaurer les valeurs par défaut",
        },
        placeholders: {
          ollamaUrl: "http://localhost:11434",
          newPrompt: "Nouvelle invite...",
        },
        prompts: {
          empty: "Aucune invite définie. Ajoute-en une ci-dessous.",
          remove: "Supprimer",
        },
        alerts: {
          promptExists: "Cette invite existe déjà.",
          resetConfirm: "Rétablir les paramètres par défaut ?",
        },
        status: {
          saved: "Paramètres enregistrés.",
          urlEmpty: "L'URL d'Ollama ne peut pas être vide.",
          connectionSuccess: "Modèles chargés avec succès.",
          connectionError: "Erreur de connexion :",
          connectionFailed: "Impossible de récupérer les modèles.",
          defaultsRestored:
            "Valeurs par défaut restaurées. Enregistre pour confirmer.",
          languageChanged:
            "Langue mise à jour. Enregistre pour appliquer les nouvelles invites.",
        },
      },
    }),
  };

  function getPack(code) {
    return clone(LANGUAGE_PACKS[normalizeCode(code)]);
  }

  function listLanguages() {
    return Object.keys(LANGUAGE_PACKS).map((code) => ({
      code,
      label: LANGUAGE_PACKS[code].label,
    }));
  }

  const API = {
    packs: LANGUAGE_PACKS,
    get: getPack,
    list: listLanguages,
    resolveLanguage,
    detectSystemLanguage,
  };

  const globalScope =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof window !== "undefined"
      ? window
      : self;

  globalScope.OllamaI18N = API;
})();
