# Ollama Textarea Assistant

**Version 2.2.0** - Firefox extension that brings your local Ollama models into any text box on the web. Select text or place the caret inside a textarea, rich text editor, or CKEditor instance and the assistant will open an in-page workspace where you can rewrite, translate, summarize, or expand the content with one click.

## ✨ What's New in v2.2.0

- **🎨 Custom Branding**: Plugin icons and logos throughout the interface (toolbar, popup, settings)
- **🔌 Connection Validation**: Automatic Ollama connection check with guided setup
- **📏 Response Length Presets**: Choose from Breve, Media, Lunga, or Molto Dettagliata
- **🎯 Default Tone Setting**: Configure your preferred tone (Formale, Professionale, Amichevole, Casual)
- **🎪 Draggable Widget**: In-page assistant can now be moved by dragging the header
- **🎯 Smart Floating Widget**: Only appears when selecting text in editable fields (textarea, input, contenteditable)
- **⚙️ Widget Toggle**: Disable floating widget from settings if you find it distracting

See [CHANGELOG_v2.2.0.md](./CHANGELOG_v2.2.0.md) for complete details.

## Features
- Context menu integration with configurable quick prompts that appear on right click inside editable fields.
- Floating action button that surfaces after you highlight text, opening a full in-page assistant with preview, accept, modify, and discard flows.
- Works with standard textareas, `contenteditable` regions, and popular WYSIWYG editors (including CKEditor iframes) while preserving HTML structure when required.
- Browser action popup to run prompts with tone presets, review results, iterate with follow-up instructions, and send the accepted answer back to the page.
- Options page to configure the Ollama endpoint, pick a default model, and curate the list of reusable prompts stored in `browser.storage`.

## Requirements
- Firefox 91 or newer (manifest v2 with `browser.*` APIs).
- A running [Ollama](https://github.com/ollama/ollama) server reachable from Firefox. The default URL is `http://localhost:11434`.
- CORS access from the browser to the Ollama API. When serving locally you can allow all origins with:

  ```bash
  OLLAMA_ORIGINS="*" ollama serve
  ```

  Adjust the origin list as needed for your environment.

## Installation (Temporary Add-on)
1. Clone or download this repository.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and choose `manifest.json` from the project folder.
4. The extension icon (`Ollama AI Assistant`) now appears in the toolbar; the context menu items become available on every page.

> **Tip:** Temporary add-ons disappear when Firefox closes. To keep the extension installed permanently, package it as an unsigned `.xpi` or publish it on AMO.

## Usage
- **Context menu / floating widget**  
  Select text or focus an editable area, right-click, and pick one of the default prompts or the custom prompt entry. A floating button also appears briefly near your selection; click it to open the same assistant panel.

- **In-page assistant panel**  
  The overlay (`content-script.js`) grabs the selected text, calls the Ollama chat endpoint via the background script, and shows a preview. Accept inserts the response back into the original field (with HTML preserved), Modify keeps the conversation history so you can refine the output, and Discard closes the panel.

- **Popup workflow**  
  Click the toolbar icon to access the popup (`popup.html`). Choose a model, tone, default prompt, or write your own instruction. The popup retrieves the active tab’s text context, displays the AI result, and lets you accept, discard, or ask for changes without leaving the popup.

- **Settings**
  Open the extension's preferences (`about:addons` → Ollama Textarea Assistant → Preferences) to:
  - Configure the Ollama server URL and test connection
  - Select default model and tone
  - Manage custom prompt presets
  - Toggle floating widget visibility
  - View plugin branding and version info

  Changes immediately sync to all active tabs.

> UI labels are currently in Italian; adjust the source files if you need another language.

## Customization

### Replace Plugin Icons
The plugin includes placeholder icons in `/icons/`. To add your own branding:
1. Create icons in the required sizes (16x16, 32x32, 48x48, 96x96, 128x128)
2. Replace the SVG files in `/icons/` or use PNG format
3. Update `manifest.json` if changing file format

See [ICONE_ISTRUZIONI.md](./ICONE_ISTRUZIONI.md) for detailed instructions.

## Architecture
- `manifest.json` — Declares permissions, content scripts, browser action popup, and options page.
- `background.js` — Initializes default settings, builds the context menu tree, listens for menu clicks, and proxies Ollama API requests to bypass content-script CORS restrictions.
- `content-script.js` — Injects the floating button and rich assistant widget, tracks the active editable element, manages conversation history, and writes the AI response back into textareas or rich text editors.
- `popup.html`, `popup.js`, `popup.css` — Toolbar popup interface for running prompts and inserting results.
- `settings.html`, `settings.js`, `settings.css` — Options UI for configuring the server, default model, and reusable prompts.
- `content-style.css` — Styling for the injected widget and floating controls.

## Permissions Justification
- `storage` — Persist Ollama URL, default model, prompt presets, and quick prompt state.
- `activeTab`, `tabs` — Communicate between the popup/background and the current tab’s content script.
- `contextMenus` — Provide quick access prompts from the right-click menu.
- `notifications` — Inform the user when a page reload is required for the widget to work.
- `<all_urls>` — Allow the content script and context menu to operate on every site where you might edit text.

## Troubleshooting
- **No response / network error:** Verify that the Ollama server is running at the configured URL and that Firefox can reach it (check VPNs, firewalls, and CORS settings).
- **HTML formatting stripped:** When working inside a rich text editor ensure your prompt explicitly asks to preserve HTML. The content script keeps tags intact if the model returns valid markup.
- **Extension not appearing:** Temporary add-ons must be reloaded after restarting Firefox; revisit `about:debugging` to load it again.

## Contributing
Pull requests and issues are welcome. Please describe the enhancement or bug clearly and include steps to reproduce when applicable.
