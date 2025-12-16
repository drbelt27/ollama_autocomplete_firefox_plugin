# Fix per Preservazione Formattazione HTML

## Problema Risolto

Quando si selezionava testo con formattazione HTML (da CKEditor, TinyMCE o altri editor WYSIWYG) e si chiedeva all'AI di modificarlo (es. correzione grammaticale, riformulazione), l'AI restituiva il testo **senza la formattazione originale**.

### Problema Specifico Identificato

Il testo veniva catturato usando `selection.toString()` che **rimuove automaticamente tutti i tag HTML**, restituendo solo testo plain anche quando la selezione conteneva formattazione ricca.

### Esempio del Problema

**Input (HTML formattato):**
```html
<p>Ciao <strong>Matteo</strong></p>
<p>Ci siamo accorti che i <em>ticket generati</em> dallo schedulatore...</p>
```

**Output (formattazione persa):**
```
Ciao Matteo
Ci siamo accorti che i ticket generati dallo schedulatore...
```

## Causa del Problema

**Problema principale:** La selezione veniva catturata con `selection.toString()` che converte l'HTML in testo plain, perdendo tutti i tag.

**Problema secondario:** I prompt di sistema non erano sufficientemente espliciti sulla necessità di **preservare la struttura HTML** durante la modifica del contenuto testuale.

## Soluzione Implementata

### Fix #1: Estrazione HTML dalla Selezione (CRITICO)

Invece di usare `selection.toString()`, ora estraiamo l'HTML effettivo dal range selezionato quando l'elemento è `contentEditable`:

```javascript
// Prima (SBAGLIATO):
const selectedText = selection ? selection.toString().trim() : "";
// Risultato: testo plain senza tag

// Dopo (CORRETTO):
if (selection && selection.rangeCount > 0 && isContentEditableContext) {
  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
  const tempDiv = doc.createElement("div");
  tempDiv.appendChild(fragment);
  const htmlContent = getCleanHTML(tempDiv);
  selectedText = htmlContent; // Contiene i tag HTML!
}
```

**Benefici:**
- Preserva `<b>`, `<u>`, `<i>`, `<strong>`, `<em>`, `<br>`, `<div>`, `<p>`, liste, etc.
- Mantiene gli attributi `style` inline
- L'HTML viene pulito dalla funzione `getCleanHTML()` che rimuove script e tag pericolosi

### Fix #2: Prompt di Sistema Migliorati

### 1. Prompt di Sistema Migliorato

**Prima (versione debole):**
```
You are an HTML editor. Preserve every HTML tag and structure exactly as received.
```

**Dopo (versione rafforzata):**
```
You are an HTML editor assistant. CRITICAL RULES:
1. PRESERVE ALL HTML tags, attributes, and structure EXACTLY as received
2. PRESERVE ALL formatting tags like <strong>, <em>, <b>, <i>, <u>, <br>, <p>, lists, headings, etc.
3. Only modify the TEXT CONTENT inside tags, never remove or change the HTML structure
4. If text has formatting (bold, italic, lists), KEEP that formatting in the output
5. Always respond in the same language as the provided HTML unless the user explicitly asks to translate
6. Return ONLY the modified HTML without code blocks, explanations, or quotes
```

### 2. Template Utente Rafforzato

**Prima:**
```
HTML content:
${text}

Instruction: ${prompt}
Tone: ${tone}.
Return only the modified HTML.
```

**Dopo:**
```
HTML content:
${text}

Instruction: ${prompt}
Tone: ${tone}.

IMPORTANT: Modify only the text content. Keep ALL HTML tags and formatting EXACTLY as in the original.
```

### 3. Logging per Debug

Aggiunto logging in `requestOllama()` per verificare:
- Se il contenuto viene rilevato come HTML
- Quale tipo di prompt viene usato (HTML vs Plain)
- Anteprima del prompt di sistema

## File Modificati

### Fix Critici (Estrazione HTML):
1. **[content-script.js:417-462](content-script.js#L417-L462)** - `captureSelection()` ora estrae HTML dal range invece di usare `.toString()`
   - Rileva automaticamente se l'elemento è `contentEditable`
   - Usa `cloneContents()` per preservare i tag HTML
   - Fallback a testo plain se non ci sono tag HTML

### Miglioramenti Prompt:
2. **[content-script.js:43-49](content-script.js#L43-L49)** - Aggiornato `FALLBACK_STRINGS.ai`
3. **[i18n.js:4-13](i18n.js#L4-L13)** - Aggiornato `AI_BASE` (prompt base per tutte le lingue)
4. **[content-script.js:1020-1037](content-script.js#L1020-L1037)** - Aggiunto logging in `requestOllama()`

## Come Testare

### Test 1: Testo con Bold/Italic

1. Seleziona questo testo in un editor HTML:
   ```html
   <p>Questo è un <strong>testo importante</strong> con <em>enfasi</em>.</p>
   ```

2. Chiedi all'AI: "Rendi più formale"

3. **Risultato atteso:**
   ```html
   <p>Il presente rappresenta un <strong>contenuto rilevante</strong> con <em>particolare enfasi</em>.</p>
   ```

4. **Verifica**: I tag `<strong>` e `<em>` devono essere preservati!

### Test 2: Liste HTML

1. Seleziona:
   ```html
   <ul>
     <li>Primo punto</li>
     <li>Secondo punto</li>
   </ul>
   ```

2. Chiedi: "Espandi ogni punto"

3. **Risultato atteso:** La struttura `<ul><li>` deve rimanere intatta

### Test 3: Paragrafi Multipli

1. Seleziona testo con più paragrafi separati da `<p>` o `<br>`
2. Chiedi una modifica qualsiasi
3. **Verifica**: I separatori di paragrafo devono essere mantenuti

## Debug con Console

Con `DEBUG_MODE = true`, nella console vedrai:

### Durante la Cattura della Selezione:
```
[Ollama Debug] Capture Selection: {
  hasSelection: true,
  rangeCount: 1,
  selectedText: "<div>teo entro settimana prossima...</div>",
  selectedTextLength: 533,
  elementTag: "BODY",
  isContentEditable: true,
  inIframe: false,
  hasSavedSelection: false,
  containsHtml: true  // ✅ Questo deve essere true!
}
[Ollama Debug] Extracted HTML from selection
```

### Durante la Richiesta a Ollama:
```
[Ollama Debug] Request Ollama: {
  containsHtml: true,  // ✅ Rilevato HTML
  textPreview: "<div style='font-family: Aptos...'>teo entro settimana...</div>",
  promptType: "HTML"  // ✅ Usa il prompt HTML
}
[Ollama Debug] System prompt being used: You are an HTML editor assistant. CRITICAL RULES:
1. PRESERVE ALL HTML tags...
```

### Problemi da Controllare:

❌ **Se vedi `"Using plain text from selection (no HTML tags found)"`**
- Significa che il range selezionato non conteneva tag HTML validi
- Verifica che stai selezionando in un editor HTML vero

❌ **Se vedi `containsHtml: false` quando hai tag HTML**
- Il regex di rilevamento non matcha il tuo HTML
- Controlla che ci siano tag validi come `<div>`, `<p>`, `<b>`, etc.

## Comportamento Atteso

### ✅ Quando HTML viene rilevato

- L'AI usa il prompt `htmlSystem` (con regole CRITICAL)
- L'AI preserva TUTTI i tag HTML
- Solo il testo dentro i tag viene modificato
- La struttura e formattazione rimangono identiche

### ✅ Quando è testo semplice

- L'AI usa il prompt `plainSystem`
- Nessun tag HTML nel risultato
- Solo modifiche al testo

## Note Aggiuntive

- Il rilevamento HTML usa il regex: `/<\/?[a-z][\s\S]*>/i`
- Questo matcha qualsiasi tag HTML: `<p>`, `<strong>`, `<br>`, etc.
- Se l'AI continua a rimuovere tag, potrebbe essere necessario usare un modello più avanzato (es. `llama3.1` invece di `llama3`)

## Fallback per Modelli Vecchi

Se usi un modello che fatica a seguire le istruzioni:

1. Aumenta la temperatura per più creatività: ❌ (peggiora)
2. Riduci la temperatura per più fedeltà: ✅ (migliora)
3. Usa modelli più grandi/recenti: ✅ (migliora molto)
4. Aggiungi esempi nel prompt: ✅ (può aiutare)

Esempio con esempi:
```
System: ... [regole]

Example:
Input: <p>Hello <strong>world</strong></p>
Output: <p>Hi <strong>world</strong></p>

Now process the user's text following the same pattern.
```
