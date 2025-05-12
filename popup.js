document.addEventListener('DOMContentLoaded', function() {
    // --- Elementi UI Esistenti ---
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
    const dataInput = document.getElementById('dataInput'); // Textarea per JSON input/manuale
    const assignValuesButton = document.getElementById('assignValuesButton'); // Bottone assegnazione da JSON input
    const statusMessage = document.getElementById('statusMessage');

    // --- Elementi UI Nuovi/Modificati per AI ---
    const aiConfigContainer = document.getElementById('aiConfigContainer');
    const llmModelSelect = document.getElementById('llmModelSelect'); 
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveAiConfigButton = document.getElementById('saveAiConfigButton');
    const mapWithAiButton = document.getElementById('mapWithAiButton');
    const aiOutputContainer = document.getElementById('aiOutputContainer');
    const aiOutputTextarea = document.getElementById('aiOutputTextarea');
    const assignAiValuesButton = document.getElementById('assignAiValuesButton');

    // --- Stato Interno ---
    let rawExtractedHtml = null;
    let currentHtmlContent = null; 
    let aiConfig = { model: 'none', apiKey: '' }; 
    const AI_CONFIG_KEY = 'ai_config_v2'; // Key per storage

    // --- Funzioni Helper Esistenti (showStatus, sanitizeFilenameForSave, cleanHtmlFromTextareaFormatting, formatHtmlForTextarea) ---
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
         statusMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            if (formatted.startsWith('\n')) { formatted = formatted.substring(1); }
            const lines = formatted.split('\n');
            let indentLevel = 0;
            const indentSize = 2;
            const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
            const formattedLines = lines.map(line => {
                let trimmedLine = line.trim();
                if (!trimmedLine) return '';
                if (trimmedLine.startsWith('</')) { if (indentLevel > 0) { indentLevel--; } }
                let indentedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine;
                if (trimmedLine.startsWith('<') && !trimmedLine.startsWith('</') && !trimmedLine.endsWith('/>')) {
                    const tagNameMatch = trimmedLine.match(/^<([a-zA-Z0-9\-_:]+)/);
                     if (tagNameMatch && !voidElements.has(tagNameMatch[1].toLowerCase()) && !trimmedLine.startsWith('<!--') && !trimmedLine.startsWith('<!DOCTYPE')) { indentLevel++; }
                }
                return indentedLine;
            });
            return formattedLines.join('\n').trim();
        } catch (e) { console.warn("HTML formatting failed, returning original string.", e); return htmlString; }
     }

    // --- Gestione Cambio View Mode ---
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            applySourceChangesButton.classList.toggle('hidden', this.value === 'preview');
            previewFrame.classList.toggle('hidden', this.value === 'source');
            htmlSourceTextarea.classList.toggle('hidden', this.value === 'preview');
            if (this.value === 'preview') {
                 previewFrame.srcdoc = currentHtmlContent || rawExtractedHtml || '';
            } else {
                 const contentForTextarea = currentHtmlContent || rawExtractedHtml || '';
                 htmlSourceTextarea.value = formatHtmlForTextarea(contentForTextarea);
            }
        });
    });

    // --- Applica Modifiche Sorgente ---
    applySourceChangesButton.addEventListener('click', () => {
        currentHtmlContent = cleanHtmlFromTextareaFormatting(htmlSourceTextarea.value);
        previewFrame.srcdoc = currentHtmlContent;
        htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent);
        showStatus('Modifiche al codice sorgente applicate e visualizzate nell\'anteprima.', 'success');
    });

    // --- Estrazione Form ---
    extractFormsButton.addEventListener('click', async () => {
        showStatus('Estrazione forms in corso...', 'info', 0); 
        rawExtractedHtml = null; currentHtmlContent = null;
        previewFrame.srcdoc = '<p style="padding:10px; color:gray;">Estrazione in corso...</p>';
        htmlSourceTextarea.value = ''; copyButton.disabled = true; saveButton.disabled = true;
        aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true;
        document.querySelector('input[name="viewMode"][value="preview"]').checked = true;
        previewFrame.classList.remove('hidden'); htmlSourceTextarea.classList.add('hidden'); applySourceChangesButton.classList.add('hidden');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) { showStatus('Impossibile accedere alla scheda attiva.', 'error'); previewFrame.srcdoc = '<p style="padding:10px; color:red;">Errore: Impossibile accedere alla scheda attiva.</p>'; return; }
        if (!pageNameInput.value && tab.title) { pageNameInput.value = sanitizeFilenameForSave(tab.title); } else if (!pageNameInput.value) { pageNameInput.value = 'pagina_estratta'; }
        try {
            const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.extractAndSimplifyForms_content() });
            if (results && results[0] && typeof results[0].result === 'string') {
                rawExtractedHtml = results[0].result; currentHtmlContent = rawExtractedHtml;
                previewFrame.srcdoc = currentHtmlContent;
                if (currentHtmlContent.includes("<p style=\"padding:10px; color:gray;\">Nessun tag <form>")) { showStatus('Nessun form trovato sulla pagina.', 'info'); }
                else if (currentHtmlContent.trim() === '' || (currentHtmlContent.includes("<!-- Form originale") && !currentHtmlContent.includes("<form")) ) { showStatus('Nessun form valido o contenuto estraibile trovato.', 'info'); previewFrame.srcdoc = '<p style="padding:10px; color:gray;">Nessun form valido o contenuto estraibile trovato.</p>'; }
                else { showStatus('Estrazione form completata!', 'success'); copyButton.disabled = false; saveButton.disabled = false; }
            } else { const errorMsgText = `Estrazione fallita. Risultato inatteso: ${JSON.stringify(results)}`; console.error(errorMsgText); previewFrame.srcdoc = `<p style="padding:10px; color:red;">${errorMsgText}</p>`; htmlSourceTextarea.value = ''; showStatus('Errore durante l\'estrazione dei forms.', 'error'); }
        } catch (error) { console.error('Errore popup.js - estrazione forms:', error); const errorMsg = `Errore script estrazione: ${error.message}`; const errorMsgHtml = `<p style="padding:10px; color:red;">${errorMsg}</p>`; previewFrame.srcdoc = errorMsgHtml; htmlSourceTextarea.value = ''; showStatus(`Errore estrazione: ${error.message}`, 'error'); }
    });

    // --- Azioni sull'HTML (Copia, Salva) ---
    copyButton.addEventListener('click', () => {
        const isSourceView = !htmlSourceTextarea.classList.contains('hidden');
        const contentToCopy = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || '');
        if (contentToCopy && !copyButton.disabled) {
            navigator.clipboard.writeText(contentToCopy)
                .then(() => showStatus('HTML copiato negli appunti!', 'success'))
                .catch(err => { showStatus('Errore durante la copia dell\'HTML.', 'error'); console.error('Errore copia HTML:', err); try { const ta = document.createElement('textarea'); ta.value = contentToCopy; ta.style.position = 'fixed'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showStatus('HTML copiato (fallback)!', 'success'); } catch (e) { showStatus('Copia fallita.', 'error'); } });
        } else { showStatus('Nessun HTML da copiare.', 'info'); }
    });

    saveButton.addEventListener('click', () => {
        const isSourceView = !htmlSourceTextarea.classList.contains('hidden');
        const contentToSave = isSourceView ? htmlSourceTextarea.value : formatHtmlForTextarea(currentHtmlContent || '');
        if (contentToSave && !saveButton.disabled) {
            const pageName = pageNameInput.value.trim() || 'extracted_forms';
            const filename = sanitizeFilenameForSave(pageName) + '.html';
            const fileContent = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</title>
<style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 20px; margin:0; background-color: #f4f4f4; color: #333; } .form-container-wrapper > h3 { color: #3498db; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 15px; } .form-container-wrapper > h3:first-of-type { margin-top: 0; } .form-container-wrapper > form { background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); } h2.main-title { text-align: center; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 30px; } label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; } input[type="text"], input[type="email"], input[type="password"], input[type="url"], input[type="tel"], input[type="number"], input[type="date"], input[type="time"], input[type="search"], textarea, select { display: block; width: 95%; max-width: 500px; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1em; } input[type="checkbox"], input[type="radio"] { margin-right: 8px; vertical-align: middle; margin-bottom: 10px;} label > input[type="checkbox"], label > input[type="radio"] { margin-bottom: 0; display: inline-block; width: auto; } fieldset { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 4px; } legend { font-weight: bold; color: #3498db; padding: 0 10px; margin-left: 5px; } table { width: 100%; border-collapse: collapse; margin-bottom: 15px; } th, td { border: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; } th { background-color: #f0f0f0; font-weight: bold; } hr { margin: 30px 0; border: 0; border-top: 2px dashed #ccc; } td div, td span, td p { margin-bottom: 5px; } label + input, label + select, label + textarea { margin-top: 2px; }</style>
</head><body><h2 class="main-title">${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</h2>
<div class="form-container-wrapper">${contentToSave}</div></body></html>`;
            const blob = new Blob([fileContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({ url: url, filename: filename, saveAs: true }, (downloadId) => {
                if (chrome.runtime.lastError) { console.error("Download failed:", chrome.runtime.lastError); showStatus(`Errore salvataggio: ${chrome.runtime.lastError.message}`, 'error'); try { const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); showStatus(`File "${filename}" pronto per il download (fallback).`, 'warning', 7000); } catch(e) { showStatus('Salvataggio fallito anche con fallback.', 'error'); URL.revokeObjectURL(url); } }
                else if (downloadId) { showStatus(`Download di "${filename}" avviato.`, 'success'); URL.revokeObjectURL(url); }
                else { showStatus(`Download di "${filename}" non avviato. Controlla le impostazioni del browser.`, 'warning', 7000); URL.revokeObjectURL(url); }
            });
        } else { showStatus('Nessun HTML da salvare.', 'info'); }
    });

    // --- Caricamento Dati JSON e Assegnazione Valori (Esistente) ---
    loadDataButton.addEventListener('click', () => { dataFileInput.click(); });
    dataFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        if (!file.name.endsWith('.json') && file.type !== 'application/json') { showStatus('Errore: Seleziona un file JSON valido (.json).', 'error'); dataInput.value = ''; event.target.value = null; return; }
        const reader = new FileReader();
        reader.onload = (e) => { try { JSON.parse(e.target.result); dataInput.value = e.target.result; showStatus(`File "${file.name}" caricato con successo.`, 'success'); aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true; } catch (jsonError) { showStatus(`Errore: Il file "${file.name}" non contiene JSON valido. ${jsonError.message}`, 'error', 7000); dataInput.value = ''; } };
        reader.onerror = (e) => { showStatus(`Errore durante la lettura del file "${file.name}".`, 'error'); dataInput.value = ''; };
        reader.readAsText(file); event.target.value = null;
    });

    // --- Funzione Generica per Assegnare Valori ---
    async function assignValuesToPage(jsonData) {
        if (!Array.isArray(jsonData)) { showStatus('Errore interno: Dati per assegnazione non validi (non è un array).', 'error'); return; }
        if (jsonData.length === 0) { showStatus('Nessun dato valido da assegnare.', 'info'); return; }
        if (!jsonData.every(item => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'valore' in item)) { showStatus('Errore: Formato JSON per assegnazione non valido. Richiesto: [{"id": "stringa", "valore": "qualsiasi"}].', 'error', 7000); return; }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) { showStatus('Scheda attiva non trovata per l\'assegnazione.', 'error'); return; }
        showStatus('Assegnazione valori in corso nella pagina...', 'info', 0);
        try {
            const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (dataToAssign) => { if (typeof window.assignFormValuesInPage === 'function') { return window.assignFormValuesInPage(dataToAssign); } else { console.error("Content script function 'assignFormValuesInPage' not found."); return { assignmentsCount: 0, notFoundCount: dataToAssign.length, errorMessages: ["Funzione 'assignFormValuesInPage' non trovata nel content script."] }; } }, args: [jsonData] });
            if (results && results[0] && results[0].result) {
                const { assignmentsCount, notFoundCount, errorMessages } = results[0].result;
                let statusMsg = `Assegnazione completata. Campi compilati: ${assignmentsCount}. Non trovati/Errori: ${notFoundCount}.`;
                let statusType = 'info';
                if (assignmentsCount > 0 && notFoundCount === 0) statusType = 'success';
                else if (assignmentsCount > 0 && notFoundCount > 0) { statusType = 'warning'; statusMsg += " Alcuni campi non trovati o con errori."; }
                else if (assignmentsCount === 0 && notFoundCount > 0) { statusType = 'error'; statusMsg = `Assegnazione fallita. Nessun campo trovato o compilato. Errori/Non Trovati: ${notFoundCount}.`; }
                if (errorMessages && errorMessages.length > 0) console.warn("Dettagli assegnazione (errori/non trovati):", errorMessages);
                showStatus(statusMsg, statusType, 7000);
            } else { console.error("Risultato inatteso dall'assegnazione:", results); showStatus('Risultato inatteso durante l\'assegnazione dei valori.', 'error'); }
        } catch (error) { console.error('Errore durante l\'iniezione dello script di assegnazione:', error); showStatus(`Errore script assegnazione: ${error.message}`, 'error'); }
    }

    // --- Event Listener per Assegnazione da JSON Input ---
    assignValuesButton.addEventListener('click', async () => {
        const jsonDataString = dataInput.value.trim(); if (!jsonDataString) { showStatus('Area dati JSON Input vuota. Incolla o carica dati.', 'warning'); return; }
        let parsedData; try { parsedData = JSON.parse(jsonDataString); } catch (error) { showStatus(`Errore parsing JSON Input: ${error.message}`, 'error', 7000); return; }
        await assignValuesToPage(parsedData);
    });

    // --- Logica AI (Modificata per Modelli) ---

    // Carica configurazione AI all'avvio
    async function loadAiConfig() {
        try {
            const result = await chrome.storage.local.get(AI_CONFIG_KEY);
            if (result[AI_CONFIG_KEY]) {
                aiConfig = result[AI_CONFIG_KEY];
                if (Array.from(llmModelSelect.options).some(opt => opt.value === aiConfig.model)) { llmModelSelect.value = aiConfig.model; }
                else { llmModelSelect.value = 'none'; aiConfig.model = 'none'; }
                apiKeyInput.value = aiConfig.apiKey || '';
                console.log('Configurazione AI caricata:', aiConfig.model);
            } else { console.log('Nessuna configurazione AI salvata trovata.'); llmModelSelect.value = 'none'; apiKeyInput.value = ''; }
        } catch (error) { console.error('Errore caricamento configurazione AI:', error); showStatus('Errore nel caricamento della configurazione AI.', 'error'); }
    }

    // Salva configurazione AI
    saveAiConfigButton.addEventListener('click', async () => {
        const selectedModel = llmModelSelect.value; const enteredApiKey = apiKeyInput.value.trim();
        if (selectedModel !== 'none' && !enteredApiKey) { showStatus('Inserisci la chiave API per il modello selezionato.', 'warning'); apiKeyInput.focus(); return; }
        if (selectedModel === 'none' && enteredApiKey) { showStatus('Seleziona un modello AI se inserisci una chiave API.', 'warning'); llmModelSelect.focus(); return; }
        aiConfig = { model: selectedModel, apiKey: enteredApiKey };
        try { await chrome.storage.local.set({ [AI_CONFIG_KEY]: aiConfig }); showStatus('Configurazione AI salvata con successo!', 'success'); console.log('Configurazione AI salvata:', aiConfig.model); }
        catch (error) { console.error('Errore salvataggio configurazione AI:', error); showStatus(`Errore nel salvataggio della configurazione AI: ${error.message}`, 'error'); }
    });

    // Funzione per creare il prompt per l'LLM (CON BACKTICK ESCAPATI)
    function createMappingPrompt(htmlForm, inputJsonString) {
        let cleanedJsonString = inputJsonString; try { const parsed = JSON.parse(inputJsonString); cleanedJsonString = JSON.stringify(parsed, null, 2); } catch (e) { /* Ignora errore parsing */ }
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

    // Funzione per estrarre JSON da una stringa
    function extractJsonFromString(str) {
        if (!str) return null;
        const codeBlockMatch = str.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) { try { return JSON.parse(codeBlockMatch[1].trim()); } catch (e) { console.warn('Failed to parse JSON from code block, trying raw string.', e); } }
        try {
             const firstBracket = str.indexOf('['); const firstBrace = str.indexOf('{'); let startIndex = -1;
             if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) startIndex = firstBracket; else if (firstBrace !== -1) startIndex = firstBrace;
             if (startIndex !== -1) {
                 const lastBracket = str.lastIndexOf(']'); const lastBrace = str.lastIndexOf('}'); let endIndex = -1;
                 if (lastBracket !== -1 && (lastBrace === -1 || lastBracket > lastBrace)) endIndex = lastBracket; else if (lastBrace !== -1) endIndex = lastBrace;
                  if (endIndex !== -1 && endIndex >= startIndex) { const potentialJson = str.substring(startIndex, endIndex + 1); try { return JSON.parse(potentialJson); } catch (e) { console.warn("Failed to parse substring, trying full string", e);} }
             }
             return JSON.parse(str.trim());
        } catch (e) { console.error('Failed to parse JSON from string:', e); return null; }
    }

    // Chiamata API Google (Gemini e Gemma*)
    async function callGoogleApi(modelName, prompt, apiKey) {
        // Nota: Gemma potrebbe richiedere un endpoint/setup diverso da questo.
        const endpointHost = modelName.startsWith('gemma-')
            ? "generativelanguage.googleapis.com" // Placeholder - PROBABILMENTE ERRATO PER GEMMA, verificare documentazione ufficiale
            : "generativelanguage.googleapis.com"; // Endpoint standard Gemini
        const apiVersion = "v1beta"; // O altra versione se richiesta dal modello

        const API_URL = `https://${endpointHost}/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
        console.log(`Calling Google API (${modelName}):`, API_URL);

        const requestBody = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192 },
            // Potrebbe essere necessario aggiungere safetySettings specifici o rimuoverli
        };

        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

        if (!response.ok) {
            const errorBody = await response.text(); console.error(`Google API Error Response (${modelName}):`, errorBody);
            throw new Error(`Errore API Google (${modelName}): ${response.status} ${response.statusText}. Dettagli: ${errorBody}`);
        }
        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else if (data.candidates && data.candidates[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') {
             console.error(`Google generation stopped (${modelName}):`, data.candidates[0].finishReason, data); throw new Error(`Generazione Google (${modelName}) interrotta: ${data.candidates[0].finishReason}`);
         } else { console.error(`Struttura risposta Google inattesa (${modelName}):`, data); throw new Error(`Struttura risposta API Google (${modelName}) non valida.`); }
    }

    // Chiamata API OpenAI
    async function callOpenAiApi(modelName, prompt, apiKey) {
        const API_URL = 'https://api.openai.com/v1/chat/completions';
        console.log("Calling OpenAI API with model:", modelName);
        const requestBody = {
            model: modelName,
            messages: [ { role: "system", content: "Sei un assistente AI specializzato nell'analisi di form HTML e dati JSON per creare mapping semantici. Rispondi SOLO con l'array JSON richiesto, senza testo aggiuntivo." }, { role: "user", content: prompt } ],
        };
         // Richiede JSON se il modello lo supporta
         if (modelName.includes("gpt-4") || modelName.includes("1106") || modelName.includes("0125") || modelName.includes("gpt-4o")) { requestBody.response_format = { type: "json_object" }; console.log("Requesting JSON object format from OpenAI"); }
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorBody = await response.json(); console.error(`OpenAI API Error Response (${modelName}):`, errorBody); throw new Error(`Errore API OpenAI (${modelName}): ${response.status} ${response.statusText}. Dettagli: ${errorBody.error?.message || JSON.stringify(errorBody)}`); }
        const data = await response.json();
        if (data.choices && data.choices[0]?.message?.content) { return data.choices[0].message.content; }
        else { console.error(`Struttura risposta OpenAI inattesa (${modelName}):`, data); throw new Error(`Struttura risposta API OpenAI (${modelName}) non valida.`); }
    }

    // Event Listener per Mappare con AI
    mapWithAiButton.addEventListener('click', async () => {
        // 1. Validazione Input
        if (aiConfig.model === 'none' || !aiConfig.apiKey) { showStatus('Configurazione AI non valida. Seleziona modello e inserisci API Key.', 'warning', 7000); aiConfigContainer.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (aiConfig.model === 'none') llmModelSelect.focus(); else apiKeyInput.focus(); return; }
        if (!currentHtmlContent || currentHtmlContent.trim() === '') { showStatus('Nessun HTML del form estratto o modificato disponibile.', 'warning'); return; }
        const inputJsonString = dataInput.value.trim(); if (!inputJsonString) { showStatus('Area dati JSON Input vuota. Incolla o carica dati per il mapping.', 'warning'); dataInput.focus(); return; }
        let parsedInputData; try { parsedInputData = JSON.parse(inputJsonString); if (!Array.isArray(parsedInputData)) throw new Error("Il JSON di input non è un array."); } catch (error) { showStatus(`JSON Input non valido: ${error.message}`, 'error', 7000); dataInput.focus(); return; }

        // 2. Preparazione e Chiamata API
        showStatus(`Invio dati a ${aiConfig.model} per il mapping...`, 'info', 0);
        aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true; mapWithAiButton.disabled = true;
        try {
            const prompt = createMappingPrompt(currentHtmlContent, inputJsonString);
            let llmResponseString = '';
            const selectedModel = aiConfig.model; const apiKey = aiConfig.apiKey;
            console.log(`Chiamata a ${selectedModel} con prompt.`);

            // Determina il provider e chiama la funzione API corretta
            if (selectedModel.startsWith('gemini-') || selectedModel.startsWith('gemma-')) {
                // Usa la funzione generica Google (con l'avvertenza per Gemma)
                llmResponseString = await callGoogleApi(selectedModel, prompt, apiKey);
            } else if (selectedModel.startsWith('openai-')) {
                const openAiModelName = selectedModel.substring('openai-'.length);
                llmResponseString = await callOpenAiApi(openAiModelName, prompt, apiKey);
            } else { throw new Error('Modello AI non supportato o prefisso non riconosciuto.'); }

            console.log(`Risposta grezza da ${selectedModel}:`, llmResponseString);

            // 3. Gestione Risposta
            const suggestedMappingJson = extractJsonFromString(llmResponseString);
            if (!suggestedMappingJson) { throw new Error(`L'AI (${selectedModel}) non ha restituito un JSON valido. Risposta ricevuta:\n${llmResponseString}`); }

            // 4. Validazione formato output JSON
             if (!Array.isArray(suggestedMappingJson)) { throw new Error(`L'output dell'AI (${selectedModel}) non è un array JSON. Ricevuto: ${JSON.stringify(suggestedMappingJson)}`); }
             const isValidFormat = suggestedMappingJson.every(item => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string' && 'valore' in item );
             if (!isValidFormat) { throw new Error(`Gli oggetti JSON dell'AI (${selectedModel}) non hanno il formato {id: string, valore: any}. Ricevuto: ${JSON.stringify(suggestedMappingJson)}`); }

            // 5. Mostra Risultato
            aiOutputTextarea.value = JSON.stringify(suggestedMappingJson, null, 2);
            aiOutputContainer.classList.remove('hidden');
            assignAiValuesButton.disabled = false;
            showStatus(`Mapping da ${selectedModel} completato. Verifica il JSON suggerito.`, 'success');
            aiOutputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (error) {
            console.error(`Errore durante il mapping AI con ${aiConfig.model}:`, error);
            showStatus(`Errore Mapping AI (${aiConfig.model}): ${error.message}`, 'error', 10000);
            aiOutputContainer.classList.add('hidden'); aiOutputTextarea.value = ''; assignAiValuesButton.disabled = true;
        } finally { mapWithAiButton.disabled = false; }
    });

    // Event Listener per Assegnare Valori da Suggerimento AI
    assignAiValuesButton.addEventListener('click', async () => {
        const aiJsonString = aiOutputTextarea.value.trim(); if (!aiJsonString) { showStatus('Nessun mapping JSON suggerito dall\'AI da assegnare.', 'warning'); return; }
        let parsedAiData; try { parsedAiData = JSON.parse(aiJsonString); } catch (error) { showStatus(`Errore parsing JSON suggerito dall'AI: ${error.message}`, 'error', 7000); return; }
        await assignValuesToPage(parsedAiData);
    });

    // --- Inizializzazione ---
    loadAiConfig(); // Carica config AI all'apertura

}); // End DOMContentLoaded