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
    const dataFileInput = document.getElementById('dataFileInput');
    const loadDataButton = document.getElementById('loadDataButton');
    const dataInput = document.getElementById('dataInput');
    const assignValuesButton = document.getElementById('assignValuesButton'); // Bottone per JSON input
    const statusMessage = document.getElementById('statusMessage');
    const llmModelSelect = document.getElementById('llmModelSelect');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveAiConfigButton = document.getElementById('saveAiConfigButton');
    const mapWithAiButton = document.getElementById('mapWithAiButton');
    const aiOutputContainer = document.getElementById('aiOutputContainer');
    const aiOutputTextarea = document.getElementById('aiOutputTextarea');
    const assignAiValuesButton = document.getElementById('assignAiValuesButton'); // Bottone per output AI
    const aiConfigSection = document.getElementById('aiConfigSection');
    const extractionSection = document.getElementById('extractionSection');
    const fillingSection = document.getElementById('fillingSection');

    // --- Stato Interno (Defaults) ---
    let currentHtmlContent = null;
    let aiConfig = { model: 'none', apiKey: '' };
    const AI_CONFIG_KEY = 'ai_config_v2';
    const SESSION_STATE_KEY = 'popup_session_state';

    // ===========================================
    // --- Funzioni Helper (Definizioni Chiave) ---
    // ===========================================
    function showStatus(message, type = 'info', duration = 5000) {
        statusMessage.textContent = message;
        statusMessage.className = ''; // Reset classes
        statusMessage.classList.add(`status-${type}`);
        if (duration <= 0) {
            statusMessage.classList.add(`status-permanent`);
        } else {
            const permanentMessages = document.querySelectorAll('.status-permanent');
            permanentMessages.forEach(pm => { pm.textContent = ''; pm.className = ''; });
            setTimeout(() => {
                if (statusMessage.textContent === message && !statusMessage.classList.contains('status-permanent')) {
                    statusMessage.textContent = '';
                    statusMessage.className = '';
                }
            }, duration);
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


    // funzione per creare il prompt AI (dal documento allegato):
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
- Stato: \`required\`, \`checked\`, \`selected\`, \`disabled\` (NON readonly)
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
- **Label prima del campo:** Sempre \`<label>\` seguito dal relativo \`<input>\`
- **Separatori form:** \`<hr>\` tra form diverse
- **Titoli descrittivi:** \`<h3>Nome Form (Tipo)</h3>\` per ogni form
- **Attributi ordinati:** id, name, type, value, placeholder, altri attributi
- **Chiusura corretta:** Tutti i tag correttamente chiusi

## 9. GESTIONE CASI SPECIALI
- **Form senza ID:** Genera ID univoco \`form-std-random\` o \`form-log-random\`
- **Campi senza etichetta:** Crea \`<label>\` basata su placeholder, name, o title
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
- **Escludi readonly**: mai includere campi readonly o disabled per modifica

**IMPORTANTE:** Analizza l'HTML fornito e restituisci SOLO il codice HTML semplificato e formattato, senza commenti aggiuntivi, spiegazioni o wrapper markdown. Inizia direttamente con \`<h3>\` del primo form trovato.
`;
    }

    function createMappingPrompt(htmlForm, inputJsonString) {
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
6.  **Output Pulito:** SOLO l'array JSON, senza commenti, spiegazioni o markdown.
**Esempio di Output Atteso:**
\`\`\`json
[ { "id": "id_campo_nome", "valore": "ValoreNomeDalJSON" }, { "id": "id_checkbox_termini", "valore": "OK" }, { "id": "id_select_paese", "valore": "IT" } ]
\`\`\`
Genera ora l'array JSON di mapping.`;
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
        // La validazione dettagliata del formato {id, valore} è ora fatta qui,
        // dopo il preprocessing per l'input utente.
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
        showStatus('Assegnazione valori in corso nella pagina...', 'info', 0);
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (dataToAssign) => { // Questa funzione viene eseguita nel content script
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
                let statusMsg = `Assegnazione completata. Campi compilati: ${assignmentsCount}. Non trovati/Errori: ${notFoundCount}.`;
                let statusType = 'info';
                if (assignmentsCount > 0 && notFoundCount === 0) statusType = 'success';
                else if (assignmentsCount > 0 && notFoundCount > 0) { statusType = 'warning'; statusMsg += " Alcuni campi non trovati o con errori."; }
                else if (assignmentsCount === 0 && notFoundCount > 0) { statusType = 'error'; statusMsg = `Assegnazione fallita. Nessun campo trovato o compilato. Errori/Non Trovati: ${notFoundCount}.`; }
                if (errorMessages && errorMessages.length > 0) console.warn("Dettagli assegnazione (errori/non trovati):", errorMessages);
                showStatus(statusMsg, statusType, 7000);
            } else {
                console.error("Risultato inatteso dall'assegnazione:", results);
                showStatus('Risultato inatteso durante l\'assegnazione dei valori.', 'error');
            }
        } catch (error) {
            console.error('Errore durante l\'iniezione dello script di assegnazione:', error);
            showStatus(`Errore script assegnazione: ${error.message}`, 'error');
        }
    }


    // funzione per estrarre DOM HTML dalla pagina:
    async function extractPageHTML() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            throw new Error('Scheda attiva non trovata.');
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Estrai tutto il DOM della pagina
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


    // ===========================================
    // --- NUOVA FUNZIONE DI PREPROCESSING JSON ---
    // ===========================================
    function preprocessJsonForAssignment(parsedJsonInput) {
        const extractedPairs = [];

        // Scenario A: JSON è già un array piatto di {id, valore}
        if (Array.isArray(parsedJsonInput) && parsedJsonInput.every(item =>
            typeof item === 'object' && item !== null &&
            'id' in item && typeof item.id === 'string' &&
            'valore' in item
        )) {
            console.log("JSON di input già nel formato corretto (array piatto).");
            // Restituisce una nuova mappa per assicurare solo le chiavi necessarie e non modificare l'originale
            return parsedJsonInput.map(item => ({ id: item.id, valore: item.valore }));
        }

        // Scenario B: JSON è un array di oggetti "sezione", ognuno con un array "campi"
        // Cerchiamo chiavi comuni per l'array interno
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
        }

        if (extractedPairs.length > 0) {
            console.log("Coppie id/valore estratte da struttura annidata:", extractedPairs.length);
        } else if (Array.isArray(parsedJsonInput)) { // Era un array, ma non ha matchato A o B
            console.log("JSON di input è un array, ma non nel formato piatto atteso né con chiavi interne note (es. 'campi').");
        } else { // Non era un array all'inizio
            console.warn("JSON di input non è un array, preprocessing per scenari A o B non applicabile.");
        }

        return extractedPairs;
    }


    // ===========================================
    // --- API Call Functions ---
    // ===========================================
    async function callGoogleApi(modelName, prompt, apiKey) {
        const endpointHost = modelName.startsWith('gemma-') ? "generativelanguage.googleapis.com" : "generativelanguage.googleapis.com";
        const apiVersion = "v1beta";
        const API_URL = `https://${endpointHost}/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
        console.log(`Calling Google API (${modelName}):`, API_URL);
        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192 },
        };
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Google API Error Response (${modelName}):`, errorBody);
            throw new Error(`Errore API Google (${modelName}): ${response.status} ${response.statusText}. Dettagli: ${errorBody}`);
        }
        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else if (data.candidates && data.candidates[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') {
            console.error(`Google generation stopped (${modelName}):`, data.candidates[0].finishReason, data);
            throw new Error(`Generazione Google (${modelName}) interrotta: ${data.candidates[0].finishReason}`);
        } else {
            console.error(`Struttura risposta Google inattesa (${modelName}):`, data);
            throw new Error(`Struttura risposta API Google (${modelName}) non valida.`);
        }
    }

    async function callOpenAiApi(modelName, prompt, apiKey) {
        const API_URL = 'https://api.openai.com/v1/chat/completions';
        console.log("Calling OpenAI API with model:", modelName);
        const requestBody = {
            model: modelName,
            messages: [
                { role: "system", content: "Sei un assistente AI specializzato nell'analisi di form HTML e dati JSON per creare mapping semantici. Rispondi SOLO con l'array JSON richiesto, senza testo aggiuntivo." },
                { role: "user", content: prompt }
            ],
        };
        if (modelName.includes("gpt-4") || modelName.includes("1106") || modelName.includes("0125") || modelName.includes("gpt-4o")) {
            requestBody.response_format = { type: "json_object" };
            console.log("Requesting JSON object format from OpenAI");
        }
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) });
        if (!response.ok) {
            const errorBody = await response.json();
            console.error(`OpenAI API Error Response (${modelName}):`, errorBody);
            throw new Error(`Errore API OpenAI (${modelName}): ${response.status} ${response.statusText}. Dettagli: ${errorBody.error?.message || JSON.stringify(errorBody)}`);
        }
        const data = await response.json();
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content;
        } else {
            console.error(`Struttura risposta OpenAI inattesa (${modelName}):`, data);
            throw new Error(`Struttura risposta API OpenAI (${modelName}) non valida.`);
        }
    }

    // ===========================================
    // --- Session State Management ---
    // ===========================================
    async function saveSessionState() {
        const currentState = {
            pageName: pageNameInput.value,
            htmlContent: currentHtmlContent,
            viewMode: document.querySelector('input[name="viewMode"]:checked')?.value || 'preview',
            jsonData: dataInput.value,
            aiOutputData: aiOutputTextarea.value,
            isAiOutputVisible: !aiOutputContainer.classList.contains('hidden'),
            aiConfigOpen: aiConfigSection?.classList.contains('open'),
            extractionOpen: extractionSection?.classList.contains('open'),
            fillingOpen: fillingSection?.classList.contains('open')
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
            if (savedState) {
                console.log('Loading session state:', savedState);
                pageNameInput.value = savedState.pageName || '';
                currentHtmlContent = savedState.htmlContent || null;
                dataInput.value = savedState.jsonData || '';
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
                assignAiValuesButton.disabled = !isAiVisible || !aiOutputTextarea.value;
                aiConfigSection?.classList.toggle('open', !!savedState.aiConfigOpen);
                extractionSection?.classList.toggle('open', savedState.extractionOpen !== false); // Default true
                fillingSection?.classList.toggle('open', !!savedState.fillingOpen);
                showStatus('Stato sessione precedente ripristinato.', 'info', 3000);
            } else {
                console.log('No previous session state found.');
                copyButton.disabled = true;
                saveButton.disabled = true;
                assignAiValuesButton.disabled = true;
                aiOutputContainer.classList.add('hidden');
                // Default collapsible states if no session
                aiConfigSection?.classList.remove('open'); // AI config default closed (loadAiConfig might open it)
                extractionSection?.classList.add('open');   // Extraction default open
                fillingSection?.classList.remove('open'); // Filling default closed
            }
        } catch (error) {
            console.error("Error loading session state:", error);
            showStatus('Errore nel caricamento dello stato della sessione.', 'error');
            // Default collapsible states on error
            aiConfigSection?.classList.remove('open');
            extractionSection?.classList.add('open');
            fillingSection?.classList.remove('open');
        }
    }

    // ===========================================
    // --- Collapsible Section Logic ---
    // ===========================================
    function setupCollapsibles() {
        const toggles = document.querySelectorAll('.collapsible-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const section = toggle.closest('.collapsible-section');
                if (section) {
                    section.classList.toggle('open');
                    saveSessionState(); // Salva lo stato open/closed
                }
            });
        });
    }

    // ===========================================
    // --- AI Configuration Logic ---
    // ===========================================
    async function loadAiConfig() {
        try {
            const result = await chrome.storage.local.get(AI_CONFIG_KEY);
            let needsConfig = true;
            if (result[AI_CONFIG_KEY]) {
                aiConfig = result[AI_CONFIG_KEY];
                if (Array.from(llmModelSelect.options).some(opt => opt.value === aiConfig.model)) {
                    llmModelSelect.value = aiConfig.model;
                } else {
                    llmModelSelect.value = 'none';
                    aiConfig.model = 'none';
                }
                apiKeyInput.value = aiConfig.apiKey || '';
                console.log('Configurazione AI caricata:', aiConfig.model);
                if (aiConfig.model !== 'none' && aiConfig.apiKey) {
                    needsConfig = false;
                }
            } else {
                console.log('Nessuna configurazione AI salvata trovata.');
                llmModelSelect.value = 'none';
                apiKeyInput.value = '';
            }
            const sessionResult = await chrome.storage.session.get(SESSION_STATE_KEY);
            // Imposta stato iniziale AI Config solo se non già caricato da sessione
            // E se effettivamente serve configurazione (nessuna chiave o modello salvato)
            if (!sessionResult[SESSION_STATE_KEY]?.hasOwnProperty('aiConfigOpen')) {
                aiConfigSection?.classList.toggle('open', needsConfig);
            }

        } catch (error) {
            console.error('Errore caricamento configurazione AI:', error);
            showStatus('Errore nel caricamento della configurazione AI.', 'error');
            aiConfigSection?.classList.add('open'); // Apri in caso di errore per permettere all'utente di vedere/correggere
        }
    }

    saveAiConfigButton.addEventListener('click', async () => {
        const selectedModel = llmModelSelect.value;
        const enteredApiKey = apiKeyInput.value.trim();
        if (selectedModel !== 'none' && !enteredApiKey) {
            showStatus('Inserisci la chiave API per il modello selezionato.', 'warning');
            apiKeyInput.focus();
            return;
        }
        if (selectedModel === 'none' && enteredApiKey) {
            showStatus('Seleziona un modello AI se inserisci una chiave API.', 'warning');
            llmModelSelect.focus();
            return;
        }
        aiConfig = { model: selectedModel, apiKey: enteredApiKey };
        try {
            await chrome.storage.local.set({ [AI_CONFIG_KEY]: aiConfig });
            showStatus('Configurazione AI salvata con successo!', 'success');
            console.log('Configurazione AI salvata:', aiConfig.model);
            if (aiConfig.model !== 'none' && aiConfig.apiKey) {
                aiConfigSection?.classList.remove('open'); // Chiudi se configurato
                saveSessionState(); // Salva anche lo stato del collapsible
            }
        } catch (error) {
            console.error('Errore salvataggio config AI:', error);
            showStatus(`Errore salvataggio config AI: ${error.message}`, 'error');
        }
    });

    // ===========================================
    // --- Event Listeners for State Saving ---
    // ===========================================
    pageNameInput.addEventListener('input', saveSessionState);
    dataInput.addEventListener('input', saveSessionState); // Salva JSON input mentre l'utente digita/incolla
    // aiOutputTextarea non ha un listener 'input' perché è readonly, il suo stato viene salvato dopo il mapping AI

    // ===========================================
    // --- Core Functionality Event Listeners ---
    // ===========================================

    // Gestione Cambio View Mode
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            applySourceChangesButton.classList.toggle('hidden', this.value === 'preview');
            previewFrame.classList.toggle('hidden', this.value === 'source');
            htmlSourceTextarea.classList.toggle('hidden', this.value === 'preview');
            if (this.value === 'preview') {
                previewFrame.srcdoc = currentHtmlContent || '';
            } else {
                htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent || '');
            }
            saveSessionState(); // Salva cambio view mode
        });
    });

    // Applica Modifiche Sorgente
    applySourceChangesButton.addEventListener('click', () => {
        currentHtmlContent = cleanHtmlFromTextareaFormatting(htmlSourceTextarea.value);
        previewFrame.srcdoc = currentHtmlContent;
        htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent); // Riformatta per coerenza
        showStatus('Modifiche codice sorgente applicate.', 'success');
        saveSessionState(); // Salva HTML aggiornato
    });

    // Estrazione Form
    extractFormsButton.addEventListener('click', async () => {
        showStatus('Estrazione forms in corso...', 'info', 0);
        currentHtmlContent = null; // Resetta stato HTML
        previewFrame.srcdoc = '<p>Estrazione...</p>';
        htmlSourceTextarea.value = ''; copyButton.disabled = true; saveButton.disabled = true;
        aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true;
        // Non resettare pageNameInput, dataInput, aiOutputTextarea qui, saranno gestiti da save/load session

        // Forza la vista anteprima
        document.querySelector('input[name="viewMode"][value="preview"]').checked = true;
        previewFrame.classList.remove('hidden');
        htmlSourceTextarea.classList.add('hidden');
        applySourceChangesButton.classList.add('hidden');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) { showStatus('Errore scheda attiva.', 'error'); previewFrame.srcdoc = '<p>Errore scheda</p>'; return; }

        // Precompila nome pagina se vuoto, poi salva sessione
        if (!pageNameInput.value && tab.title) { pageNameInput.value = sanitizeFilenameForSave(tab.title); }
        else if (!pageNameInput.value) { pageNameInput.value = 'pagina_estratta'; }
        // Salva il nome pagina (suggerito o default) e lo stato corrente prima dell'estrazione
        saveSessionState();

        try {
            const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.extractAndSimplifyForms_content() });
            if (results && results[0] && typeof results[0].result === 'string') {
                currentHtmlContent = results[0].result; // Aggiorna stato HTML
                previewFrame.srcdoc = currentHtmlContent;
                // htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent); // Prepara per vista sorgente

                if (currentHtmlContent.includes("Nessun tag <form>")) { showStatus('Nessun form trovato.', 'info'); }
                else if (currentHtmlContent.trim() === '' || (currentHtmlContent.includes("<!-- Form originale") && !currentHtmlContent.includes("<form"))) { showStatus('Nessun contenuto estraibile.', 'info'); previewFrame.srcdoc = '<p>Nessun contenuto.</p>'; }
                else { showStatus('Estrazione completata!', 'success'); copyButton.disabled = false; saveButton.disabled = false; }
                saveSessionState(); // Salva stato dopo estrazione riuscita
            } else {
                showStatus('Errore estrazione (risultato).', 'error'); previewFrame.srcdoc = '<p>Errore estrazione</p>';
                currentHtmlContent = '<p style="color:red">Errore estrazione.</p>'; // Salva un messaggio di errore
                saveSessionState();
            }
        } catch (error) {
            showStatus(`Errore estrazione (script): ${error.message}`, 'error'); previewFrame.srcdoc = '<p>Errore script</p>';
            currentHtmlContent = `<p style="color:red">Errore script estrazione: ${error.message}</p>`;
            saveSessionState();
        }
    });

    // Estrazione Form con il supporto dell'AI
    extractFormsWithAiButton.addEventListener('click', async () => {
        // Verifica configurazione AI
        if (aiConfig.model === 'none' || !aiConfig.apiKey) {
            showStatus('Configura AI (modello e API Key) prima di utilizzare l\'estrazione con AI.', 'warning', 7000);
            aiConfigSection?.classList.add('open');
            saveSessionState();
            aiConfigSection?.scrollIntoViewIfNeeded();
            return;
        }

        showStatus('Estrazione HTML dalla pagina...', 'info', 0);

        // Reset dello stato
        currentHtmlContent = null;
        previewFrame.srcdoc = '<p>Estrazione con AI in corso...</p>';
        htmlSourceTextarea.value = '';
        copyButton.disabled = true;
        saveButton.disabled = true;
        aiOutputContainer.classList.add('hidden');
        aiOutputTextarea.value = '';
        assignAiValuesButton.disabled = true;

        // Forza la vista anteprima
        document.querySelector('input[name="viewMode"][value="preview"]').checked = true;
        previewFrame.classList.remove('hidden');
        htmlSourceTextarea.classList.add('hidden');
        applySourceChangesButton.classList.add('hidden');

        try {
            // 1. Estrai HTML dalla pagina
            const pageData = await extractPageHTML();

            // 2. Precompila il nome pagina
            if (!pageNameInput.value && pageData.title) {
                pageNameInput.value = sanitizeFilenameForSave(pageData.title);
            } else if (!pageNameInput.value) {
                pageNameInput.value = 'pagina_estratta_ai';
            }

            saveSessionState();

            showStatus(`Invio HTML a ${aiConfig.model} per estrazione form...`, 'info', 0);
            extractFormsWithAiButton.disabled = true;

            // 3. Crea il prompt con l'HTML della pagina
            const prompt = createFormExtractionPrompt(pageData.html, pageData.title);

            // 4. Chiama l'API AI
            let aiResponseHtml = '';
            const selectedModel = aiConfig.model;
            const apiKey = aiConfig.apiKey;

            console.log(`Chiamata AI per estrazione form: ${selectedModel}`);

            if (selectedModel.startsWith('gemini-') || selectedModel.startsWith('gemma-')) {
                aiResponseHtml = await callGoogleApi(selectedModel, prompt, apiKey);
            } else if (selectedModel.startsWith('openai-')) {
                const openAiModelName = selectedModel.substring('openai-'.length);
                aiResponseHtml = await callOpenAiApi(openAiModelName, prompt, apiKey);
            } else {
                throw new Error('Modello AI non supportato.');
            }

            console.log(`Risposta AI ricevuta da ${selectedModel}`);

            // 5. Pulisci la risposta AI (rimuovi eventuali wrapper markdown)
            let cleanedHtml = aiResponseHtml.trim();

            // Rimuovi wrapper markdown se presenti
            if (cleanedHtml.startsWith('```html')) {
                cleanedHtml = cleanedHtml.replace(/^```html\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedHtml.startsWith('```')) {
                cleanedHtml = cleanedHtml.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            // 6. Verifica che la risposta contenga HTML valido
            if (!cleanedHtml.includes('<') || !cleanedHtml.includes('>')) {
                throw new Error('La risposta AI non contiene HTML valido.');
            }

            // 7. Aggiorna lo stato con il risultato
            currentHtmlContent = cleanedHtml;
            previewFrame.srcdoc = currentHtmlContent;

            // 8. Abilita i pulsanti di azione
            copyButton.disabled = false;
            saveButton.disabled = false;

            if (currentHtmlContent.includes("Nessun")) {
                showStatus('Nessun form trovato dall\'AI.', 'info');
            } else if (currentHtmlContent.trim() === '') {
                showStatus('L\'AI non ha restituito contenuto valido.', 'warning');
            } else {
                showStatus(`Estrazione AI completata con ${selectedModel}! Form estratti e associati alle etichette.`, 'success');
            }

            saveSessionState();

        } catch (error) {
            console.error(`Errore estrazione AI (${aiConfig.model}):`, error);
            showStatus(`Errore Estrazione AI (${aiConfig.model}): ${error.message}`, 'error', 10000);

            previewFrame.srcdoc = `<p style="color:red; padding:20px;">Errore estrazione AI: ${error.message}</p>`;
            currentHtmlContent = `<p style="color:red;">Errore estrazione AI: ${error.message}</p>`;
            saveSessionState();

        } finally {
            extractFormsWithAiButton.disabled = false;
            saveSessionState();
        }
    });

    // Caricamento Dati JSON
    loadDataButton.addEventListener('click', () => { dataFileInput.click(); });
    dataFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        if (!file.name.endsWith('.json') && file.type !== 'application/json') { showStatus('Seleziona file .json valido.', 'error'); dataInput.value = ''; event.target.value = null; return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                JSON.parse(content); // Valida solo se è JSON, non lo pre-processa qui
                dataInput.value = content; // Aggiorna textarea
                showStatus(`File "${file.name}" caricato.`, 'success');
                // Resetta output AI se si caricano nuovi dati
                aiOutputContainer.classList.add('hidden');
                aiOutputTextarea.value = '';
                assignAiValuesButton.disabled = true;
                saveSessionState(); // Salva stato dopo caricamento
            } catch (jsonError) { showStatus(`File "${file.name}" non è JSON valido: ${jsonError.message}`, 'error', 7000); dataInput.value = ''; }
        };
        reader.onerror = (e) => { showStatus(`Errore lettura file "${file.name}".`, 'error'); dataInput.value = ''; };
        reader.readAsText(file); event.target.value = null; // Permette di ricaricare lo stesso file
    });

    // Mappa con AI
    mapWithAiButton.addEventListener('click', async () => {
        if (aiConfig.model === 'none' || !aiConfig.apiKey) { showStatus('Configura AI (modello e API Key).', 'warning', 7000); aiConfigSection?.classList.add('open'); saveSessionState(); aiConfigSection?.scrollIntoViewIfNeeded(); return; }
        if (!currentHtmlContent || currentHtmlContent.trim() === '') { showStatus('Estrai prima un form HTML.', 'warning'); return; }
        const inputJsonString = dataInput.value.trim(); if (!inputJsonString) { showStatus('Carica o incolla i dati JSON per il mapping.', 'warning'); dataInput.focus(); return; }
        try { const p = JSON.parse(inputJsonString); if (!Array.isArray(p) && typeof p !== 'object') throw new Error("Input non è JSON valido (array o oggetto)."); } // Leggermente più permissivo per l'input AI
        catch (error) { showStatus(`JSON Input non valido per AI: ${error.message}`, 'error', 7000); dataInput.focus(); return; }

        showStatus(`Invio dati a ${aiConfig.model}...`, 'info', 0);
        aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true; mapWithAiButton.disabled = true;
        saveSessionState(); // Salva lo stato prima della chiamata AI

        try {
            const prompt = createMappingPrompt(currentHtmlContent, inputJsonString);
            let llmResponseString = ''; const selectedModel = aiConfig.model; const apiKey = aiConfig.apiKey; console.log(`Chiamata a ${selectedModel}.`);
            if (selectedModel.startsWith('gemini-') || selectedModel.startsWith('gemma-')) { llmResponseString = await callGoogleApi(selectedModel, prompt, apiKey); }
            else if (selectedModel.startsWith('openai-')) { const openAiModelName = selectedModel.substring('openai-'.length); llmResponseString = await callOpenAiApi(openAiModelName, prompt, apiKey); }
            else { throw new Error('Modello AI non supportato.'); }
            console.log(`Risposta grezza da ${selectedModel}.`);
            const suggestedMappingJson = extractJsonFromString(llmResponseString);
            if (!suggestedMappingJson) { throw new Error(`L'AI (${selectedModel}) non ha restituito un JSON valido.`); }
            if (!Array.isArray(suggestedMappingJson)) { throw new Error(`L'output dell'AI (${selectedModel}) non è un array JSON come richiesto.`); }
            const isValidFormat = suggestedMappingJson.every(item => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'valore' in item);
            if (!isValidFormat) { throw new Error(`Gli oggetti nell'array JSON dell'AI (${selectedModel}) non hanno il formato richiesto {id: string, valore: any}.`); }

            aiOutputTextarea.value = JSON.stringify(suggestedMappingJson, null, 2);
            aiOutputContainer.classList.remove('hidden');
            assignAiValuesButton.disabled = false;
            showStatus(`Mapping da ${selectedModel} completato. Verifica il JSON suggerito.`, 'success');
            aiOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            saveSessionState(); // Salva stato dopo mapping riuscito
        } catch (error) {
            console.error(`Errore mapping AI (${aiConfig.model}):`, error);
            showStatus(`Errore Mapping AI (${aiConfig.model}): ${error.message}`, 'error', 10000);
            // Non nascondere aiOutputContainer qui, l'utente potrebbe voler vedere l'errore o un output parziale
            // aiOutputContainer.classList.add('hidden');
            aiOutputTextarea.value = `Errore: ${error.message}\n\nRisposta (se disponibile):\n${llmResponseString || 'Nessuna risposta ricevuta.'}`; // Mostra l'errore nella textarea
            assignAiValuesButton.disabled = true;
            saveSessionState(); // Salva lo stato di errore
        } finally {
            mapWithAiButton.disabled = false;
            saveSessionState(); // Salva lo stato finale del bottone
        }
    });

    // Assegna Valori (da JSON Input)
    assignValuesButton.addEventListener('click', async () => {
        const jsonDataString = dataInput.value.trim();
        if (!jsonDataString) {
            showStatus('Area dati JSON Input vuota. Carica o incolla dati.', 'warning');
            return;
        }
        let parsedJsonInput;
        try {
            parsedJsonInput = JSON.parse(jsonDataString);
        } catch (error) {
            showStatus(`Errore parsing JSON Input: ${error.message}`, 'error', 7000);
            return;
        }

        // *** ESEGUI PREPROCESSING QUI ***
        const processedData = preprocessJsonForAssignment(parsedJsonInput);

        if (processedData.length === 0) {
            showStatus('Nessuna coppia id/valore estraibile trovata nel JSON fornito con la struttura attesa.', 'warning', 7000);
            return;
        }
        await assignValuesToPage(processedData); // Usa i dati pre-processati
    });

    // Assegna Valori (da Suggerimento AI)
    assignAiValuesButton.addEventListener('click', async () => {
        const aiJsonString = aiOutputTextarea.value.trim();
        if (!aiJsonString) {
            showStatus('Nessun mapping JSON suggerito dall\'AI da assegnare.', 'warning');
            return;
        }
        let parsedAiData;
        try {
            parsedAiData = JSON.parse(aiJsonString); // L'output AI è atteso già nel formato corretto
        } catch (error) {
            showStatus(`Errore parsing JSON suggerito dall'AI: ${error.message}`, 'error', 7000);
            return;
        }
        // NESSUN PREPROCESSING QUI per l'output AI
        await assignValuesToPage(parsedAiData);
    });

    // Copia HTML
    copyButton.addEventListener('click', () => {
        const isSourceView = !htmlSourceTextarea.classList.contains('hidden');
        const contentToCopy = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || '');
        if (contentToCopy && !copyButton.disabled) {
            navigator.clipboard.writeText(contentToCopy)
                .then(() => showStatus('HTML copiato negli appunti!', 'success'))
                .catch(err => {
                    showStatus('Errore durante la copia dell\'HTML.', 'error');
                    console.error('Errore copia HTML:', err);
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = contentToCopy;
                        ta.style.position = 'fixed'; document.body.appendChild(ta);
                        ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                        showStatus('HTML copiato (fallback)!', 'success');
                    } catch (e) { showStatus('Copia fallita.', 'error'); }
                });
        } else {
            showStatus('Nessun HTML da copiare.', 'info');
        }
    });

    // Salva HTML
    saveButton.addEventListener('click', () => {
        const isSourceView = !htmlSourceTextarea.classList.contains('hidden');
        const contentToSave = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || '');
        if (contentToSave && !saveButton.disabled) {
            const pageName = pageNameInput.value.trim() || 'extracted_forms';
            const filename = sanitizeFilenameForSave(pageName) + '.html';
            const fileContent = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.6;padding:20px;margin:0;background-color:#f4f4f4;color:#333}.form-container-wrapper>h3{color:#3498db;margin-top:20px;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:15px}.form-container-wrapper>h3:first-of-type{margin-top:0}.form-container-wrapper>form{background-color:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:25px;box-shadow:0 2px 5px rgba(0,0,0,.1)}h2.main-title{text-align:center;color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px;margin-bottom:30px}label{display:block;margin-bottom:5px;font-weight:bold;color:#555}input[type=text],input[type=email],input[type=password],input[type=url],input[type=tel],input[type=number],input[type=date],input[type=time],input[type=search],textarea,select{display:block;width:95%;max-width:500px;padding:10px;margin-bottom:15px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:1em}input[type=checkbox],input[type=radio]{margin-right:8px;vertical-align:middle;margin-bottom:10px}label>input[type=checkbox],label>input[type=radio]{margin-bottom:0;display:inline-block;width:auto}fieldset{border:1px solid #ddd;padding:15px;margin-bottom:20px;border-radius:4px}legend{font-weight:bold;color:#3498db;padding:0 10px;margin-left:5px}table{width:100%;border-collapse:collapse;margin-bottom:15px}th,td{border:1px solid #eee;padding:8px;text-align:left;vertical-align:top}th{background-color:#f0f0f0;font-weight:bold}hr{margin:30px 0;border:0;border-top:2px dashed #ccc}td div,td span,td p{margin-bottom:5px}label+input,label+select,label+textarea{margin-top:2px}</style></head><body><h2 class="main-title">${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</h2><div class="form-container-wrapper">${contentToSave}</div></body></html>`;
            const blob = new Blob([fileContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({ url: url, filename: filename, saveAs: true }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error("Download failed:", chrome.runtime.lastError);
                    showStatus(`Errore salvataggio: ${chrome.runtime.lastError.message}`, 'error');
                    try {
                        const a = document.createElement('a'); a.href = url; a.download = filename;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        showStatus(`File "${filename}" pronto (fallback).`, 'warning', 7000);
                    } catch (e) {
                        showStatus('Salvataggio fallito (fallback).', 'error');
                        URL.revokeObjectURL(url);
                    }
                } else if (downloadId) {
                    showStatus(`Download "${filename}" avviato.`, 'success');
                    URL.revokeObjectURL(url);
                } else {
                    showStatus(`Download "${filename}" non avviato. Controlla impostazioni browser.`, 'warning', 7000);
                    URL.revokeObjectURL(url);
                }
            });
        } else {
            showStatus('Nessun HTML da salvare.', 'info');
        }
    });

    // ===========================================
    // --- Inizializzazione ---
    // ===========================================
    setupCollapsibles();
    loadSessionState().then(() => {
        loadAiConfig(); // Carica config AI dopo lo stato sessione
    });

}); // End DOMContentLoaded