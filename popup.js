document.addEventListener('DOMContentLoaded', function() {
    // --- Elementi UI ---
    const extractFormsButton = document.getElementById('extractFormsButton');
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
    const assignValuesButton = document.getElementById('assignValuesButton');
    const statusMessage = document.getElementById('statusMessage');
    const llmModelSelect = document.getElementById('llmModelSelect');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveAiConfigButton = document.getElementById('saveAiConfigButton');
    const mapWithAiButton = document.getElementById('mapWithAiButton');
    const aiOutputContainer = document.getElementById('aiOutputContainer');
    const aiOutputTextarea = document.getElementById('aiOutputTextarea');
    const assignAiValuesButton = document.getElementById('assignAiValuesButton');
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

    // *** DEFINIZIONE DELLA FUNZIONE createMappingPrompt ***
    function createMappingPrompt(htmlForm, inputJsonString) {
        let cleanedJsonString = inputJsonString;
        try {
            const parsed = JSON.parse(inputJsonString);
            cleanedJsonString = JSON.stringify(parsed, null, 2);
        } catch (e) { /* Ignora errore parsing */ }
        // Usa la versione con backtick escapati
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

    // *** DEFINIZIONE DELLA FUNZIONE assignValuesToPage ***
    async function assignValuesToPage(jsonData) {
        if (!Array.isArray(jsonData)) {
            showStatus('Errore interno: Dati per assegnazione non validi (non è un array).', 'error');
            return;
        }
        if (jsonData.length === 0) {
            showStatus('Nessun dato valido da assegnare.', 'info');
            return;
        }
        if (!jsonData.every(item => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'valore' in item)) {
            showStatus('Errore: Formato JSON per assegnazione non valido. Richiesto: [{"id": "stringa", "valore": "qualsiasi"}].', 'error', 7000);
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
                extractionSection?.classList.toggle('open', savedState.extractionOpen !== false);
                fillingSection?.classList.toggle('open', !!savedState.fillingOpen);
                showStatus('Stato sessione precedente ripristinato.', 'info', 3000);
            } else {
                console.log('No previous session state found.');
                copyButton.disabled = true;
                saveButton.disabled = true;
                assignAiValuesButton.disabled = true;
                aiOutputContainer.classList.add('hidden');
                aiConfigSection?.classList.remove('open');
                extractionSection?.classList.add('open');
                fillingSection?.classList.remove('open');
            }
        } catch (error) {
            console.error("Error loading session state:", error);
            showStatus('Errore nel caricamento dello stato della sessione.', 'error');
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
            // O se effettivamente serve configurazione
            if (!sessionResult[SESSION_STATE_KEY]?.hasOwnProperty('aiConfigOpen')) {
                aiConfigSection?.classList.toggle('open', needsConfig);
            }

        } catch (error) {
            console.error('Errore caricamento configurazione AI:', error);
            showStatus('Errore nel caricamento della configurazione AI.', 'error');
            aiConfigSection?.classList.add('open');
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
                aiConfigSection?.classList.remove('open');
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
    dataInput.addEventListener('input', saveSessionState);
    viewModeRadios.forEach(radio => radio.addEventListener('change', saveSessionState));
    // Altri salvataggi sono inseriti nelle funzioni specifiche

    // ===========================================
    // --- Core Functionality Event Listeners ---
    // ===========================================

    // Gestione Cambio View Mode
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            applySourceChangesButton.classList.toggle('hidden', this.value === 'preview');
            previewFrame.classList.toggle('hidden', this.value === 'source');
            htmlSourceTextarea.classList.toggle('hidden', this.value === 'preview');
            if (this.value === 'preview') {
                previewFrame.srcdoc = currentHtmlContent || '';
            } else {
                htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent || '');
            }
            // State already saved by separate listener
        });
    });

    // Applica Modifiche Sorgente
    applySourceChangesButton.addEventListener('click', () => {
        currentHtmlContent = cleanHtmlFromTextareaFormatting(htmlSourceTextarea.value);
        previewFrame.srcdoc = currentHtmlContent;
        htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent);
        showStatus('Modifiche codice sorgente applicate.', 'success');
        saveSessionState(); // Salva HTML aggiornato
    });

    // Estrazione Form
    extractFormsButton.addEventListener('click', async () => {
        showStatus('Estrazione forms in corso...', 'info', 0);
        currentHtmlContent = null;
        previewFrame.srcdoc = '<p>Estrazione...</p>';
        htmlSourceTextarea.value = ''; copyButton.disabled = true; saveButton.disabled = true;
        aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true;
        document.querySelector('input[name="viewMode"][value="preview"]').checked = true;
        previewFrame.classList.remove('hidden'); htmlSourceTextarea.classList.add('hidden'); applySourceChangesButton.classList.add('hidden');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) { showStatus('Errore scheda attiva.', 'error'); previewFrame.srcdoc = '<p>Errore scheda</p>'; return; }
        if (!pageNameInput.value && tab.title) { pageNameInput.value = sanitizeFilenameForSave(tab.title); }
        else if (!pageNameInput.value) { pageNameInput.value = 'pagina_estratta'; }
        saveSessionState(); // Save suggested/default page name immediately
        try {
            const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.extractAndSimplifyForms_content() });
            if (results && results[0] && typeof results[0].result === 'string') {
                currentHtmlContent = results[0].result;
                previewFrame.srcdoc = currentHtmlContent;
                if (currentHtmlContent.includes("Nessun tag <form>")) { showStatus('Nessun form trovato.', 'info'); }
                else if (currentHtmlContent.trim() === '' || (currentHtmlContent.includes("<!-- Form originale") && !currentHtmlContent.includes("<form")) ) { showStatus('Nessun contenuto estraibile.', 'info'); previewFrame.srcdoc = '<p>Nessun contenuto.</p>';}
                else { showStatus('Estrazione completata!', 'success'); copyButton.disabled = false; saveButton.disabled = false; }
                saveSessionState(); // Save state after successful extraction
            } else { showStatus('Errore estrazione (risultato).', 'error'); previewFrame.srcdoc = '<p>Errore estrazione</p>'; }
        } catch (error) { showStatus(`Errore estrazione (script): ${error.message}`, 'error'); previewFrame.srcdoc = '<p>Errore script</p>'; }
    });

    // Caricamento Dati JSON
    loadDataButton.addEventListener('click', () => { dataFileInput.click(); });
    dataFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        if (!file.name.endsWith('.json') && file.type !== 'application/json') { showStatus('Seleziona file .json valido.', 'error'); dataInput.value = ''; event.target.value = null; return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result; JSON.parse(content);
                dataInput.value = content;
                showStatus(`File "${file.name}" caricato.`, 'success');
                aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true;
                saveSessionState(); // Save state after loading
            } catch (jsonError) { showStatus(`File non JSON valido: ${jsonError.message}`, 'error', 7000); dataInput.value = ''; }
        };
        reader.onerror = (e) => { showStatus(`Errore lettura file "${file.name}".`, 'error'); dataInput.value = ''; };
        reader.readAsText(file); event.target.value = null;
    });

    // Mappa con AI
    mapWithAiButton.addEventListener('click', async () => {
        if (aiConfig.model === 'none' || !aiConfig.apiKey) { showStatus('Configura AI (modello e API Key).', 'warning', 7000); aiConfigSection?.classList.add('open'); aiConfigSection?.scrollIntoViewIfNeeded(); return; }
        if (!currentHtmlContent || currentHtmlContent.trim() === '') { showStatus('Estrai prima un form HTML.', 'warning'); return; }
        const inputJsonString = dataInput.value.trim(); if (!inputJsonString) { showStatus('Carica o incolla i dati JSON.', 'warning'); dataInput.focus(); return; }
        try { const p = JSON.parse(inputJsonString); if (!Array.isArray(p)) throw new Error("Input non è array."); } catch (error) { showStatus(`JSON Input non valido: ${error.message}`, 'error', 7000); dataInput.focus(); return; }
        showStatus(`Invio dati a ${aiConfig.model}...`, 'info', 0); aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true; mapWithAiButton.disabled = true;
        try {
            const prompt = createMappingPrompt(currentHtmlContent, inputJsonString); // Uses the defined function
            let llmResponseString = ''; const selectedModel = aiConfig.model; const apiKey = aiConfig.apiKey; console.log(`Chiamata a ${selectedModel}.`);
            if (selectedModel.startsWith('gemini-') || selectedModel.startsWith('gemma-')) { llmResponseString = await callGoogleApi(selectedModel, prompt, apiKey); }
            else if (selectedModel.startsWith('openai-')) { const openAiModelName = selectedModel.substring('openai-'.length); llmResponseString = await callOpenAiApi(openAiModelName, prompt, apiKey); }
            else { throw new Error('Modello AI non supportato.'); }
            console.log(`Risposta grezza da ${selectedModel}.`);
            const suggestedMappingJson = extractJsonFromString(llmResponseString); if (!suggestedMappingJson) { throw new Error(`AI (${selectedModel}) no JSON valido.`); }
            if (!Array.isArray(suggestedMappingJson)) { throw new Error(`Output AI (${selectedModel}) non array.`); } const isValidFormat = suggestedMappingJson.every(item => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'valore' in item ); if (!isValidFormat) { throw new Error(`Formato oggetti AI (${selectedModel}) errato.`); }
            aiOutputTextarea.value = JSON.stringify(suggestedMappingJson, null, 2); aiOutputContainer.classList.remove('hidden'); assignAiValuesButton.disabled = false; showStatus(`Mapping da ${selectedModel} completato.`, 'success'); aiOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); saveSessionState(); // Save state after successful mapping
        } catch (error) { console.error(`Errore mapping AI (${aiConfig.model}):`, error); showStatus(`Errore Mapping AI (${aiConfig.model}): ${error.message}`, 'error', 10000); aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true; } finally { mapWithAiButton.disabled = false; }
    });

    // Assegna Valori (da JSON Input)
    assignValuesButton.addEventListener('click', async () => {
        const jsonDataString = dataInput.value.trim();
        if (!jsonDataString) { showStatus('Area dati JSON Input vuota.', 'warning'); return; }
        let parsedData;
        try { parsedData = JSON.parse(jsonDataString); }
        catch (error) { showStatus(`Errore parsing JSON Input: ${error.message}`, 'error', 7000); return; }
        await assignValuesToPage(parsedData); // Usa la funzione helper
    });

    // Assegna Valori (da Suggerimento AI)
    assignAiValuesButton.addEventListener('click', async () => {
        const aiJsonString = aiOutputTextarea.value.trim();
        if (!aiJsonString) { showStatus('Nessun mapping AI da assegnare.', 'warning'); return; }
        let parsedAiData;
        try { parsedAiData = JSON.parse(aiJsonString); }
        catch (error) { showStatus(`Errore parsing JSON AI: ${error.message}`, 'error', 7000); return; }
        await assignValuesToPage(parsedAiData); // Chiama la funzione definita
    });

    // Copia HTML
    copyButton.addEventListener('click', () => { const isSourceView = !htmlSourceTextarea.classList.contains('hidden'); const contentToCopy = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || ''); if (contentToCopy && !copyButton.disabled) { navigator.clipboard.writeText(contentToCopy).then(() => showStatus('HTML copiato!', 'success')).catch(err => { showStatus('Errore copia.', 'error'); console.error('Errore copia:', err); try { const ta = document.createElement('textarea'); ta.value = contentToCopy; ta.style.position = 'fixed'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showStatus('HTML copiato (fallback)!', 'success'); } catch (e) { showStatus('Copia fallita.', 'error'); } }); } else { showStatus('Nessun HTML da copiare.', 'info'); } });

    // Salva HTML
    saveButton.addEventListener('click', () => { const isSourceView = !htmlSourceTextarea.classList.contains('hidden'); const contentToSave = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || ''); if (contentToSave && !saveButton.disabled) { const pageName = pageNameInput.value.trim() || 'extracted_forms'; const filename = sanitizeFilenameForSave(pageName) + '.html'; const fileContent = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.6;padding:20px;margin:0;background-color:#f4f4f4;color:#333}.form-container-wrapper>h3{color:#3498db;margin-top:20px;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:15px}.form-container-wrapper>h3:first-of-type{margin-top:0}.form-container-wrapper>form{background-color:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:25px;box-shadow:0 2px 5px rgba(0,0,0,.1)}h2.main-title{text-align:center;color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px;margin-bottom:30px}label{display:block;margin-bottom:5px;font-weight:bold;color:#555}input[type=text],input[type=email],input[type=password],input[type=url],input[type=tel],input[type=number],input[type=date],input[type=time],input[type=search],textarea,select{display:block;width:95%;max-width:500px;padding:10px;margin-bottom:15px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:1em}input[type=checkbox],input[type=radio]{margin-right:8px;vertical-align:middle;margin-bottom:10px}label>input[type=checkbox],label>input[type=radio]{margin-bottom:0;display:inline-block;width:auto}fieldset{border:1px solid #ddd;padding:15px;margin-bottom:20px;border-radius:4px}legend{font-weight:bold;color:#3498db;padding:0 10px;margin-left:5px}table{width:100%;border-collapse:collapse;margin-bottom:15px}th,td{border:1px solid #eee;padding:8px;text-align:left;vertical-align:top}th{background-color:#f0f0f0;font-weight:bold}hr{margin:30px 0;border:0;border-top:2px dashed #ccc}td div,td span,td p{margin-bottom:5px}label+input,label+select,label+textarea{margin-top:2px}</style></head><body><h2 class="main-title">${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</h2><div class="form-container-wrapper">${contentToSave}</div></body></html>`; const blob = new Blob([fileContent], { type: 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); chrome.downloads.download({ url: url, filename: filename, saveAs: true }, (downloadId) => { if (chrome.runtime.lastError) { console.error("Download failed:", chrome.runtime.lastError); showStatus(`Errore salvataggio: ${chrome.runtime.lastError.message}`, 'error'); try { const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); showStatus(`File "${filename}" pronto (fallback).`, 'warning', 7000); } catch(e) { showStatus('Salvataggio fallito (fallback).', 'error'); URL.revokeObjectURL(url); } } else if (downloadId) { showStatus(`Download "${filename}" avviato.`, 'success'); URL.revokeObjectURL(url); } else { showStatus(`Download "${filename}" non avviato.`, 'warning', 7000); URL.revokeObjectURL(url); } }); } else { showStatus('Nessun HTML da salvare.', 'info'); } });

    // ===========================================
    // --- Inizializzazione ---
    // ===========================================
    setupCollapsibles();
    loadSessionState().then(() => {
        loadAiConfig();
    });

}); // End DOMContentLoaded