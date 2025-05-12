document.addEventListener('DOMContentLoaded', function() {
    // --- Elementi UI ---
    // (Get all elements as before)
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
    const aiConfigSection = document.getElementById('aiConfigSection'); // Collapsible section
    const extractionSection = document.getElementById('extractionSection'); // Collapsible section
    const fillingSection = document.getElementById('fillingSection'); // Collapsible section

    // --- Stato Interno (Defaults) ---
    let currentHtmlContent = null; // In-memory state for HTML
    let aiConfig = { model: 'none', apiKey: '' }; // AI Config state
    const AI_CONFIG_KEY = 'ai_config_v2'; // Storage key for AI config (local, persistent)
    const SESSION_STATE_KEY = 'popup_session_state'; // Storage key for session state (session)

    // --- Funzioni Helper (Invariate) ---
    function showStatus(message, type = 'info', duration = 5000) { /* ... as before ... */
        statusMessage.textContent = message; statusMessage.className = ''; statusMessage.classList.add(`status-${type}`);
        if (duration <= 0) { statusMessage.classList.add(`status-permanent`); }
        else { const p = document.querySelectorAll('.status-permanent'); p.forEach(pm => { pm.textContent = ''; pm.className = ''; }); setTimeout(() => { if (statusMessage.textContent === message && !statusMessage.classList.contains('status-permanent')) { statusMessage.textContent = ''; statusMessage.className = ''; } }, duration); }
        // statusMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Removed, status bar is fixed
    }
    function sanitizeFilenameForSave(name) { /* ... as before ... */
        let s = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim(); s = s.substring(0, 100); if (!s) s = 'extracted_forms'; return s;
    }
    function cleanHtmlFromTextareaFormatting(htmlString) { /* ... as before ... */
        if (!htmlString) return ''; let lines = htmlString.split('\n'); let cleanedLines = lines.map(line => line.trimStart()); let cleanedHtml = cleanedLines.join('\n'); cleanedHtml = cleanedHtml.replace(/\n\s*\n/g, '\n'); return cleanedHtml.trim();
    }
    function formatHtmlForTextarea(htmlString) { /* ... as before ... */
        if (!htmlString) return ''; try { let formatted = htmlString; formatted = formatted.replace(/<(?!(--|\/|!DOCTYPE|br|hr|input|img|meta|link|option))([a-zA-Z0-9\-_:]+)/g, '\n<$2'); formatted = formatted.replace(/<\/(?!option)([a-zA-Z0-9\-_:]+)>/g, '\n</$1>'); formatted = formatted.replace(/\n\s*\n+/g, '\n'); if (formatted.startsWith('\n')) { formatted = formatted.substring(1); } let lines = formatted.split('\n'); let indentLevel = 0; const indentSize = 2; const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']); const formattedLines = lines.map(line => { let trimmedLine = line.trim(); if (!trimmedLine) return ''; if (trimmedLine.startsWith('</')) { if (indentLevel > 0) { indentLevel--; } } let indentedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine; if (trimmedLine.startsWith('<') && !trimmedLine.startsWith('</') && !trimmedLine.endsWith('/>')) { const tagNameMatch = trimmedLine.match(/^<([a-zA-Z0-9\-_:]+)/); if (tagNameMatch && !voidElements.has(tagNameMatch[1].toLowerCase()) && !trimmedLine.startsWith('<!--') && !trimmedLine.startsWith('<!DOCTYPE')) { indentLevel++; } } return indentedLine; }); return formattedLines.join('\n').trim(); } catch (e) { console.warn("HTML formatting failed", e); return htmlString; }
    }
    function extractJsonFromString(str) { /* ... as before ... */
        if (!str) return null; const c = str.match(/```json\s*([\s\S]*?)\s*```/); if (c && c[1]) { try { return JSON.parse(c[1].trim()); } catch (e) { console.warn('Fail parse JSON code block', e); } } try { const fb = str.indexOf('['); const fbc = str.indexOf('{'); let si = -1; if (fb !== -1 && (fbc === -1 || fb < fbc)) si = fb; else if (fbc !== -1) si = fbc; if (si !== -1) { const lb = str.lastIndexOf(']'); const lbc = str.lastIndexOf('}'); let ei = -1; if (lb !== -1 && (lbc === -1 || lb > lbc)) ei = lb; else if (lbc !== -1) ei = lbc; if (ei !== -1 && ei >= si) { const p = str.substring(si, ei + 1); try { return JSON.parse(p); } catch (e) { console.warn("Fail parse substring", e);} } } return JSON.parse(str.trim()); } catch (e) { console.error('Fail parse JSON string:', e); return null; }
    }
    // --- API Call Functions (Invariate logic, just ensure they exist) ---
    async function callGoogleApi(modelName, prompt, apiKey) { /* ... as before ... */
        const endpointHost = modelName.startsWith('gemma-') ? "generativelanguage.googleapis.com" : "generativelanguage.googleapis.com"; const apiVersion = "v1beta"; const API_URL = `https://${endpointHost}/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`; console.log(`Calling Google API (${modelName}):`, API_URL); const requestBody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8192 }, }; const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }); if (!response.ok) { const errorBody = await response.text(); console.error(`Google API Error Response (${modelName}):`, errorBody); throw new Error(`Errore API Google (${modelName}): ${response.status} ${response.statusText}. Dettagli: ${errorBody}`); } const data = await response.json(); if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) { return data.candidates[0].content.parts[0].text; } else if (data.candidates && data.candidates[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') { console.error(`Google generation stopped (${modelName}):`, data.candidates[0].finishReason, data); throw new Error(`Generazione Google (${modelName}) interrotta: ${data.candidates[0].finishReason}`); } else { console.error(`Struttura risposta Google inattesa (${modelName}):`, data); throw new Error(`Struttura risposta API Google (${modelName}) non valida.`); }
    }
    async function callOpenAiApi(modelName, prompt, apiKey) { /* ... as before ... */
        const API_URL = 'https://api.openai.com/v1/chat/completions'; console.log("Calling OpenAI API with model:", modelName); const requestBody = { model: modelName, messages: [ { role: "system", content: "Sei un assistente AI specializzato nell'analisi di form HTML e dati JSON per creare mapping semantici. Rispondi SOLO con l'array JSON richiesto, senza testo aggiuntivo." }, { role: "user", content: prompt } ], }; if (modelName.includes("gpt-4") || modelName.includes("1106") || modelName.includes("0125") || modelName.includes("gpt-4o")) { requestBody.response_format = { type: "json_object" }; console.log("Requesting JSON object format from OpenAI"); } const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) }); if (!response.ok) { const errorBody = await response.json(); console.error(`OpenAI API Error Response (${modelName}):`, errorBody); throw new Error(`Errore API OpenAI (${modelName}): ${response.status} ${response.statusText}. Dettagli: ${errorBody.error?.message || JSON.stringify(errorBody)}`); } const data = await response.json(); if (data.choices && data.choices[0]?.message?.content) { return data.choices[0].message.content; } else { console.error(`Struttura risposta OpenAI inattesa (${modelName}):`, data); throw new Error(`Struttura risposta API OpenAI (${modelName}) non valida.`); }
    }
    // --- Funzione Generica per Assegnare Valori (Invariata) ---
    async function assignValuesToPage(jsonData) { /* ... as before ... */
        if (!Array.isArray(jsonData)) { showStatus('Errore interno: Dati per assegnazione non validi (non è un array).', 'error'); return; } if (jsonData.length === 0) { showStatus('Nessun dato valido da assegnare.', 'info'); return; } if (!jsonData.every(item => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'valore' in item)) { showStatus('Errore: Formato JSON per assegnazione non valido. Richiesto: [{"id": "stringa", "valore": "qualsiasi"}].', 'error', 7000); return; } const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab || !tab.id) { showStatus('Scheda attiva non trovata per l\'assegnazione.', 'error'); return; } showStatus('Assegnazione valori in corso nella pagina...', 'info', 0); try { const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (dataToAssign) => { if (typeof window.assignFormValuesInPage === 'function') { return window.assignFormValuesInPage(dataToAssign); } else { console.error("Content script function 'assignFormValuesInPage' not found."); return { assignmentsCount: 0, notFoundCount: dataToAssign.length, errorMessages: ["Funzione 'assignFormValuesInPage' non trovata nel content script."] }; } }, args: [jsonData] }); if (results && results[0] && results[0].result) { const { assignmentsCount, notFoundCount, errorMessages } = results[0].result; let statusMsg = `Assegnazione completata. Campi compilati: ${assignmentsCount}. Non trovati/Errori: ${notFoundCount}.`; let statusType = 'info'; if (assignmentsCount > 0 && notFoundCount === 0) statusType = 'success'; else if (assignmentsCount > 0 && notFoundCount > 0) { statusType = 'warning'; statusMsg += " Alcuni campi non trovati o con errori."; } else if (assignmentsCount === 0 && notFoundCount > 0) { statusType = 'error'; statusMsg = `Assegnazione fallita. Nessun campo trovato o compilato. Errori/Non Trovati: ${notFoundCount}.`; } if (errorMessages && errorMessages.length > 0) console.warn("Dettagli assegnazione (errori/non trovati):", errorMessages); showStatus(statusMsg, statusType, 7000); } else { console.error("Risultato inatteso dall'assegnazione:", results); showStatus('Risultato inatteso durante l\'assegnazione dei valori.', 'error'); } } catch (error) { console.error('Errore durante l\'iniezione dello script di assegnazione:', error); showStatus(`Errore script assegnazione: ${error.message}`, 'error'); }
    }

    // --- Session State Management ---
    async function saveSessionState() {
        const currentState = {
            pageName: pageNameInput.value,
            htmlContent: currentHtmlContent, // Save the cleaned/modified HTML
            viewMode: document.querySelector('input[name="viewMode"]:checked')?.value || 'preview',
            jsonData: dataInput.value,
            aiOutputData: aiOutputTextarea.value,
            isAiOutputVisible: !aiOutputContainer.classList.contains('hidden')
        };
        try {
            await chrome.storage.session.set({ [SESSION_STATE_KEY]: currentState });
            // console.log('Session state saved'); // Optional: for debugging
        } catch (error) {
            console.error("Error saving session state:", error);
            // Non mostrare errore all'utente per ogni salvataggio fallito, ma loggalo
        }
    }

    async function loadSessionState() {
        try {
            const result = await chrome.storage.session.get(SESSION_STATE_KEY);
            const savedState = result[SESSION_STATE_KEY];

            if (savedState) {
                console.log('Loading session state:', savedState);

                // Restore values
                pageNameInput.value = savedState.pageName || '';
                currentHtmlContent = savedState.htmlContent || null; // Restore HTML
                dataInput.value = savedState.jsonData || '';
                aiOutputTextarea.value = savedState.aiOutputData || '';

                // Restore HTML view (Preview/Source)
                if (currentHtmlContent) {
                    previewFrame.srcdoc = currentHtmlContent; // Update preview
                    htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent); // Update source view content
                    copyButton.disabled = false;
                    saveButton.disabled = false;
                } else {
                    previewFrame.srcdoc = '';
                    htmlSourceTextarea.value = '';
                    copyButton.disabled = true;
                    saveButton.disabled = true;
                }

                // Restore view mode selection and visibility
                const savedViewMode = savedState.viewMode || 'preview';
                document.querySelector(`input[name="viewMode"][value="${savedViewMode}"]`).checked = true;
                previewFrame.classList.toggle('hidden', savedViewMode === 'source');
                htmlSourceTextarea.classList.toggle('hidden', savedViewMode === 'preview');
                applySourceChangesButton.classList.toggle('hidden', savedViewMode === 'preview');


                // Restore AI Output section visibility
                const isAiVisible = savedState.isAiOutputVisible || false;
                aiOutputContainer.classList.toggle('hidden', !isAiVisible);
                assignAiValuesButton.disabled = !isAiVisible || !aiOutputTextarea.value; // Enable button only if visible and has content


                showStatus('Stato sessione precedente ripristinato.', 'info', 3000);
            } else {
                console.log('No previous session state found.');
                // Ensure defaults are set (buttons disabled etc.)
                copyButton.disabled = true;
                saveButton.disabled = true;
                assignAiValuesButton.disabled = true;
                aiOutputContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error loading session state:", error);
            showStatus('Errore nel caricamento dello stato della sessione.', 'error');
        }
    }

    // --- Collapsible Section Logic ---
    function setupCollapsibles() {
        const toggles = document.querySelectorAll('.collapsible-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const section = toggle.closest('.collapsible-section');
                if (section) {
                    section.classList.toggle('open');
                    // Optional: Save collapsible state if needed, but maybe not for session
                    // saveSessionState(); // Might be too frequent, consider if needed
                }
            });
        });

        // Set default states (Extraction open, Filling closed)
        // AI config state is set after loading AI config
        extractionSection?.classList.add('open');
        fillingSection?.classList.remove('open'); // Ensure it's closed by default
    }

    // --- AI Configuration (Modified for Collapsible Default) ---
    async function loadAiConfig() {
        try {
            const result = await chrome.storage.local.get(AI_CONFIG_KEY);
            let needsConfig = true; // Assume needs config initially
            if (result[AI_CONFIG_KEY]) {
                aiConfig = result[AI_CONFIG_KEY];
                if (Array.from(llmModelSelect.options).some(opt => opt.value === aiConfig.model)) {
                    llmModelSelect.value = aiConfig.model;
                } else {
                    llmModelSelect.value = 'none'; aiConfig.model = 'none';
                }
                apiKeyInput.value = aiConfig.apiKey || '';
                console.log('Configurazione AI caricata:', aiConfig.model);
                // If a model and API key exist, it likely doesn't need immediate config
                if (aiConfig.model !== 'none' && aiConfig.apiKey) {
                    needsConfig = false;
                }
            } else {
                console.log('Nessuna configurazione AI salvata trovata.');
                llmModelSelect.value = 'none'; apiKeyInput.value = '';
            }

            // Set AI Config collapsible state based on whether config is needed
            aiConfigSection?.classList.toggle('open', needsConfig);

        } catch (error) {
            console.error('Errore caricamento configurazione AI:', error);
            showStatus('Errore nel caricamento della configurazione AI.', 'error');
            aiConfigSection?.classList.add('open'); // Open on error to allow fixing
        }
    }

    saveAiConfigButton.addEventListener('click', async () => {
        // ... (validation as before) ...
        const selectedModel = llmModelSelect.value; const enteredApiKey = apiKeyInput.value.trim();
        if (selectedModel !== 'none' && !enteredApiKey) { showStatus('Inserisci la chiave API per il modello selezionato.', 'warning'); apiKeyInput.focus(); return; }
        if (selectedModel === 'none' && enteredApiKey) { showStatus('Seleziona un modello AI se inserisci una chiave API.', 'warning'); llmModelSelect.focus(); return; }
        aiConfig = { model: selectedModel, apiKey: enteredApiKey };
        try {
            await chrome.storage.local.set({ [AI_CONFIG_KEY]: aiConfig });
            showStatus('Configurazione AI salvata con successo!', 'success');
            console.log('Configurazione AI salvata:', aiConfig.model);
            // Collapse the section after successful save if it's properly configured
            if (aiConfig.model !== 'none' && aiConfig.apiKey) {
                 aiConfigSection?.classList.remove('open');
            }
        } catch (error) { /* ... error handling ... */ }
    });


    // --- Event Listeners for State Saving ---
    pageNameInput.addEventListener('input', saveSessionState);
    dataInput.addEventListener('input', saveSessionState);
    // Save state also after specific actions complete successfully
    // (Added in extractFormsButton, applySourceChangesButton, mapWithAiButton handlers)
    viewModeRadios.forEach(radio => radio.addEventListener('change', saveSessionState));


    // --- Event Listeners (Button Clicks etc.) ---

    // Gestione Cambio View Mode (Save State)
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            applySourceChangesButton.classList.toggle('hidden', this.value === 'preview');
            previewFrame.classList.toggle('hidden', this.value === 'source');
            htmlSourceTextarea.classList.toggle('hidden', this.value === 'preview');
            if (this.value === 'preview') {
                 previewFrame.srcdoc = currentHtmlContent || ''; // Use currentHtmlContent
            } else {
                 htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent || ''); // Use currentHtmlContent
            }
            saveSessionState(); // Save view mode change
        });
    });

    // Applica Modifiche Sorgente (Save State)
    applySourceChangesButton.addEventListener('click', () => {
        currentHtmlContent = cleanHtmlFromTextareaFormatting(htmlSourceTextarea.value); // Update in-memory HTML
        previewFrame.srcdoc = currentHtmlContent;
        htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent);
        showStatus('Modifiche al codice sorgente applicate e visualizzate nell\'anteprima.', 'success');
        saveSessionState(); // Save the updated HTML content
    });

    // Estrazione Form (Save State on Success)
    extractFormsButton.addEventListener('click', async () => {
        showStatus('Estrazione forms in corso...', 'info', 0);
        // Reset relevant states before extraction
        currentHtmlContent = null;
        previewFrame.srcdoc = '<p style="padding:10px; color:gray;">Estrazione in corso...</p>';
        htmlSourceTextarea.value = ''; copyButton.disabled = true; saveButton.disabled = true;
        aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true;
        document.querySelector('input[name="viewMode"][value="preview"]').checked = true; // Default to preview
        previewFrame.classList.remove('hidden'); htmlSourceTextarea.classList.add('hidden'); applySourceChangesButton.classList.add('hidden');
        // Don't reset pageNameInput here, let session restore handle it or user input
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) { /* ... error handling ... */ return; }
        if (!pageNameInput.value && tab.title) { pageNameInput.value = sanitizeFilenameForSave(tab.title); saveSessionState(); /* Save suggested name */ }
        else if (!pageNameInput.value) { pageNameInput.value = 'pagina_estratta'; saveSessionState(); /* Save default name */ }
        try {
            const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.extractAndSimplifyForms_content() });
            if (results && results[0] && typeof results[0].result === 'string') {
                currentHtmlContent = results[0].result; // Update in-memory HTML
                previewFrame.srcdoc = currentHtmlContent;
                if (currentHtmlContent.includes("<p style=\"padding:10px; color:gray;\">Nessun tag <form>")) { /* ... status ... */ }
                else if (currentHtmlContent.trim() === '' || (currentHtmlContent.includes("<!-- Form originale") && !currentHtmlContent.includes("<form")) ) { /* ... status ... */ }
                else { showStatus('Estrazione form completata!', 'success'); copyButton.disabled = false; saveButton.disabled = false; }
                saveSessionState(); // <-- SAVE STATE ON SUCCESS
            } else { /* ... error handling ... */ }
        } catch (error) { /* ... error handling ... */ }
    });

    // Caricamento Dati JSON (Save State)
    loadDataButton.addEventListener('click', () => { dataFileInput.click(); });
    dataFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        if (!file.name.endsWith('.json') && file.type !== 'application/json') { /* ... error ... */ return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                JSON.parse(content); // Validate JSON
                dataInput.value = content; // Update textarea
                showStatus(`File "${file.name}" caricato.`, 'success');
                aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true; // Reset AI output
                saveSessionState(); // <-- SAVE STATE AFTER LOADING DATA
            } catch (jsonError) { /* ... error ... */ }
        };
        reader.onerror = (e) => { /* ... error ... */ };
        reader.readAsText(file); event.target.value = null;
    });

     // Mappa con AI (Save State on Success)
    mapWithAiButton.addEventListener('click', async () => {
        // 1. Validation
        if (aiConfig.model === 'none' || !aiConfig.apiKey) { /* ... error ... */ return; }
        if (!currentHtmlContent || currentHtmlContent.trim() === '') { /* ... error ... */ return; }
        const inputJsonString = dataInput.value.trim(); if (!inputJsonString) { /* ... error ... */ return; }
        try { const p = JSON.parse(inputJsonString); if (!Array.isArray(p)) throw new Error("Input non è array."); } catch (error) { /* ... error ... */ return; }

        // 2. Prep & Call
        showStatus(`Invio dati a ${aiConfig.model}...`, 'info', 0);
        aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true; mapWithAiButton.disabled = true;
        try {
            const prompt = createMappingPrompt(currentHtmlContent, inputJsonString);
            let llmResponseString = ''; const selectedModel = aiConfig.model; const apiKey = aiConfig.apiKey;
            console.log(`Chiamata a ${selectedModel}.`); // Simplified log

            if (selectedModel.startsWith('gemini-') || selectedModel.startsWith('gemma-')) {
                llmResponseString = await callGoogleApi(selectedModel, prompt, apiKey);
            } else if (selectedModel.startsWith('openai-')) {
                const openAiModelName = selectedModel.substring('openai-'.length);
                llmResponseString = await callOpenAiApi(openAiModelName, prompt, apiKey);
            } else { throw new Error('Modello AI non supportato.'); }

            console.log(`Risposta grezza da ${selectedModel}.`); // Simplified log

            // 3. Handle Response
            const suggestedMappingJson = extractJsonFromString(llmResponseString);
            if (!suggestedMappingJson) { throw new Error(`AI (${selectedModel}) no JSON valido.`); }

            // 4. Validate Format
             if (!Array.isArray(suggestedMappingJson)) { throw new Error(`Output AI (${selectedModel}) non array.`); }
             const isValidFormat = suggestedMappingJson.every(item => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'valore' in item );
             if (!isValidFormat) { throw new Error(`Formato oggetti AI (${selectedModel}) errato.`); }

            // 5. Show Result & Save State
            aiOutputTextarea.value = JSON.stringify(suggestedMappingJson, null, 2); // Update textarea
            aiOutputContainer.classList.remove('hidden'); // Show container
            assignAiValuesButton.disabled = false; // Enable button
            showStatus(`Mapping da ${selectedModel} completato.`, 'success');
            aiOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            saveSessionState(); // <-- SAVE STATE ON SUCCESS

        } catch (error) {
            console.error(`Errore mapping AI (${aiConfig.model}):`, error);
            showStatus(`Errore Mapping AI (${aiConfig.model}): ${error.message}`, 'error', 10000);
            aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true;
        } finally { mapWithAiButton.disabled = false; }
    });


    // --- Altri Event Listener (Assign, Copy, Save - non modificano lo stato della sessione direttamente) ---
    assignValuesButton.addEventListener('click', async () => { /* ... uses dataInput.value ... */
         const jsonDataString = dataInput.value.trim(); if (!jsonDataString) { showStatus('Area dati JSON Input vuota.', 'warning'); return; }
         let parsedData; try { parsedData = JSON.parse(jsonDataString); } catch (error) { showStatus(`Errore parsing JSON Input: ${error.message}`, 'error', 7000); return; }
         await assignValuesToPage(parsedData);
    });
    assignAiValuesButton.addEventListener('click', async () => { /* ... uses aiOutputTextarea.value ... */
        const aiJsonString = aiOutputTextarea.value.trim(); if (!aiJsonString) { showStatus('Nessun mapping AI da assegnare.', 'warning'); return; }
        let parsedAiData; try { parsedAiData = JSON.parse(aiJsonString); } catch (error) { showStatus(`Errore parsing JSON AI: ${error.message}`, 'error', 7000); return; }
        await assignValuesToPage(parsedAiData);
    });
    copyButton.addEventListener('click', () => { /* ... uses currentHtmlContent or htmlSourceTextarea.value ... */
        const isSourceView = !htmlSourceTextarea.classList.contains('hidden'); const contentToCopy = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || ''); if (contentToCopy && !copyButton.disabled) { navigator.clipboard.writeText(contentToCopy).then(() => showStatus('HTML copiato!', 'success')).catch(err => { showStatus('Errore copia.', 'error'); console.error('Errore copia:', err); try { const ta = document.createElement('textarea'); ta.value = contentToCopy; ta.style.position = 'fixed'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showStatus('HTML copiato (fallback)!', 'success'); } catch (e) { showStatus('Copia fallita.', 'error'); } }); } else { showStatus('Nessun HTML da copiare.', 'info'); }
    });
    saveButton.addEventListener('click', () => { /* ... uses currentHtmlContent or htmlSourceTextarea.value ... */
        const isSourceView = !htmlSourceTextarea.classList.contains('hidden'); const contentToSave = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || ''); if (contentToSave && !saveButton.disabled) { const pageName = pageNameInput.value.trim() || 'extracted_forms'; const filename = sanitizeFilenameForSave(pageName) + '.html'; const fileContent = `<!DOCTYPE html>...${contentToSave}...</html>`; /* (Full template as before) */ const blob = new Blob([fileContent], { type: 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); chrome.downloads.download({ url: url, filename: filename, saveAs: true }, (downloadId) => { if (chrome.runtime.lastError) { console.error("Download failed:", chrome.runtime.lastError); showStatus(`Errore salvataggio: ${chrome.runtime.lastError.message}`, 'error'); try { const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); showStatus(`File "${filename}" pronto (fallback).`, 'warning', 7000); } catch(e) { showStatus('Salvataggio fallito (fallback).', 'error'); URL.revokeObjectURL(url); } } else if (downloadId) { showStatus(`Download "${filename}" avviato.`, 'success'); URL.revokeObjectURL(url); } else { showStatus(`Download "${filename}" non avviato.`, 'warning', 7000); URL.revokeObjectURL(url); } }); } else { showStatus('Nessun HTML da salvare.', 'info'); }
    });


    // --- Inizializzazione ---
    setupCollapsibles(); // Set up click handlers for toggles
    loadAiConfig(); // Carica config AI (che ora imposta anche lo stato open/closed di default)
    loadSessionState(); // Carica stato sessione dopo aver impostato i collapsible

}); // End DOMContentLoaded