# Changelog - Versione 2.2.0

## Miglioramenti Implementati

### 🎨 Branding e Icone

#### Nuova Struttura Icone
- ✅ Creata cartella `/icons/` con icone placeholder SVG in diverse dimensioni:
  - `icon-16.svg` - Toolbar standard (16x16px)
  - `icon-32.svg` - Toolbar Retina (32x32px)
  - `icon-48.svg` - Extension menu (48x48px)
  - `icon-96.svg` - Extension menu Retina (96x96px)
  - `logo-128.svg` - Logo principale (128x128px)

#### Integrazione Loghi
- ✅ Logo visibile nell'header del popup (40x40px)
- ✅ Logo visibile nell'header delle impostazioni (60x60px)
- ✅ Icone toolbar configurate nel manifest

📄 **Vedi**: [ICONE_ISTRUZIONI.md](./ICONE_ISTRUZIONI.md) per dettagli su dimensioni e come sostituire le icone placeholder

---

### 🔌 Gestione Connessione Ollama

#### Controllo Connessione nel Popup
- ✅ Verifica automatica della connessione a Ollama all'apertura del popup
- ✅ Messaggio di errore chiaro se Ollama non è configurato o non risponde
- ✅ Pulsante "Apri Impostazioni" per accesso rapido alla configurazione
- ✅ Blocco dell'interfaccia se la connessione non è disponibile

**Comportamento**:
- Se Ollama non è raggiungibile, il popup mostra un messaggio e nasconde i controlli
- L'utente viene indirizzato alle impostazioni per configurare l'URL del server

---

### 🎯 Popup Migliorato

#### Nuovo Selettore Lunghezza Risposta
- ✅ Preset di lunghezza risposta:
  - **Breve**: Risposte concise
  - **Media**: Equilibrate (default)
  - **Lunga**: Dettagliate
  - **Molto Dettagliata**: Risposte complete e approfondite

#### Tono Espanso
- ✅ Nuovo tono "Casual" aggiunto alle opzioni esistenti (Formale, Professionale, Amichevole)

#### Design Header
- ✅ Logo del plugin visibile nell'header
- ✅ Layout migliorato con separatore

---

### ⚙️ Impostazioni Avanzate

#### Nuove Opzioni di Configurazione

##### Tono di Default
- ✅ Possibilità di impostare il tono predefinito per le risposte
- ✅ Il tono selezionato viene caricato automaticamente nel popup
- ✅ Opzioni: Formale, Professionale, Amichevole, Casual

##### Controllo Widget Floating
- ✅ Toggle per mostrare/nascondere il widget floating quando si seleziona testo
- ✅ Utile per chi trova il widget invasivo
- ✅ Impostazione salvata e sincronizzata in tempo reale

#### Design Impostazioni
- ✅ Logo del plugin nell'header
- ✅ Nuova sezione "Preferenze Assistente"
- ✅ Checkbox stilizzata per il controllo widget

---

### 🎪 Widget In-Page Draggable

#### Funzionalità Drag & Drop
- ✅ Widget in-page ora **trascinabile** cliccando sull'header
- ✅ Cursore "grab/grabbing" per feedback visivo
- ✅ Posizione libera sullo schermo
- ✅ Hint "Trascina qui" nell'header per indicare la funzionalità

#### Miglioramenti UX
- ✅ Transizioni fluide durante il trascinamento
- ✅ Header con stile `user-select: none` per evitare selezione accidentale
- ✅ Non interferisce con il pulsante di chiusura

---

### 🎯 Widget Floating Intelligente

#### Comportamento Ottimizzato
- ✅ Il widget floating appare **SOLO** quando si seleziona testo in:
  - Campi `<textarea>`
  - Campi `<input>`
  - Elementi `contentEditable`
  - Editor CKEditor (iframe)

#### Cosa è Cambiato
- ❌ **Prima**: Il widget appariva ovunque si selezionasse testo (anche su testo normale della pagina)
- ✅ **Ora**: Il widget appare solo in campi editabili, evitando fastidio durante la lettura

#### Validazioni
- ✅ Controllo che l'elemento sia effettivamente editabile
- ✅ Controllo che la selezione abbia dimensioni visibili
- ✅ Rispetta l'impostazione `showFloatingWidget` dai settings

---

### 🛠️ Ottimizzazioni e Stabilità

#### Gestione Errori
- ✅ Try-catch robusti nelle funzioni critiche
- ✅ Messaggi di errore più descrittivi e utili
- ✅ Fallback eleganti quando Ollama non risponde

#### Sincronizzazione Settings
- ✅ Listener per aggiornamenti storage in tempo reale
- ✅ Widget floating si aggiorna immediatamente se l'impostazione cambia
- ✅ Prompt predefiniti sincronizzati automaticamente

#### Validazioni Input
- ✅ Controllo elementi editabili prima di mostrare widget
- ✅ Validazione dimensioni selezione (evita widget su selezioni vuote)
- ✅ Controllo presenza testo prima di elaborare richieste

---

## 📋 File Modificati

### Nuovi File
- `/icons/icon-16.svg`
- `/icons/icon-32.svg`
- `/icons/icon-48.svg`
- `/icons/icon-96.svg`
- `/icons/logo-128.svg`
- `ICONE_ISTRUZIONI.md`
- `CHANGELOG_v2.2.0.md`

### File Aggiornati
- `manifest.json` - Versione 2.2.0, riferimenti icone
- `popup.html` - Logo header, selettore lunghezza, sezione errore connessione
- `popup.js` - Controllo connessione, gestione lunghezza risposta, tono default
- `popup.css` - Stili header logo, help-text
- `settings.html` - Logo header, tono default, toggle widget floating
- `settings.js` - Gestione nuove impostazioni (defaultTone, showFloatingWidget)
- `settings.css` - Stili logo, checkbox
- `content-script.js` - Widget draggable, floating intelligente, validazioni, sync storage

---

## 🚀 Come Testare

### 1. Ricaricare l'Estensione
```
about:debugging#/runtime/this-firefox → Ricarica
```

### 2. Testare Connessione Ollama
- Clicca sull'icona del plugin nella toolbar
- Se Ollama non è attivo, dovresti vedere il messaggio di errore
- Clicca "Apri Impostazioni" per configurare

### 3. Testare Widget Draggable
- Seleziona testo in un campo textarea
- Clicca con il menu contestuale o sul widget floating
- **Trascina** il widget in-page dall'header

### 4. Testare Widget Floating
- Nelle impostazioni, togli/metti il flag "Mostra widget floating"
- Seleziona testo in una textarea
- Il widget dovrebbe apparire/sparire secondo l'impostazione

### 5. Testare Preset Lunghezza
- Apri il popup
- Seleziona diverse lunghezze di risposta (Breve, Media, Lunga, Molto Dettagliata)
- Verifica che le risposte di Ollama cambino di conseguenza

### 6. Testare Tono Default
- Vai nelle impostazioni
- Cambia il "Tono di default" (es. da Professionale a Casual)
- Salva
- Apri il popup → il tono dovrebbe essere già impostato su Casual

---

## 📝 Note per lo Sviluppatore

### Sostituire Icone Placeholder
Le icone SVG attuali sono placeholder con gradiente viola-blu. Per brandizzare il plugin:

1. Crea le tue icone nelle dimensioni richieste
2. Sostituisci i file nella cartella `/icons/`
3. Mantieni gli stessi nomi file (o aggiorna i riferimenti)

Vedi [ICONE_ISTRUZIONI.md](./ICONE_ISTRUZIONI.md) per dettagli.

### Prossimi Miglioramenti Possibili
- [ ] Supporto temi personalizzati
- [ ] Shortcut da tastiera
- [ ] History delle conversazioni
- [ ] Export/import impostazioni
- [ ] Supporto multi-lingua

---

## 🐛 Bug Fix

- ✅ Widget floating non appare più su testo normale (solo su campi editabili)
- ✅ Gestione corretta sincronizzazione impostazioni storage
- ✅ Validazione dimensioni selezione per evitare widget su selezioni vuote
- ✅ Drag header non interferisce con pulsante chiusura

---

## 💡 Fonti e Riferimenti

Durante lo sviluppo sono stati consultati:
- [Mozilla: Extension Icons](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/icons) - Dimensioni icone raccomandate
- [Mozilla: Browser Action](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_action) - Configurazione toolbar
- [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) - Implementazione drag

---

**Versione**: 2.2.0
**Data**: 16 Dicembre 2025
**Compatibilità**: Firefox 91.0+
