# Istruzioni per le Icone del Plugin

## Posizione delle Icone

Tutte le icone del plugin si trovano nella cartella `/icons/`.

## Icone Richieste

### 1. **Icone Toolbar** (per la barra degli strumenti di Firefox)
- **icon-16.svg**: 16x16 pixel - Icona toolbar display standard
- **icon-32.svg**: 32x32 pixel - Icona toolbar display alta risoluzione (Retina)

### 2. **Icone Extension** (per il menu estensioni e addon store)
- **icon-48.svg**: 48x48 pixel - Icona media dimensione per menu
- **icon-96.svg**: 96x96 pixel - Icona grande per display alta risoluzione

### 3. **Logo Principale** (per popup e settings)
- **logo-128.svg**: 128x128 pixel - Logo principale usato in:
  - Header del popup (ridimensionato a 40x40px)
  - Header delle impostazioni (ridimensionato a 60x60px)

## Formato e Stile

Le icone sono attualmente in formato **SVG** con uno stile placeholder:
- Gradiente viola-blu (da #667eea a #764ba2)
- Simbolo + al centro con cerchio
- Sfondo trasparente

## Come Sostituire le Icone

### Opzione 1: Mantenere formato SVG (Raccomandato)
Sostituisci i file SVG esistenti con i tuoi design mantenendo gli stessi nomi file.

**Vantaggi SVG:**
- Scalabilità perfetta a qualsiasi dimensione
- Dimensione file ridotta
- Supporto per Firefox moderno

### Opzione 2: Usare PNG
Se preferisci usare immagini PNG:

1. Crea le icone PNG nelle dimensioni richieste
2. Rinomina i file (esempio: `icon-16.svg` → `icon-16.png`)
3. Aggiorna il file `manifest.json`:

```json
"icons": {
  "16": "icons/icon-16.png",
  "32": "icons/icon-32.png",
  "48": "icons/icon-48.png",
  "96": "icons/icon-96.png"
},
"browser_action": {
  ...
  "default_icon": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png"
  }
}
```

4. Aggiorna i riferimenti HTML:
   - In `popup.html`: `<img src="icons/logo-128.png" ...`
   - In `settings.html`: `<img src="icons/logo-128.png" ...`

## Linee Guida per il Design

### Stile Consigliato
- **Colori**: Usa il gradiente viola-blu del plugin (#667eea → #764ba2) o colori coordinati
- **Forme**: Semplici e riconoscibili anche a 16x16px
- **Temi**: Considera supporto dark mode se usi PNG trasparenti

### Dimensioni Visualizzate
- **Toolbar**: 16x16px (standard), 32x32px (Retina)
- **Popup Header**: 40x40px
- **Settings Header**: 60x60px
- **Extension Menu**: 48x48px (standard), 96x96px (Retina)

## Test delle Icone

Dopo aver sostituito le icone:

1. **Ricarica l'estensione** in `about:debugging#/runtime/this-firefox`
2. **Verifica visualizzazione in**:
   - Toolbar di Firefox
   - Menu estensioni (icona piccola e grande)
   - Popup del plugin (header)
   - Pagina impostazioni (header)
   - Firefox Add-ons Store (se pubblichi)

## Riferimenti Mozilla

Per maggiori dettagli sulle icone delle estensioni Firefox:
- [Mozilla: Extension Icons](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/icons)
- [Mozilla: Browser Action Icons](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_action)

## Supporto

Le icone placeholder attuali sono completamente funzionanti e possono essere usate per il testing. Sostituiscile con il tuo branding quando sei pronto.
