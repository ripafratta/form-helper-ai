document.addEventListener('DOMContentLoaded', function () {
    // --- Elementi UI ---
    const extractFormsButton = document.getElementById('extractFormsButton');
    const extractFormsWithAiButton = document.getElementById('extractFormsWithAiButton');
    const pageNameInput = document.getElementById('pageNameInput');
    const previewFrame = document.getElementById('previewFrame');
    const htmlSourceTextarea = document.getElementById('htmlSourceTextarea');
    const viewModeRadios = document.querySelectorAll('input[name="viewMode"]');
    const applySourceChangesButton = document.getElementById('applySourceChangesButton');
    const copyButton = document.getElementById('copyButton');
    const saveButton = document.getElementById('saveButton');
    const statusMessage = document.getElementById('statusMessage');

    const configToggle = document.getElementById('configToggle');
    const aiConfigContent = document.getElementById('aiConfigContent');

    // AI Config
    const llmModelSelect = document.getElementById('llmModelSelect');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveAiConfigButton = document.getElementById('saveAiConfigButton');

    // Unified Filling and Mapping Section Elements (removed duplicate declaration)
    const fillingAndMappingSection = document.getElementById('fillingAndMappingSection');
    
    const loadJsonDataButton = document.getElementById('loadJsonDataButton');
    const jsonDataFileInput = document.getElementById('jsonDataFileInput');
    const assignDirectJsonValuesButton = document.getElementById('assignDirectJsonValuesButton');

    const loadTextDataButton = document.getElementById('loadTextDataButton');
    const textDataFileInput = document.getElementById('textDataFileInput');
    const dataInputUnified = document.getElementById('dataInputUnified'); // Unified textarea

    const mapWithAiButton = document.getElementById('mapWithAiButton'); // Unified

    const aiOutputContainer = document.getElementById('aiOutputContainer'); // Unified
    const aiOutputTitle = document.getElementById('aiOutputTitle'); // Unified
    const aiOutputInfo = document.getElementById('aiOutputInfo'); // Unified
    const aiOutputTextarea = document.getElementById('aiOutputTextarea'); // Unified
    const applyAiMappingButton = document.getElementById('applyAiMappingButton'); // Unified
    const resetAiMappingButton = document.getElementById('resetAiMappingButton'); // Unified

    // Collapsible Sections
    const extractionSection = document.getElementById('extractionSection');
    const extractionHeader = document.getElementById('extractionHeader'); // New
    const extractionContent = document.getElementById('extractionContent'); // New

    const fillingHeader = document.getElementById('fillingHeader'); // New
    const fillingContent = document.getElementById('fillingContent'); // New

    // Loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');

    // --- Stato Interno (Defaults) ---
    let currentHtmlContent = null;
    let aiConfig = { model: 'none', apiKey: '' };
    let debugMode = true; // Default, will be overridden by config.json
    const AI_CONFIG_KEY = 'ai_config_v3';
    const SESSION_STATE_KEY = 'popup_session_state_v4'; // Updated session state key

    // ===========================================
    // --- DEBUG MODE FUNCTIONALITY ---
    // ===========================================

    /**
     * Ottiene la modalità debug dal manifest
     * @returns {Promise<boolean>} true se in modalità debug, false altrimenti
     */
    async function getDebugMode() {
        try {
            const response = await fetch(chrome.runtime.getURL('config.json'));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();
            return config.debug_mode === true;
        } catch (error) {
            console.error('Errore lettura config.json:', error);
            return true; // Default debug mode if config.json fails
        }
    }

    /**
     * Inizializza l'UI in base alla modalità
     */
    async function initializeUIMode() {
        debugMode = await getDebugMode(); // Set debugMode based on config.json

        if (debugMode) {
            debugLog('🔧 MODALITÀ DEBUG ATTIVA');
            document.body.classList.remove('production-mode');
        } else {
            console.log('🚀 MODALITÀ PRODUZIONE ATTIVA');
            document.body.classList.add('production-mode');
            // In produzione, le sezioni sono inizialmente collassate per default,
            // tranne la sezione di compilazione che sarà aperta se non ci sono dati salvati.
            // La logica di loadSessionState gestirà l'apertura/chiusura iniziale.
        }
    }

    /**
     * Log condizionale basato sulla modalità
     */
    function debugLog(...args) {
        if (debugMode) {
            console.log('[DEBUG]', ...args);
        }
    }

    /**
     * Mostra/nasconde loading overlay (solo in produzione)
     */
    function setLoading(show, text = 'Elaborazione in corso...') {
        if (!debugMode && loadingOverlay) {
            if (show) {
                loadingOverlay.querySelector('.loading-text').textContent = text;
                loadingOverlay.classList.remove('hidden');
            } else {
                loadingOverlay.classList.add('hidden');
            }
        }
    }

    // ===========================================
    // --- Funzioni Helper (Definizioni Chiave) ---
    // ===========================================
    function showStatus(message, type = 'info', duration = 5000) {
        // In modalità produzione, semplifica i messaggi tecnici
        if (!debugMode) {
            // Sostituisci messaggi tecnici con versioni user-friendly
            const userFriendlyMessages = {
                '🔧 Estrazione algoritmica in corso...': '⏳ Analisi della pagina in corso...',
                '🤖 Estrazione HTML per analisi AI...': '🤖 Analisi intelligente in corso...',
                '⚡ Assegnazione valori in corso nella pagina...': '✏️ Compilazione automatica in corso...',
                '🤖 Invio dati (JSON) a': '🤖 Elaborazione intelligente dei dati...',
                '🤖 Invio dati (Testo) a': '🤖 Interpretazione del testo in corso...'
            };

            // Cerca corrispondenze parziali
            for (const [technical, friendly] of Object.entries(userFriendlyMessages)) {
                if (message.includes(technical.split('...')[0])) {
                    message = friendly;
                    break;
                }
            }
        }

        statusMessage.textContent = message;
        statusMessage.className = ''; // Reset classes
        statusMessage.classList.add(`status-${type}`);
        clearTimeout(statusMessage.timer);
        if (duration > 0) {
            statusMessage.timer = setTimeout(() => {
                if (statusMessage.textContent === message && !statusMessage.classList.contains('status-permanent')) {
                    statusMessage.textContent = '';
                    statusMessage.className = '';
                }
            }, duration);
        } else {
            statusMessage.classList.add(`status-permanent`);
        }
    }

    /**
     * Esegue automaticamente l'estrazione form se necessario
     * @returns {Promise<boolean>} true se l'estrazione ha avuto successo
     */
    async function ensureFormExtracted() {
        if (currentHtmlContent && currentHtmlContent.trim() !== '') {
            debugLog('Form già estratti, skip estrazione automatica');
            return true;
        }

        debugLog('Form non estratti, avvio estrazione automatica');
        setLoading(true, 'Analisi della pagina in corso...');

        try {
            // Prova prima con AI se configurata
            if (aiConfig.model !== 'none' && aiConfig.apiKey) {
                debugLog('Tentativo estrazione AI automatica');
                const success = await performAiExtraction(true); // silent mode
                if (success) {
                    setLoading(false);
                    return true;
                }
            }

            // Fallback ad estrazione algoritmica
            debugLog('Fallback ad estrazione algoritmica');
            const success = await performAlgorithmicExtraction(true); // silent mode
            setLoading(false);
            return success;

        } catch (error) {
            debugLog('Errore durante estrazione automatica:', error);
            setLoading(false);
            showStatus('❌ Errore durante l\'analisi della pagina. Riprova.', 'error');
            return false;
        }
    }

    /**
     * Esegue l'estrazione algoritmica
     * @param {boolean} silent - Se true, non mostra messaggi di stato dettagliati
     * @returns {Promise<boolean>} true se successo
     */
    async function performAlgorithmicExtraction(silent = false) {
        if (!silent) {
            showStatus('🔧 Estrazione algoritmica in corso...', 'info', 0);
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            if (!silent) showStatus('❌ Errore scheda attiva.', 'error');
            return false;
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const result = {
                        html: window.extractAndSimplifyForms_content(),
                        pageTitle: document.title || '',
                        firstH1: document.querySelector('h1')?.textContent?.trim() || ''
                    };
                    return result;
                }
            });

            if (results && results[0] && results[0].result) {
                const { html, pageTitle, firstH1 } = results[0].result;
                currentHtmlContent = html;

                // Popola il campo pageNameInput
                if (!pageNameInput.value) {
                    if (pageTitle) {
                        pageNameInput.value = sanitizeFilenameForSave(pageTitle);
                    } else if (firstH1) {
                        pageNameInput.value = sanitizeFilenameForSave(firstH1);
                    } else {
                        pageNameInput.value = 'pagina_estratta';
                    }
                }

                if (debugMode) {
                    previewFrame.srcdoc = currentHtmlContent;
                    copyButton.disabled = false;
                    saveButton.disabled = false;
                }

                if (!silent) {
                    if (currentHtmlContent.includes("Nessuna form")) {
                        showStatus('ℹ️ Nessun form trovato.', 'info');
                    } else {
                        showStatus('🎉 Estrazione completata!', 'success');
                    }
                }

                saveSessionState();
                return true;
            }

            return false;
        } catch (error) {
            debugLog('Errore estrazione algoritmica:', error);
            if (!silent) showStatus(`❌ Errore estrazione: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Esegue l'estrazione AI
     * @param {boolean} silent - Se true, non mostra messaggi di stato dettagliati
     * @returns {Promise<boolean>} true se successo
     */
    async function performAiExtraction(silent = false) {
        if (aiConfig.model === 'none' || !aiConfig.apiKey) {
            if (!silent) {
                showStatus('⚠️ Configura AI per utilizzare l\'estrazione intelligente.', 'warning');
            }
            return false;
        }

        if (!silent) {
            showStatus('🤖 Estrazione AI in corso...', 'info', 0);
        }

        try {
            const pageData = await extractPageHTML();

            // Popola il campo pageNameInput
            if (!pageNameInput.value) {
                if (pageData.title) {
                    pageNameInput.value = sanitizeFilenameForSave(pageData.title);
                } else {
                    // Cerca il primo H1 nella pagina
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    const h1Result = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => document.querySelector('h1')?.textContent?.trim() || ''
                    });

                    if (h1Result && h1Result[0] && h1Result[0].result) {
                        pageNameInput.value = sanitizeFilenameForSave(h1Result[0].result);
                    } else {
                        pageNameInput.value = 'pagina_estratta_ai';
                    }
                }
            }

            const prompt = createFormExtractionPrompt(pageData.html, pageData.title);

            let aiResponseHtml = '';
            if (aiConfig.model.startsWith('gemini-') || aiConfig.model.startsWith('gemma-')) {
                aiResponseHtml = await callGoogleApi(aiConfig.model, prompt, aiConfig.apiKey);
            } else if (aiConfig.model.startsWith('openai-')) {
                aiResponseHtml = await callOpenAiApi(aiConfig.model.substring('openai-'.length), prompt, aiConfig.apiKey);
            }

            let cleanedHtml = aiResponseHtml.trim();
            if (cleanedHtml.startsWith('```html')) {
                cleanedHtml = cleanedHtml.replace(/^```html\s*/, '').replace(/\s*```$/, '');
            }

            currentHtmlContent = cleanedHtml;

            if (debugMode) {
                previewFrame.srcdoc = currentHtmlContent;
                copyButton.disabled = false;
                saveButton.disabled = false;
            }

            if (!silent) {
                showStatus('🎉 Analisi AI completata!', 'success');
            }

            saveSessionState();
            return true;

        } catch (error) {
            debugLog('Errore estrazione AI:', error);
            if (!silent) showStatus(`❌ Errore AI: ${error.message}`, 'error');
            return false;
        }
    }

    function sanitizeFilenameForSave(name) {
        let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();
        sanitized = sanitized.substring(0, 100);
        if (!sanitized) sanitized = 'extracted_forms';
        return sanitized;
    }

    function cleanHtmlFromTextareaFormatting(htmlString) {
        if (!htmlString) return '';
        const lines = htmlString.split('\n');
        const cleanedLines = lines.map(line => line.trimStart());
        let cleanedHtml = cleanedLines.join('\n');
        cleanedHtml = cleanedHtml.replace(/\n\s*\n/g, '\n');
        return cleanedHtml.trim();
    }

    function formatHtmlForTextarea(htmlString) {
        if (!htmlString) return '';
        try {
            let formatted = htmlString;
            formatted = formatted.replace(/<(?!(--|\/|!DOCTYPE|br|hr|input|img|meta|link|option))([a-zA-Z0-9\-_:]+)/g, '\n<$2');
            formatted = formatted.replace(/<\/(?!option)([a-zA-Z0-9\-_:]+)>/g, '\n</$1>');
            formatted = formatted.replace(/\n\s*\n+/g, '\n');
            if (formatted.startsWith('\n')) {
                formatted = formatted.substring(1);
            }
            let lines = formatted.split('\n');
            let indentLevel = 0;
            const indentSize = 2;
            const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
            const formattedLines = lines.map(line => {
                let trimmedLine = line.trim();
                if (!trimmedLine) return '';
                if (trimmedLine.startsWith('</')) {
                    if (indentLevel > 0) {
                        indentLevel--;
                    }
                }
                let indentedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine;
                if (trimmedLine.startsWith('<') && !trimmedLine.startsWith('</') && !trimmedLine.endsWith('/>')) {
                    const tagNameMatch = trimmedLine.match(/^<([a-zA-Z0-9\-_:]+)/);
                    if (tagNameMatch && !voidElements.has(tagNameMatch[1].toLowerCase()) && !trimmedLine.startsWith('<!--') && !trimmedLine.startsWith('<!DOCTYPE')) {
                        indentLevel++;
                    }
                }
                return indentedLine;
            });
            return formattedLines.join('\n').trim();
        } catch (e) {
            console.warn("HTML formatting failed", e);
            return htmlString;
        }
    }

    function extractJsonFromString(str) {
        if (!str) return null;
        const c = str.match(/```json\s*([\s\S]*?)\s*```/);
        if (c && c[1]) {
            try { return JSON.parse(c[1].trim()); }
            catch (e) { console.warn('Fail parse JSON code block', e); }
        }
        try {
            const fb = str.indexOf('[');
            const fbc = str.indexOf('{');
            let si = -1;
            if (fb !== -1 && (fbc === -1 || fb < fbc)) si = fb;
            else if (fbc !== -1) si = fbc;
            if (si !== -1) {
                const lb = str.lastIndexOf(']');
                const lbc = str.lastIndexOf('}');
                let ei = -1;
                if (lb !== -1 && (lbc === -1 || lb > lbc)) ei = lb;
                else if (lbc !== -1) ei = lbc;
                if (ei !== -1 && ei >= si) {
                    const p = str.substring(si, ei + 1);
                    try { return JSON.parse(p); }
                    catch (e) { console.warn("Fail parse substring", e); }
                }
            }
            return JSON.parse(str.trim());
        } catch (e) {
            console.error('Fail parse JSON string:', e);
            return null;
        }
    }

    function createFormExtractionPrompt(htmlSource, pageTitle) {
        return `
Analizza il seguente codice HTML di una pagina web e estrai tutte le form presenti, applicando la logica di inclusione/esclusione specificata. Associa ad ogni campo del form la relativa etichetta ricavandola dalla struttura del codice HTML di input oppure deducendola dal contesto. Restituisci HTML standard semplificato e formattato.

**CODICE HTML DELLA PAGINA:**
\`\`\`html
${htmlSource}
\`\`\`

**TITOLO PAGINA:** ${pageTitle || 'Pagina senza titolo'}

**ISTRUZIONI DETTAGLIATE:**

## 1. IDENTIFICAZIONE FORM
Identifica e estrai:
- **Form Standard:** Tutti gli elementi \`<form>\` e il loro contenuto
- **Form Logici:** Contenitori che funzionano come form anche senza tag \`<form>\`:
  * Elementi con \`role="form"\` o \`role="search"\`
  * Contenitori con almeno 2 campi input O 1 campo input + 1 button
  * \`<fieldset>\` con elementi interattivi
  * Sezioni con \`aria-label\` o \`aria-labelledby\` che contengono campi

## 2. ELEMENTI DA INCLUDERE
**Campi Input Validi:**
- \`<input>\` (ESCLUSI SOLO: type="submit|reset|image|button")
- \`<input type="hidden">\` **DEVE ESSERE INCLUSO** (ignora attributo hidden)
- \`<textarea>\`
- \`<select>\` e \`<option>\`
- \`<fieldset>\` e \`<legend>\`
- Elementi con ruoli: \`textbox\`, \`combobox\`, \`listbox\`, \`checkbox\`, \`radio\`, \`switch\`, \`slider\`

**Visibilità:**
- **INCLUDI elementi nascosti** (hidden, display:none, visibility:hidden)
- **INCLUDI sezioni collassate** o non visibili
- **IGNORA SOLO stato visivo**, estrai tutto il contenuto semantico

## 3. ELEMENTI DA ESCLUDERE
**Controlli Esclusi:**
- Tutti i \`<button>\` (qualsiasi tipo)
- \`<input type="button|submit|reset|image">\`
- **\`<input readonly>\` e \`<textarea readonly>\`** - ESCLUDI SEMPRE
- Elementi \`disabled\`
- Elementi con ruoli: \`button\`, \`spinbutton\`, \`searchbox\`

**Elementi Non Rilevanti:**
- \`<script>\`, \`<style>\`, \`<head>\`, \`<meta>\`, \`<link>\`
- Navigazione: \`<nav>\`, \`<header>\`, \`<footer>\`

## 4. ASSOCIAZIONE ETICHETTE (PRIORITA' GERARCHICA)
Per ogni campo input, cerca l'etichetta con questa priorità:

### Livello 1 - Associazione Diretta:
\`\`\`html
<label for="campo1">Nome</label>
<input id="campo1" type="text">
\`\`\`

### Livello 2 - ARIA Labelledby:
\`\`\`html
<div id="etichetta">Email</div>
<input aria-labelledby="etichetta" type="email">
\`\`\`

### Livello 3 - ARIA Label:
\`\`\`html
<input aria-label="Telefono" type="tel">
\`\`\`

### Livello 4 - Componente Wrapper:
\`\`\`html
<p-calendar aria-label="Data">
  <input id="data" type="tel">
</p-calendar>
\`\`\`
Pattern: \`p-\`, \`app-\`, \`sdk-\`, \`mat-\`, \`ion-\`, \`ng-\`, \`v-\`, \`react-\`

### Livello 5 - Label Wrappante:
\`\`\`html
<label>Nome <input type="text"></label>
\`\`\`

Se non trovi l'etichetta in nessuno di modi sopra indicati cerca di dedurla dal contesto.

## 5. ESTRAZIONE TESTO ETICHETTE
- **Rimuovi elementi interattivi** annidati (input, button, select)
- **Ignora commenti HTML/Angular** (\`<!---->)\`
- **Usa fallback al title** se il testo non è disponibile
- **Normalizza**: rimuovi spazi eccessivi e caratteri finali (\`:\`, \`-\`)

## 6. ATTRIBUTI ESSENZIALI DA PRESERVARE
- Identificatori: \`id\`, \`name\`
- Tipi e valori: \`type\`, \`value\`, \`placeholder\`
- Stato: \`required\`, \`checked\`, \`selected\` (NON readonly, NON disabled)
- Associazioni: \`for\`, \`aria-label\`, \`aria-labelledby\`
- Vincoli: \`min\`, \`max\`, \`step\`, \`pattern\`, \`multiple\`
- Accessibilità: \`title\`, \`role\`

## 7. FORMAT OUTPUT HTML RICHIESTO
Restituisci HTML standard semplificato seguendo questo formato:

\`\`\`html
<h3>Nome Form 1 (Semplificato)</h3>
<form id="form-id-se-presente" action="action-se-presente" method="method-se-presente">
  <label for="campo1">Etichetta Campo 1</label>
  <input type="text" id="campo1" name="name-se-presente" placeholder="placeholder-se-presente" required>
  
  <label for="campo2">Etichetta Campo 2</label>
  <input type="email" id="campo2" name="email" title="title-se-presente">
  
  <fieldset>
    <legend>Sezione Dati</legend>
    <label for="campo3">Campo Nascosto</label>
    <input type="hidden" id="campo3" name="hidden_field" value="valore">
    
    <label for="campo4">Selezione</label>
    <select id="campo4" name="country">
      <option value="IT">Italia</option>
      <option value="FR">Francia</option>
    </select>
  </fieldset>
  
  <label for="campo5">Commenti</label>
  <textarea id="campo5" name="comments" placeholder="Inserisci commenti"></textarea>
</form>

<hr style="margin: 20px 0; border: 1px dashed #ccc;">

<h3>Nome Form 2 (Logico)</h3>
<form data-logical-form="true" id="form-log-generato">
  <!-- Altri campi estratti -->
</form>
\`\`\`

## 8. REGOLE DI FORMATTAZIONE HTML
- **Struttura Pulita:** Indentazione corretta con 2 spazi
- **Un elemento per riga:** Ogni tag su riga separata
- **Label prima del campo:** Sempre \`<label>\` seguito dal relativo \`<input>\` (o viceversa se la label wrappa)
- **Separatori form:** \`<hr>\` tra form diverse
- **Titoli descrittivi:** \`<h3>Nome Form (Tipo)</h3>\` per ogni form
- **Attributi ordinati:** id, name, type, value, placeholder, altri attributi
- **Chiusura corretta:** Tutti i tag correttamente chiusi

## 9. GESTIONE CASI SPECIALI
- **Form senza ID:** Genera ID univoco \`form-std-random\` o \`form-log-random\`
- **Campi senza etichetta:** Crea \`<label>\` basata su placeholder, name, o title se possibile
- **Elementi duplicati:** Mantieni tutti, non filtrare duplicati
- **Nesting complesso:** Semplifica struttura preservando semantica
- **Framework components:** Estrai l'input interno, associa etichetta del componente

## 10. REGOLE AGGIUNTIVE
- **Non inventare ID per i campi**: usa solo ID realmente presenti nell'HTML
- **Mantieni tipi originali**: mai trasformare input in select o viceversa
- **Preserva associazioni**: mantieni tutti gli attributi \`for\` delle label
- **Gestisci framework**: riconosci componenti Angular/React/Vue
- **Priorità contenuto**: concentrati su form di compilazione dati significativi
- **Ignora visibilità CSS**: estrai anche da \`display:none\`, \`visibility:hidden\`
- **Escludi readonly e disabled**: mai includere campi readonly o disabled per modifica

**IMPORTANTE:** Analizza l'HTML fornito e restituisci SOLO il codice HTML semplificato e formattato, senza commenti aggiuntivi, spiegazioni o wrapper markdown. Inizia direttamente con \`<h3>\` del primo form trovato.
`;
    }

    function createJsonMappingPrompt(htmlForm, inputJsonString) {
        let cleanedJsonString = inputJsonString;
        try {
            const parsed = JSON.parse(inputJsonString);
            cleanedJsonString = JSON.stringify(parsed, null, 2);
        } catch (e) { /* Ignora errore parsing */ }
        return `
Analizza il seguente form HTML semplificato e i dati JSON forniti.
Il tuo obiettivo è mappare semanticamente i dati JSON ai campi del form HTML.
**Form HTML Semplificato:**
\`\`\`html
${htmlForm}
\`\`\`
**Dati JSON da Mappare:**
\`\`\`json
${cleanedJsonString}
\`\`\`
**Istruzioni Dettagliate:**
1.  **Identifica i Campi del Form:** Per ogni campo interattivo (\`<input>\`, \`<textarea>\`, \`<select>\`), identifica l'\`id\`. Usa il contesto (\`<label for="...">\`, testo vicino, \`name\`, \`placeholder\`, \`title\`, tabella) per capire il significato semantico dell' \`id\`.
2.  **Interpreta i Dati JSON:** Ogni oggetto JSON ha una chiave (descrittiva o tecnica) e un valore (\`valore_dato\` o simile). Capisci a quale campo HTML quel valore dovrebbe andare, basandoti sul significato della chiave/descrizione JSON e sul significato semantico del campo HTML.
3.  **Effettua il Mapping:** Associa ogni oggetto JSON al campo HTML corrispondente (identificato dal suo \`id\`).
4.  **Formato Output RICHIESTO (JSON Array):** Restituisci ESCLUSIVAMENTE un array JSON valido con oggetti. Ogni oggetto DEVE avere ESATTAMENTE due chiavi:
    *   \`"id"\`: La stringa dell'attributo \`id\` del campo HTML. Usa SOLO gli \`id\` presenti nel form. Non inventare \`id\`.
    *   \`"valore"\`: Il valore originale dal campo \`valore_dato\` (o simile) del JSON input. Per checkbox/radio con \`true\`/\`false\`, mappa a "OK" (true) e "KO" (false), o usa il valore letterale se appropriato (es. per radio che matchano il \`value\`). Per altri tipi (text, textarea, select), usa il valore JSON così com'è.
5.  **Precisione:** Includi solo i mapping ragionevolmente sicuri. Ometti mapping ambigui.
6.  **Output Pulito:** SOLO l'array JSON, senza commenti, spiegazioni o wrapper markdown (come \`\`\`json ... \`\`\`).
**Esempio di Output Atteso:**
\`\`\`json
[ { "id": "id_campo_nome", "valore": "ValoreNomeDalJSON" }, { "id": "id_checkbox_termini", "valore": "OK" }, { "id": "id_select_paese", "valore": "IT" } ]
\`\`\`
Genera ora l'array JSON di mapping.`;
    }

    function createTextToFormMappingPrompt(htmlForm, unstructuredText) {
        return `
Analizza il seguente form HTML semplificato e il testo libero fornito.
Il tuo obiettivo è estrarre informazioni rilevanti dal testo e mapparle semanticamente ai campi del form HTML.

**Form HTML Semplificato:**
\`\`\`html
${htmlForm}
\`\`\`

**Testo Libero da Cui Estrarre i Dati:**
\`\`\`text
${unstructuredText}
\`\`\`

**Istruzioni Dettagliate:**

1.  **Identifica i Campi del Form:**
    *   Per ogni campo interattivo (\`<input>\`, \`<textarea>\`, \`<select>\`) nel Form HTML, identifica il suo attributo \`id\`.
    *   Utilizza il contesto del Form HTML (etichette \`<label for="...">\`, testo circostante, attributi \`name\`, \`placeholder\`, \`title\`) per comprendere il significato semantico di ciascun campo e del suo \`id\`.

2.  **Analizza il Testo Libero:**
    *   Leggi attentamente il "Testo Libero".
    *   Identifica entità, valori, e frammenti di testo che potrebbero corrispondere ai campi del form. Considera sinonimi, variazioni e contesto.
    *   Esempio: Se il form ha un campo "Nome Cognome" e il testo dice "Il cliente è Mario Rossi", dovrai estrarre "Mario Rossi".

3.  **Effettua il Mapping Semantico:**
    *   Associa i valori estratti dal "Testo Libero" ai campi del "Form HTML Semplificato" (identificati dal loro \`id\`).
    *   La mappatura deve essere basata sul significato. Ad esempio, un numero di telefono nel testo dovrebbe essere mappato a un campo etichettato come "Telefono" o "Numero di Contatto" nel form.
    *   Se un'informazione nel testo può riempire più campi (es. un indirizzo completo vs. campi separati per via, città, CAP), cerca di essere il più specifico possibile o, se il form lo richiede, componi il valore (es. "Via Roma 1, 12345 Città").

4.  **Gestione di Dati Mancanti o Ambigui:**
    *   Se un'informazione per un campo del form non è presente nel testo, ometti quel campo dal mapping.
    *   Se un'informazione è ambigua, cerca di fare la scelta più probabile o ometti il mapping se troppo incerto.

5.  **Formato Output RICHIESTO (JSON Array):**
    *   Restituisci ESCLUSIVAMENTE un array JSON valido contenente oggetti.
    *   Ogni oggetto NELL'ARRAY DEVE avere ESATTAMENTE due chiavi:
        *   \`"id"\`: La stringa dell'attributo \`id\` del campo HTML a cui mappare il valore. Usa SOLO gli \`id\` effettivamente presenti nel Form HTML fornito. Non inventare \`id\`.
        *   \`"valore"\`: Il valore estratto dal "Testo Libero" che corrisponde semanticamente a quel campo.
            *   Per campi di testo, textarea, select: il valore testuale estratto.
            *   Per checkbox/radio: se il testo implica un'attivazione (es., "confermo i termini", "sì"), usa "OK" (o il valore specifico del radio button se presente ed estraibile). Se implica una disattivazione (es. "non accetto"), usa "KO". Se il testo non è chiaro, ometti.

6.  **Precisione e Completezza:**
    *   Sforzati di mappare quanti più campi possibili, ma privilegia la correttezza rispetto alla completezza.
    *   Non includere mapping di cui non sei ragionevolmente sicuro.

7.  **Output Pulito:**
    *   Restituisci SOLO l'array JSON. Non includere commenti, spiegazioni, o testo narrativo aggiuntivo al di fuori dell'array JSON. Non usare wrapper markdown (come \`\`\`json ... \`\`\`).

**Esempio di Output Atteso (basato su ipotetico form e testo):**
\`\`\`json
[
  { "id": "user_name", "valore": "Mario Rossi" },
  { "id": "user_email", "valore": "mario.rossi@example.com" },
  { "id": "accept_terms_checkbox", "valore": "OK" },
  { "id": "country_select", "valore": "Italia" }
]
\`\`\`

Analizza ora il Form HTML e il Testo Libero forniti e genera l'array JSON di mapping come specificato.`;
    }


    async function assignValuesToPage(jsonData) {
        if (!Array.isArray(jsonData)) {
            showStatus('Errore interno: Dati per assegnazione non validi (non è un array).', 'error');
            return;
        }
        if (jsonData.length === 0) {
            showStatus('Nessun dato valido da assegnare.', 'info');
            return;
        }
        if (!jsonData.every(item =>
            typeof item === 'object' && item !== null &&
            'id' in item && typeof item.id === 'string' && item.id.trim() !== '' &&
            'valore' in item
        )) {
            showStatus('Errore: Formato JSON finale per assegnazione non valido. Richiesto array di oggetti con chiavi "id" (stringa non vuota) e "valore".', 'error', 7000);
            return;
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            showStatus('Scheda attiva non trovata per l\'assegnazione.', 'error');
            return;
        }
        showStatus('⚡ Assegnazione valori in corso nella pagina...', 'info', 0);
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (dataToAssign) => {
                    if (typeof window.assignFormValuesInPage === 'function') {
                        return window.assignFormValuesInPage(dataToAssign);
                    } else {
                        console.error("Content script function 'assignFormValuesInPage' not found.");
                        return { assignmentsCount: 0, notFoundCount: dataToAssign.length, errorMessages: ["Funzione 'assignFormValuesInPage' non trovata nel content script."] };
                    }
                },
                args: [jsonData]
            });
            if (results && results[0] && results[0].result) {
                const { assignmentsCount, notFoundCount, errorMessages } = results[0].result;
                let statusMsg = `✅ Assegnazione completata. Campi compilati: ${assignmentsCount}. Non trovati/Errori: ${notFoundCount}.`;
                let statusType = 'info';
                if (assignmentsCount > 0 && notFoundCount === 0) statusType = 'success';
                else if (assignmentsCount > 0 && notFoundCount > 0) { statusType = 'warning'; statusMsg += " Alcuni campi non trovati o con errori."; }
                else if (assignmentsCount === 0 && notFoundCount > 0) { statusType = 'error'; statusMsg = `❌ Assegnazione fallita. Nessun campo trovato o compilato. Errori/Non Trovati: ${notFoundCount}.`; }
                if (errorMessages && errorMessages.length > 0) debugLog("Dettagli assegnazione (errori/non trovati):", errorMessages);
                showStatus(statusMsg, statusType, 7000);
            } else {
                console.error("Risultato inatteso dall'assegnazione:", results);
                showStatus('❌ Risultato inatteso durante l\'assegnazione dei valori.', 'error');
            }
        } catch (error) {
            console.error('Errore durante l\'iniezione dello script di assegnazione:', error);
            showStatus(`❌ Errore script assegnazione: ${error.message}`, 'error');
        }
    }

    async function extractPageHTML() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            throw new Error('Scheda attiva non trovata.');
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return {
                        html: document.documentElement.outerHTML,
                        title: document.title
                    };
                }
            });

            if (results && results[0] && results[0].result) {
                return results[0].result;
            } else {
                throw new Error('Impossibile estrarre HTML dalla pagina.');
            }
        } catch (error) {
            throw new Error(`Errore nell'estrazione HTML: ${error.message}`);
        }
    }

    function preprocessJsonForDirectAssignment(parsedJsonInput) {
        const extractedPairs = [];
        if (Array.isArray(parsedJsonInput) && parsedJsonInput.every(item =>
            typeof item === 'object' && item !== null &&
            'id' in item && typeof item.id === 'string' &&
            'valore' in item
        )) {
            return parsedJsonInput.map(item => ({ id: item.id, valore: item.valore }));
        }
        const commonInnerArrayKeys = ['campi', 'fields', 'items', 'data', 'elements', 'values'];
        if (Array.isArray(parsedJsonInput)) {
            parsedJsonInput.forEach(section => {
                if (typeof section === 'object' && section !== null) {
                    for (const key of commonInnerArrayKeys) {
                        if (key in section && Array.isArray(section[key])) {
                            section[key].forEach(field => {
                                if (typeof field === 'object' && field !== null &&
                                    'id' in field && typeof field.id === 'string' && field.id.trim() !== '' &&
                                    'valore' in field) {
                                    extractedPairs.push({ id: field.id, valore: field.valore });
                                }
                            });
                        }
                    }
                }
            });
        } else if (typeof parsedJsonInput === 'object' && parsedJsonInput !== null) {
            for (const key of commonInnerArrayKeys) {
                if (key in parsedJsonInput && Array.isArray(parsedJsonInput[key])) {
                    parsedJsonInput[key].forEach(field => {
                        if (typeof field === 'object' && field !== null &&
                            'id' in field && typeof field.id === 'string' && field.id.trim() !== '' &&
                            'valore' in field) {
                            extractedPairs.push({ id: field.id, valore: field.valore });
                        }
                    });
                }
            }
        }
        return extractedPairs;
    }

    async function callGoogleApi(modelName, prompt, apiKey) {
        const endpointHost = "generativelanguage.googleapis.com";
        const apiVersion = "v1beta";
        const API_URL = `https://${endpointHost}/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
        };
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorJson = null;
            try { errorJson = JSON.parse(errorText); } catch (e) { /* ignore */ }
            const errorMessage = errorJson?.error?.message || errorText || response.statusText;
            throw new Error(`Errore API Google (${modelName}): ${response.status}. Dettagli: ${errorMessage}`);
        }
        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else if (data.candidates && data.candidates[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') {
            const reason = data.candidates[0].finishReason;
            let safetyRatingsInfo = data.candidates[0].safetyRatings ? " SafetyRatings: " + JSON.stringify(data.candidates[0].safetyRatings) : "";
            throw new Error(`Generazione Google (${modelName}) interrotta: ${reason}.${safetyRatingsInfo}`);
        } else {
            throw new Error(`Struttura risposta API Google (${modelName}) non valida o contenuto mancante.`);
        }
    }

    async function callOpenAiApi(modelName, prompt, apiKey) {
        const API_URL = 'https://api.openai.com/v1/chat/completions';
        const requestBody = {
            model: modelName,
            messages: [
                { role: "system", content: "Sei un assistente AI specializzato nell'analisi di form HTML, dati JSON e testo libero per creare mapping semantici. Rispondi SOLO con l'array JSON richiesto, senza testo aggiuntivo e senza wrapper markdown." },
                { role: "user", content: prompt }
            ],
        };
        if (modelName.includes("gpt-4") || modelName.includes("1106") || modelName.includes("0125") || modelName.includes("gpt-4o")) {
            requestBody.response_format = { type: "json_object" };
        }
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) });
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Errore API OpenAI (${modelName}): ${response.status} ${response.statusText}. Dettagli: ${errorBody.error?.message || JSON.stringify(errorBody)}`);
        }
        const data = await response.json();
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content;
        } else {
            throw new Error(`Struttura risposta API OpenAI (${modelName}) non valida.`);
        }
    }

    async function saveSessionState() {
        const currentState = {
            pageName: pageNameInput.value,
            htmlContent: currentHtmlContent,
            viewMode: document.querySelector('input[name="viewMode"]:checked')?.value || 'preview',
            
            dataInputUnifiedValue: dataInputUnified.value, // Unified textarea
            
            aiOutputData: aiOutputTextarea.value,
            isAiOutputVisible: !aiOutputContainer.classList.contains('hidden'),

            aiConfigOpen: aiConfigContent?.classList.contains('open'),
            extractionContentCollapsed: extractionContent?.classList.contains('collapsed'), // Collapsible state
            fillingContentCollapsed: fillingContent?.classList.contains('collapsed') // Collapsible state
        };
        try {
            await chrome.storage.session.set({ [SESSION_STATE_KEY]: currentState });
        } catch (error) {
            console.error("Error saving session state:", error);
        }
    }

    async function loadSessionState() {
        try {
            const result = await chrome.storage.session.get(SESSION_STATE_KEY);
            const savedState = result[SESSION_STATE_KEY];

            extractFormsWithAiButton.disabled = false;
            mapWithAiButton.disabled = false;

            if (savedState) {
                pageNameInput.value = savedState.pageName || '';
                currentHtmlContent = savedState.htmlContent || null;

                dataInputUnified.value = savedState.dataInputUnifiedValue || ''; // Unified textarea

                if (debugMode) {
                    aiOutputTextarea.value = savedState.aiOutputData || '';

                    if (currentHtmlContent) {
                        previewFrame.srcdoc = currentHtmlContent;
                        htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent);
                        copyButton.disabled = false;
                        saveButton.disabled = false;
                    } else {
                        previewFrame.srcdoc = '';
                        htmlSourceTextarea.value = '';
                        copyButton.disabled = true;
                        saveButton.disabled = true;
                    }

                    const savedViewMode = savedState.viewMode || 'preview';
                    document.querySelector(`input[name="viewMode"][value="${savedViewMode}"]`).checked = true;
                    previewFrame.classList.toggle('hidden', savedViewMode === 'source');
                    htmlSourceTextarea.classList.toggle('hidden', savedViewMode === 'preview');
                    applySourceChangesButton.classList.toggle('hidden', savedViewMode === 'preview');

                    const isAiVisible = savedState.isAiOutputVisible || false;
                    aiOutputContainer.classList.toggle('hidden', !isAiVisible);
                    applyAiMappingButton.disabled = !isAiVisible || !aiOutputTextarea.value;
                    resetAiMappingButton.disabled = !isAiVisible;
                }

                // Collapsible sections state
                aiConfigContent?.classList.toggle('open', !!savedState.aiConfigOpen);

                // Default to collapsed for sections, then apply saved state
                // In production mode, filling section should be open if no saved state
                const defaultExtractionCollapsed = true; // Default to collapsed for extraction
                const defaultFillingCollapsed = false; // Default to open for filling

                if (!debugMode) {
                    // In production mode, always start with extraction collapsed and filling open
                    extractionContent.classList.add('collapsed');
                    extractionHeader.classList.add('collapsed');
                    fillingContent.classList.remove('collapsed');
                    fillingHeader.classList.remove('collapsed');
                } else {
                    extractionContent.classList.toggle('collapsed', savedState.extractionContentCollapsed ?? defaultExtractionCollapsed);
                    extractionHeader.classList.toggle('collapsed', savedState.extractionContentCollapsed ?? defaultExtractionCollapsed);
                    fillingContent.classList.toggle('collapsed', savedState.fillingContentCollapsed ?? defaultFillingCollapsed);
                    fillingHeader.classList.toggle('collapsed', savedState.fillingContentCollapsed ?? defaultFillingCollapsed);
                }
                
                // Ensure the "Applica Modifiche al Codice" button visibility is correct based on viewMode
                applySourceChangesButton.classList.toggle('hidden', document.querySelector('input[name="viewMode"]:checked')?.value === 'preview');

                showStatus('🔄 Stato sessione precedente ripristinato.', 'info', 3000);
            } else {
                if (debugMode) {
                    copyButton.disabled = true;
                    saveButton.disabled = true;
                    applyAiMappingButton.disabled = true;
                    resetAiMappingButton.disabled = true;
                    aiOutputContainer.classList.add('hidden');
                    // Default for debug mode: extraction open, filling collapsed
                    extractionContent.classList.remove('collapsed');
                    extractionHeader.classList.remove('collapsed');
                    fillingContent.classList.add('collapsed');
                    fillingHeader.classList.add('collapsed');
                } else {
                    // Default for production mode: extraction collapsed, filling open
                    extractionContent.classList.add('collapsed');
                    extractionHeader.classList.add('collapsed');
                    fillingContent.classList.remove('collapsed');
                    fillingHeader.classList.remove('collapsed');
                }
                aiConfigContent?.classList.remove('open');
            }
        } catch (error) {
            console.error("Error loading session state:", error);
            showStatus('❌ Errore nel caricamento dello stato della sessione.', 'error');
            // Fallback to default initial state on error
            extractionContent.classList.add('collapsed');
            extractionHeader.classList.add('collapsed');
            fillingContent.classList.remove('collapsed');
            fillingHeader.classList.remove('collapsed');
            aiConfigContent?.classList.remove('open');
        }
    }


    function setupCollapsibles() {
        // Gestione del link di configurazione AI
        configToggle.addEventListener('click', (e) => {
            e.preventDefault();
            aiConfigContent.classList.toggle('open');
            saveSessionState();
        });

        // Section collapsibles
        const toggleSection = (header, content) => {
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
            saveSessionState();
        };

        extractionHeader.addEventListener('click', () => toggleSection(extractionHeader, extractionContent));
        fillingHeader.addEventListener('click', () => toggleSection(fillingHeader, fillingContent));
    }

    async function loadAiConfig() {
        try {
            const result = await chrome.storage.local.get(AI_CONFIG_KEY);
            if (result[AI_CONFIG_KEY]) {
                aiConfig = result[AI_CONFIG_KEY];
                llmModelSelect.value = Array.from(llmModelSelect.options).some(opt => opt.value === aiConfig.model) ? aiConfig.model : 'none';
                if (llmModelSelect.value === 'none') aiConfig.model = 'none';
                apiKeyInput.value = aiConfig.apiKey || '';
            }
        } catch (error) {
            console.error('Errore caricamento configurazione AI:', error);
        }
    }

    saveAiConfigButton.addEventListener('click', async () => {
        const selectedModel = llmModelSelect.value;
        const enteredApiKey = apiKeyInput.value.trim();
        if (selectedModel !== 'none' && !enteredApiKey) {
            showStatus('⚠️ Inserisci la chiave API per il modello selezionato.', 'warning');
            apiKeyInput.focus();
            return;
        }
        aiConfig = { model: selectedModel, apiKey: enteredApiKey };
        try {
            await chrome.storage.local.set({ [AI_CONFIG_KEY]: aiConfig });
            showStatus('✅ Configurazione AI salvata!', 'success');
            if (aiConfig.model !== 'none' && aiConfig.apiKey) {
                showStatus('🤖 AI configurata! Ora puoi usare le funzionalità potenziate.', 'success', 4000);
            } else if (aiConfig.model === 'none') {
                showStatus('ℹ️ Configurazione AI disabilitata/resettata.', 'info', 4000);
            }
            // Chiudi la sezione di configurazione
            aiConfigContent.classList.remove('open');
            saveSessionState();
        } catch (error) {
            showStatus(`❌ Errore salvataggio config AI: ${error.message}`, 'error');
        }
    });

    pageNameInput.addEventListener('input', saveSessionState); // Existing
    dataInputUnified.addEventListener('input', saveSessionState); // Listen to the unified textarea

    if (debugMode) {
        viewModeRadios.forEach(radio => {
            radio.addEventListener('change', function () {
                applySourceChangesButton.classList.toggle('hidden', this.value === 'preview');
                previewFrame.classList.toggle('hidden', this.value === 'source');
                htmlSourceTextarea.classList.toggle('hidden', this.value === 'preview');
                if (this.value === 'preview') previewFrame.srcdoc = currentHtmlContent || '';
                else htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent || '');
                saveSessionState();
            });
        });

        applySourceChangesButton.addEventListener('click', () => {
            currentHtmlContent = cleanHtmlFromTextareaFormatting(htmlSourceTextarea.value);
            previewFrame.srcdoc = currentHtmlContent;
            htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent);
            showStatus('✅ Modifiche codice sorgente applicate.', 'success');
            saveSessionState();
        });
    }

    extractFormsButton.addEventListener('click', async () => {
        await performAlgorithmicExtraction(false);
    });

    extractFormsWithAiButton.addEventListener('click', async () => {
        if (aiConfig.model === 'none' || !aiConfig.apiKey) {
            showStatus('⚠️ Configura AI (modello e API Key).', 'warning', 7000);
            aiConfigContent?.classList.add('open');
            saveSessionState();
            // Scroll to AI config section if it's debug mode
            if (debugMode) { aiConfigContent?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
            return;
        }

        extractFormsWithAiButton.disabled = true;
        try {
            await performAiExtraction(false);
        } finally {
            extractFormsWithAiButton.disabled = false;
        }
    });

    function handleLoadFile(event, targetTextarea, acceptedExtension, mimeType, statusPrefix) {
        const file = event.target.files[0];
        if (!file) return;

        // Corrected file type validation: check if it ends with the extension OR has the correct MIME type
        if (!(file.name.toLowerCase().endsWith(acceptedExtension) || file.type === mimeType)) {
            showStatus(`❌ Seleziona un file ${acceptedExtension} valido.`, 'error');
            targetTextarea.value = '';
            event.target.value = null; // Clear the input so same file can be selected again
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                if (acceptedExtension === '.json') { // Validate JSON format
                    JSON.parse(content); // This will throw if content is not valid JSON
                }
                targetTextarea.value = content;
                showStatus(`📁 File "${file.name}" caricato per ${statusPrefix}.`, 'success');
                if (debugMode) {
                    aiOutputTextarea.value = '';
                    aiOutputContainer.classList.add('hidden');
                    applyAiMappingButton.disabled = true;
                    resetAiMappingButton.disabled = true;
                }
                saveSessionState();
            } catch (jsonError) {
                showStatus(`❌ File "${file.name}" non è JSON valido: ${jsonError.message}`, 'error', 7000);
                targetTextarea.value = '';
            }
        };
        reader.onerror = () => {
            showStatus(`❌ Errore lettura file "${file.name}".`, 'error');
            targetTextarea.value = '';
        };
        reader.readAsText(file);
        event.target.value = null;
    }

    loadJsonDataButton.addEventListener('click', () => { jsonDataFileInput.click(); });
    jsonDataFileInput.addEventListener('change', (event) => { handleLoadFile(event, dataInputUnified, '.json', 'application/json', 'JSON Input'); });

    loadTextDataButton.addEventListener('click', () => { textDataFileInput.click(); });
    textDataFileInput.addEventListener('change', (event) => {
        handleLoadFile(event, dataInputUnified, '.txt', 'text/plain', 'Text Input');
    });

    mapWithAiButton.addEventListener('click', async () => {
        if (aiConfig.model === 'none' || !aiConfig.apiKey) {
            showStatus('⚠️ Configura AI (modello e API Key).', 'warning', 7000);
            aiConfigContent?.classList.add('open');
            saveSessionState();
            return;
        }

        // In production mode, automatically extract if needed
        if (!debugMode) {
            const extractionSuccess = await ensureFormExtracted();
            if (!extractionSuccess) {
                return;
            }
        }

        if (!currentHtmlContent || currentHtmlContent.trim() === '') {
            showStatus('⚠️ Estrai prima un form HTML.', 'warning');
            if (debugMode) {
                // Expand extraction section and scroll to it
                extractionHeader?.classList.remove('collapsed');
                extractionContent?.classList.remove('collapsed');
                extractionSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
        }

        let inputDataString = dataInputUnified.value.trim();
        let promptFunction;
        let inputTypeForStatus = '';

        if (!inputDataString) {
            showStatus('⚠️ Inserisci dati JSON o testo per il mapping.', 'warning');
            return;
        }

        let parsedAsJson = null;
        let isJsonInput = false;
        try {
            parsedAsJson = JSON.parse(inputDataString);
            // Check if it's an array for mapping, or just a simple object that could be data
            if (Array.isArray(parsedAsJson) && parsedAsJson.every(item => typeof item === 'object' && item !== null && ('descrizione' in item || 'valore_dato' in item || 'id' in item))) {
                isJsonInput = true;
            } else if (typeof parsedAsJson === 'object' && parsedAsJson !== null) {
                // If it's a single object, assume it's meant as a JSON input for AI
                isJsonInput = true;
            }
        } catch (e) {
            // Not valid JSON, or not in the expected JSON mapping format for AI
            isJsonInput = false;
        }

        if (isJsonInput) {
            promptFunction = createJsonMappingPrompt;
            inputTypeForStatus = 'JSON';
            if (debugMode) {
                aiOutputTitle.textContent = "🎯 Mapping Dati (da JSON) Suggerito dall'AI";
                aiOutputInfo.textContent = "L'AI ha analizzato i tuoi dati JSON e i campi del form per creare il mapping ottimale.";
            }
        } else { // If not JSON, and not empty, treat as text
            promptFunction = createTextToFormMappingPrompt;
            inputTypeForStatus = 'Testo';
            if (debugMode) {
                aiOutputTitle.textContent = "🎯 Mapping Dati (da Testo) Suggerito dall'AI";
                aiOutputInfo.textContent = "L'AI ha analizzato il testo fornito e i campi del form per estrarre valori e creare il mapping.";
            }
        }

        showStatus(`🤖 Invio dati (${inputTypeForStatus}) a ${aiConfig.model} per mapping...`, 'info', 0);

        if (!debugMode) {
            setLoading(true, 'Elaborazione intelligente dei dati...');
        }

        if (debugMode) {
            aiOutputTextarea.value = '';
            aiOutputContainer.classList.add('hidden');
            applyAiMappingButton.disabled = true;
            resetAiMappingButton.disabled = true;
        }

        mapWithAiButton.disabled = true;
        let llmResponseString = '';

        try {
            const prompt = promptFunction(currentHtmlContent, inputDataString);
            if (aiConfig.model.startsWith('gemini-') || aiConfig.model.startsWith('gemma-')) {
                llmResponseString = await callGoogleApi(aiConfig.model, prompt, aiConfig.apiKey);
            } else if (aiConfig.model.startsWith('openai-')) {
                llmResponseString = await callOpenAiApi(aiConfig.model.substring('openai-'.length), prompt, aiConfig.apiKey);
            } else {
                throw new Error('Modello AI non supportato.');
            }

            const suggestedMappingJson = extractJsonFromString(llmResponseString);
            if (!suggestedMappingJson) {
                throw new Error(`L'AI (${aiConfig.model}) non ha restituito JSON valido. Risposta: ${llmResponseString}`);
            }
            if (!Array.isArray(suggestedMappingJson)) {
                throw new Error(`Output AI (${aiConfig.model}) non è array JSON. Output: ${JSON.stringify(suggestedMappingJson)}`);
            }
            if (!suggestedMappingJson.every(item =>
                typeof item === 'object' && item !== null &&
                'id' in item && typeof item.id === 'string' && 'valore' in item
            )) {
                throw new Error(`Oggetti JSON AI (${aiConfig.model}) non format {id: string, valore: any}. Output: ${JSON.stringify(suggestedMappingJson)}`);
            }

            if (debugMode) {
                aiOutputTextarea.value = JSON.stringify(suggestedMappingJson, null, 2);
                aiOutputContainer.classList.remove('hidden');
                applyAiMappingButton.disabled = false;
                resetAiMappingButton.disabled = false;
                showStatus(`🎯 Mapping da ${aiConfig.model} (da ${inputTypeForStatus}) completato.`, 'success');
                aiOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                // In modalità produzione, applica direttamente il mapping
                setLoading(false);
                await assignValuesToPage(suggestedMappingJson);
            }
        } catch (error) {
            showStatus(`❌ Errore Mapping AI (${aiConfig.model} da ${inputTypeForStatus}): ${error.message}`, 'error', 10000);
            if (debugMode) {
                aiOutputTextarea.value = `Errore: ${error.message}\n\nRisposta:\n${llmResponseString || 'Nessuna risposta.'}`;
                aiOutputContainer.classList.remove('hidden');
            }
        } finally {
            mapWithAiButton.disabled = false;
            if (!debugMode) {
                setLoading(false);
            }
            saveSessionState();
        }
    });

    assignDirectJsonValuesButton.addEventListener('click', async () => {
        // In production mode, automatically extract if needed
        if (!debugMode) {
            const extractionSuccess = await ensureFormExtracted();
            if (!extractionSuccess) {
                return;
            }
        }

        const jsonDataString = dataInputUnified.value.trim(); // Read from unified textarea
        if (!jsonDataString) {
            showStatus('⚠️ Area dati JSON Input vuota per assegnazione diretta.', 'warning');
            return;
        }

        let parsedJsonInput;
        try {
            parsedJsonInput = JSON.parse(jsonDataString);
        } catch (error) {
            showStatus(`❌ Errore parsing JSON Input: ${error.message}`, 'error', 7000);
            return;
        }

        const processedData = preprocessJsonForDirectAssignment(parsedJsonInput);
        if (processedData.length === 0) {
            showStatus('⚠️ Nessuna coppia id/valore estraibile dal JSON fornito per assegnazione diretta. Assicurati che il formato sia `[{"id": "...", "valore": "..."}]` o una struttura comune che lo contenga.', 'warning', 10000);
            return;
        }

        if (!debugMode) {
            setLoading(true, 'Compilazione automatica in corso...');
        }

        await assignValuesToPage(processedData);

        if (!debugMode) {
            setLoading(false);
        }
    });

    if (debugMode) {
        applyAiMappingButton.addEventListener('click', async () => {
            const aiJsonString = aiOutputTextarea.value.trim();
            if (!aiJsonString) {
                showStatus('⚠️ Nessun mapping JSON da AI da assegnare.', 'warning');
                return;
            }
            let parsedAiData;
            try {
                parsedAiData = JSON.parse(aiJsonString);
            } catch (error) {
                showStatus(`❌ Errore parsing JSON da AI: ${error.message}`, 'error', 7000);
                return;
            }
            await assignValuesToPage(parsedAiData);
        });

        resetAiMappingButton.addEventListener('click', () => {
            aiOutputTextarea.value = '';
            aiOutputContainer.classList.add('hidden');
            applyAiMappingButton.disabled = true;
            resetAiMappingButton.disabled = true;
            showStatus('🗑️ Mapping AI resettato.', 'info');
            saveSessionState();
        });

        copyButton.addEventListener('click', () => {
            const isSourceView = !htmlSourceTextarea.classList.contains('hidden');
            const contentToCopy = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || '');
            if (contentToCopy && !copyButton.disabled) {
                navigator.clipboard.writeText(contentToCopy)
                    .then(() => showStatus('📋 HTML copiato!', 'success'))
                    .catch(err => {
                        showStatus('❌ Errore copia HTML.', 'error');
                        try {
                            const ta = document.createElement('textarea');
                            ta.value = contentToCopy;
                            ta.style.position = 'fixed';
                            document.body.appendChild(ta);
                            ta.focus();
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                            showStatus('📋 HTML copiato (fallback)!', 'success');
                        } catch (e) {
                            showStatus('❌ Copia fallita.', 'error');
                        }
                    });
            } else {
                showStatus('ℹ️ Nessun HTML da copiare.', 'info');
            }
        });

        saveButton.addEventListener('click', () => {
            const isSourceView = !htmlSourceTextarea.classList.contains('hidden');
            const contentToSave = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || '');
            if (contentToSave && !saveButton.disabled) {
                const pageName = pageNameInput.value.trim() || 'extracted_forms';
                const filename = sanitizeFilenameForSave(pageName) + '.html';
                const fileContent = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>${pageName.replace(/</g, "&lt;").replace(/>/g, "&gt;")} - Forms</title><style>body{font-family:sans-serif;line-height:1.6;padding:20px;background:#f4f4f4}h3{color:#3498db; margin-top: 2em; margin-bottom: 0.5em;}form{background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px}label{display:block;margin-bottom:5px;font-weight:bold;}input,textarea,select{width:95%;max-width:400px;padding:8px;margin-bottom:10px;border:1px solid #ccc;border-radius:4px;box-sizing: border-box;}input[type="checkbox"], input[type="radio"] {width: auto; margin-right: 5px; vertical-align: middle;} fieldset{margin-top:1em; margin-bottom:1em; padding:1em; border:1px solid #ccc;} legend{font-weight:bold; color:#3498db; padding: 0 0.5em;} hr{margin:20px 0;border:1px dashed #ccc}</style></head><body><h2>${pageName.replace(/</g, "&lt;").replace(/>/g, "&gt;")} - Forms Estratti</h2>${contentToSave}</body></html>`;
                const blob = new Blob([fileContent], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: true
                }, (downloadId) => {
                    URL.revokeObjectURL(url);
                    if (chrome.runtime.lastError) {
                        showStatus(`❌ Errore salvataggio: ${chrome.runtime.lastError.message}`, 'error');
                    } else if (downloadId) {
                        showStatus(`💾 Download "${filename}" avviato.`, 'success');
                    } else {
                        showStatus(`⚠️ Download "${filename}" non avviato o annullato.`, 'warning', 7000);
                    }
                });
            } else {
                showStatus('ℹ️ Nessun HTML da salvare.', 'info');
            }
        });
    }

    // --- Inizializzazione ---
    async function initialize() {
        await initializeUIMode();
        setupCollapsibles();
        await loadAiConfig();
        await loadSessionState();
    }

    initialize();

}); // End DOMContentLoaded