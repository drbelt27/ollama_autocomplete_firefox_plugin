# Guida al Debug della Selezione Testo

## Problemi Risolti

### 1. Perdita della Selezione

Quando si selezionava del testo e si apriva il widget Ollama, l'estensione mostrava l'alert "Seleziona del testo prima di aprire l'assistente" anche se il testo era stato effettivamente selezionato.

### 2. Aperture Multiple del Widget

In alcune situazioni, il widget poteva aprirsi due volte simultaneamente, causando duplicazione dell'interfaccia.

### Causa del problema

Il problema era causato da una **race condition**: quando l'utente cliccava sul widget floating, il browser perdeva la selezione del testo perché il focus si spostava su un altro elemento (il widget stesso o un DIV).

Sequenza degli eventi:
1. Utente seleziona testo → ✅ Selezione catturata correttamente
2. Utente clicca sul widget floating → Focus cambia
3. Browser perde la selezione → ❌ Selection diventa vuota
4. `openWidget()` chiama `captureSelection()` → Trova selezione vuota
5. Alert mostrato all'utente

## Soluzione Implementata

### 1. Sistema di Caching della Selezione

Aggiunto un nuovo campo nello state:
```javascript
savedSelection: null // Backup della selezione prima che venga persa
```

Questo oggetto contiene:
- `text`: Il testo selezionato
- `element`: L'elemento DOM da cui è stato selezionato
- `range`: Il Range object clonato (per contentEditable)
- `start`: Posizione di inizio (per textarea/input)
- `end`: Posizione di fine (per textarea/input)

### 2. Salvataggio Automatico

Quando viene catturata una selezione valida, viene automaticamente salvata in `state.savedSelection`:

```javascript
state.savedSelection = {
  text: selectedText,
  element: context.element,
  range: state.savedRange.cloneRange(),
  start: 0,
  end: selectedText.length
};
```

### 3. Riutilizzo della Selezione Salvata

In `captureSelection()`, se esiste una `savedSelection` valida, viene riutilizzata invece di catturarne una nuova:

```javascript
if (state.savedSelection && state.savedSelection.text && state.savedSelection.text.trim().length > 0) {
  // Usa la selezione salvata
  return true;
}
```

### 4. Invalidazione della Cache

La `savedSelection` viene invalidata (impostata a `null`) nei seguenti casi:
- Quando l'utente fa una **nuova selezione** (`handleSelectionChange`)
- Quando il widget viene **chiuso** (`closeWidget`)
- Quando il testo viene **accettato** e inserito (`handleAcceptFromWidget`)

## Protezione Contro Aperture Multiple

### Flag `isWidgetOpen`

Aggiunto un flag di stato `state.isWidgetOpen` che previene aperture multiple simultanee del widget:

```javascript
isWidgetOpen: false // Previene aperture multiple
```

### Controllo in `openWidget()`

All'inizio di `openWidget()`, viene verificato se il widget è già aperto:

```javascript
if (state.isWidgetOpen) {
  debugLog('Widget already open, ignoring request');
  return;
}
```

Il flag viene:
- **Impostato a `true`** quando il widget viene aperto
- **Resettato a `false`** quando il widget viene chiuso (`closeWidget`)

### Debounce sui Click

Il pulsante del floating widget include un debounce di 300ms per prevenire click multipli rapidi:

```javascript
let clickTimeout = null;
button.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (clickTimeout) {
    debugLog('Click ignored (debounce)');
    return;
  }

  clickTimeout = setTimeout(() => {
    clickTimeout = null;
  }, 300);

  openWidget(null, false);
});
```

### Scenari Prevenuti

1. **Click rapidi multipli** sul floating widget → Solo il primo viene processato
2. **Messaggi runtime simultanei** → Solo la prima apertura procede
3. **Click + messaggio runtime** → Il widget si apre solo una volta

## Sistema di Debug

### Attivazione dei Log

Imposta `DEBUG_MODE = true` nella riga 9 di `content-script.js`:

```javascript
const DEBUG_MODE = true; // Imposta a false per disabilitare i log in produzione
```

### Log Disponibili

I log sono prefissati con `[Ollama Debug]` e mostrano:

1. **In `resolveEditableContext()`**:
   - Elemento attivo rilevato
   - Se è un iframe
   - Se è contentEditable

2. **In `captureSelection()`**:
   - Se c'è una Selection API disponibile
   - Numero di range nella selezione
   - Lunghezza del testo selezionato
   - Se usa selezione salvata o nuova
   - Stato finale della cattura

3. **In `openWidget()`**:
   - Se è necessaria una nuova cattura
   - Testo finale disponibile

### Esempio di Output

```
[Ollama Debug] Capture Selection: {
  hasSelection: true,
  rangeCount: 1,
  selectedText: "Testo selezionato...",
  selectedTextLength: 281,
  hasSavedSelection: false
}
[Ollama Debug] Using user selection: Testo selezionato...
[Ollama Debug] Range saved successfully
```

## Test della Soluzione

1. Abilita `DEBUG_MODE = true`
2. Ricarica l'estensione in Firefox
3. Vai su una pagina web con editor di testo
4. Seleziona del testo
5. Clicca sul widget floating
6. Osserva i log nella console (F12)

### Comportamento Atteso

- Prima cattura: `Using user selection: [testo...]`
- Seconda cattura (dopo click): `Using previously saved selection: [testo...]`
- Il widget si apre correttamente senza alert

## Disattivazione Debug in Produzione

Prima di rilasciare la versione finale:

```javascript
const DEBUG_MODE = false; // Disabilita tutti i log
```

Questo rimuoverà completamente i log dalla console senza dover modificare il codice.
