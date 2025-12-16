# Ollama Textarea Assistant

Firefox extension that pipes any editable text box to your local Ollama models. Highlight text (or place the caret in an empty field) and a floating action button opens a full in-page workspace where you can rewrite, translate, summarize, or expand the content. The toolbar popup mirrors the same workflow so you can iterate without leaving the browser UI.

## Highlights
- **Floating widget** with tone presets, reusable prompts, preview, accept/modify/discard controls, and HTML-safe replacements.
- **Context menu** entry plus keyboard-friendly popup that talk directly to the active tab without leaking credentials.
- **Options page** to configure server URL, default model, tone, quick prompts, debug mode, and the floating-widget toggle.
- **Fully localized UI** using Firefox's native i18n system with support for English, Italian, German, and French - automatic browser language detection with English fallback.
- **Shadow-DOM widget** styling so site builders (Elementor, etc.) can't override the assistant UI.
- **Background script** acts as a tiny proxy so the content script never needs direct network access (avoids CORS issues).
- **Consistent UI design** with 5px border-radius across all interface elements for a polished look.

## Requirements
- Firefox 91+ (Manifest v2, `browser.*` APIs available).
- [Ollama](https://github.com/ollama/ollama) running locally or on your LAN. Default endpoint: `http://localhost:11434`.
- CORS access from the browser to the Ollama API, e.g.
  ```bash
  OLLAMA_ORIGINS="*" ollama serve
  ```

## Installation
1. Clone/download this repository.
2. Navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**, pick `manifest.json`, and keep the tab open to reload after browser restarts.

Temporary add-ons disappear on restart. Package an unsigned `.xpi` or submit to AMO for a permanent install.

## Usage
- **Context menu / floating widget** - Select text inside an editable element, right-click the **Ollama Assistant** entry, or click the floating button that appears near the selection. The in-page widget captures the target element (textarea, `contenteditable`, CKEditor iframe, etc.), runs your prompt, and writes the response back in place while preserving HTML.
- **Popup** - Click the toolbar icon. Choose the model, tone, and prompt (or type your own). The popup asks the active tab for the latest selection/context, sends it to Ollama, and lets you accept, modify, or discard without leaving the popup. Accept/discard actions now talk directly to the content script via `tabs.sendMessage`.
- **Settings** - Visit `about:addons  Ollama Textarea Assistant  Preferences` to configure the endpoint, default prompt list, tone, floating widget, language preference, and debug logging. Changes sync to every open tab instantly.

## Localization & Language Handling
- **Native Firefox i18n system** using `_locales/` directory structure with `messages.json` files for each language (EN/IT/DE/FR).
- Context menu and extension metadata use `browser.i18n.getMessage()` API for instant, native translations.
- Content script, popup, and settings pages use a hybrid approach - custom i18n.js for complex nested translations with fallback support.
- The default **System (Automatic)** option reads the OS/browser locale and falls back to English when unsupported.
- Switching the preference in the options page swaps in the corresponding prompt presets; customized prompt lists remain untouched.
- All LLM instructions are written in English and explicitly tell the model to keep the original language unless a translation was requested, so bilingual workflows stay consistent.

## Architecture
- `manifest.json` – Declares permissions, popup, options UI, content/background scripts, and references native i18n strings with `__MSG_*__` syntax.
- `_locales/[lang]/messages.json` – Firefox native translation files for extension name, description, context menu, and widget UI elements.
- `background.js` – Initializes defaults using native i18n API, builds the context menu tree with translated strings, and proxies `OLLAMA_REQUEST` calls so content scripts never touch the network.
- `i18n.js` – Custom internationalization module providing comprehensive language packs for content script, popup, and settings with fallback support.
- `content-script.js` – Handles selection tracking (including CKEditor iframes), renders the floating widget and in-page workspace, manages conversation history, and replaces text/HTML safely inside textarea, input, and contenteditable targets. Includes fallback strings for when i18n.js fails to load.
- `popup.html/js/css` – Toolbar UI to trigger prompts from the browser action with 5px border-radius styling.
- `settings.html/js/css` – Options page for persistent configuration.

## Permissions
- `storage` – Persist Ollama URL, default model, tone, widget visibility, and prompt presets.
- `activeTab` + `tabs` – Allow the popup to query/modify the active page via `tabs.sendMessage`.
- `contextMenus` – Provide quick access prompts from the right-click menu.
- `notifications` – Alert the user when a page reload is required before the content script can respond.
- `<all_urls>` – Inject the assistant wherever editable text might appear.

## Troubleshooting
- **No response / network error** – Ensure Ollama is reachable at the configured URL and that CORS is enabled.
- **HTML formatting lost** – Explicitly ask Ollama to preserve tags; the content script keeps them untouched when valid markup is returned.
- **Floating button missing** – Enable it in settings or reload the tab so the new preference is applied.
- **Popup can’t read the page** – Re-run the temporary add-on load or refresh the tab so the content script is injected.

## Contributing
Issues and PRs are welcome. Describe the enhancement or bug clearly and include reproduction steps when possible.
