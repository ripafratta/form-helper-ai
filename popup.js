document.addEventListener('DOMContentLoaded', function() {
    // ... (elementi UI come prima) ...
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

    let rawExtractedHtml = null; 
    let currentHtmlContent = null; // Conterrà HTML "pulito" senza formattazione da textarea

    // --- Funzione per mostrare messaggi di stato ---
    function showStatus(message, type = 'info', duration = 5000) {
        statusMessage.textContent = message;
        statusMessage.className = ''; 
        statusMessage.classList.add(`status-${type}`);
        if (message && duration > 0) {
            setTimeout(() => {
                if (statusMessage.textContent === message) {
                    statusMessage.textContent = '';
                    statusMessage.className = '';
                }
            }, duration);
        }
    }

    // --- Funzione per sanitizzare il nome del file ---
    function sanitizeFilenameForSave(name) {
        let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim();
        sanitized = sanitized.substring(0, 100);
        if (!sanitized) sanitized = 'extracted_forms';
        return sanitized;
    }
    
    // --- Funzione per PULIRE l'HTML dalla formattazione della textarea ---
    function cleanHtmlFromTextareaFormatting(htmlString) {
        if (!htmlString) return '';
        // Rimuove indentazione iniziale di ogni riga e newline multipli
        const lines = htmlString.split('\n');
        const cleanedLines = lines.map(line => line.trimStart()); // Rimuove solo spazi iniziali
        let cleanedHtml = cleanedLines.join('\n'); // Ricompone con \n singoli
        // Rimuove newline multipli, lasciandone al massimo uno (o nessuno se erano solo spazi)
        cleanedHtml = cleanedHtml.replace(/\n\s*\n/g, '\n'); 
        return cleanedHtml.trim(); // Rimuove newline iniziali/finali
    }


    // --- Funzione per formattare l'HTML per la textarea ---
    function formatHtmlForTextarea(htmlString) {
        if (!htmlString) return '';
        
        let formatted = htmlString.replace(/<(?!(--|!DOCTYPE))(\/?)([a-zA-Z0-9\-_:]+)/g, '\n<$2$3');
        
        // Rimuove newline multipli, lasciandone al massimo UNO.
        formatted = formatted.replace(/\n\s*\n+/g, '\n'); // Aggressivo sui newline
        
        if (formatted.startsWith('\n')) {
            formatted = formatted.substring(1);
        }

        const lines = formatted.split('\n');
        let indentLevel = 0;
        const indentSize = 2; 
        const formattedLines = lines.map(line => {
            let trimmedLine = line.trim(); // Trimmare qui è importante per la logica di indentazione
            
            if (trimmedLine.startsWith('</') && 
                !trimmedLine.startsWith('</input') && 
                !trimmedLine.startsWith('</br') &&
                !trimmedLine.startsWith('</hr') &&
                !trimmedLine.startsWith('</img') &&
                !trimmedLine.startsWith('</meta') &&
                !trimmedLine.startsWith('</link') &&
                !trimmedLine.startsWith('</option') 
                ) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            let indentedLine = ' '.repeat(indentLevel * indentSize) + trimmedLine;
            
            if (trimmedLine.startsWith('<') && 
                !trimmedLine.startsWith('</') && 
                !trimmedLine.endsWith('/>') && 
                trimmedLine !== '<br>' && 
                trimmedLine !== '<hr>' && 
                !trimmedLine.startsWith('<input') && 
                !trimmedLine.startsWith('<img') &&
                !trimmedLine.startsWith('<meta') &&
                !trimmedLine.startsWith('<link') &&
                !trimmedLine.startsWith('<!--') &&
                !trimmedLine.startsWith('<!DOCTYPE') &&
                !trimmedLine.startsWith('<option')
                ) {
                indentLevel++;
            }
            return indentedLine;
        });

        return formattedLines.join('\n');
    }

    // --- Gestione cambio modalità visualizzazione (Anteprima/Sorgente) ---
    viewModeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'preview') {
                previewFrame.classList.remove('hidden');
                htmlSourceTextarea.classList.add('hidden');
                applySourceChangesButton.classList.add('hidden');
                // L'anteprima usa sempre currentHtmlContent (che è pulito)
                previewFrame.srcdoc = currentHtmlContent || rawExtractedHtml || '';
            } else { // Modalità sorgente
                previewFrame.classList.add('hidden');
                htmlSourceTextarea.classList.remove('hidden');
                applySourceChangesButton.classList.remove('hidden');
                // Formatta currentHtmlContent (pulito) per la visualizzazione nella textarea
                const contentForTextarea = currentHtmlContent || rawExtractedHtml || '';
                htmlSourceTextarea.value = formatHtmlForTextarea(contentForTextarea);
            }
        });
    });

    applySourceChangesButton.addEventListener('click', () => {
        // Pulisci l'HTML dalla textarea prima di salvarlo in currentHtmlContent
        currentHtmlContent = cleanHtmlFromTextareaFormatting(htmlSourceTextarea.value); 
        // Aggiorna l'anteprima con l'HTML pulito
        previewFrame.srcdoc = currentHtmlContent;
        // Riformatta per la textarea, così l'utente vede il risultato della pulizia + formattazione
        htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent);
        showStatus('Modifiche al codice sorgente applicate.', 'success');
    });


    // --- Estrazione Form ---
    extractFormsButton.addEventListener('click', async () => {
        showStatus('Estrazione forms in corso...', 'info', 0);
        rawExtractedHtml = null;
        currentHtmlContent = null; // Questo sarà l'HTML pulito
        previewFrame.srcdoc = '<p style="padding:10px; color:gray;">Estrazione in corso...</p>';
        htmlSourceTextarea.value = ''; // La textarea sarà formattata
        copyButton.disabled = true;
        saveButton.disabled = true;
        document.querySelector('input[name="viewMode"][value="preview"]').checked = true;
        previewFrame.classList.remove('hidden');
        htmlSourceTextarea.classList.add('hidden');
        applySourceChangesButton.classList.add('hidden');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            showStatus('Impossibile accedere alla scheda attiva.', 'error');
            previewFrame.srcdoc = '<p style="padding:10px; color:red;">Errore: Impossibile accedere alla scheda attiva.</p>';
            return;
        }

        if (!pageNameInput.value && tab.title) {
            pageNameInput.value = sanitizeFilenameForSave(tab.title);
        } else if (!pageNameInput.value) {
            pageNameInput.value = 'pagina_estratta';
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.extractAndSimplifyForms_content()
            });

            if (results && results[0] && typeof results[0].result === 'string') {
                rawExtractedHtml = results[0].result; // HTML originale come estratto
                currentHtmlContent = rawExtractedHtml; // Inizialmente, current è uguale a raw (non formattato)

                previewFrame.srcdoc = currentHtmlContent; // Anteprima usa HTML non formattato
                htmlSourceTextarea.value = formatHtmlForTextarea(currentHtmlContent); // Textarea mostra versione formattata

                if (currentHtmlContent.includes("<p style=\"padding:10px; color:gray;\">Nessun tag <form>")) {
                    showStatus('Nessun form trovato sulla pagina.', 'info');
                } else if (currentHtmlContent.trim() === '' || (currentHtmlContent.includes("<!-- Form originale") && !currentHtmlContent.includes("<form")) ) {
                    showStatus('Nessun form valido o contenuto estraibile trovato.', 'info');
                } else {
                    showStatus('Estrazione form completata!', 'success');
                    copyButton.disabled = false;
                    saveButton.disabled = false;
                }
            } else {
                const errorMsgText = 'Errore sconosciuto o nessun risultato stringa restituito.';
                previewFrame.srcdoc = `<p style="padding:10px; color:gray;">${errorMsgText}</p>`;
                htmlSourceTextarea.value = formatHtmlForTextarea(errorMsgText);
                showStatus('Errore durante l\'estrazione dei forms.', 'error');
            }
        } catch (error) {
            console.error('Errore popup.js - estrazione forms:', error);
            const errorMsg = `Errore script: ${error.message}`;
            const errorMsgHtml = `<p style="padding:10px; color:red;">${errorMsg}</p>`;
            previewFrame.srcdoc = errorMsgHtml;
            htmlSourceTextarea.value = formatHtmlForTextarea(errorMsgHtml);
            showStatus(`Errore estrazione: ${error.message}`, 'error');
        }
    });

    // --- Azioni sull'HTML (Copia, Salva) ---
    copyButton.addEventListener('click', () => {
        // Se la textarea è visibile, copia il suo contenuto (che è formattato).
        // Altrimenti, copia currentHtmlContent (che è pulito) ma formattalo per la copia.
        const contentToCopy = !htmlSourceTextarea.classList.contains('hidden') 
                              ? htmlSourceTextarea.value 
                              : formatHtmlForTextarea(currentHtmlContent || ''); 

        if (contentToCopy && !copyButton.disabled) {
            navigator.clipboard.writeText(contentToCopy)
                .then(() => showStatus('HTML copiato negli appunti!', 'success'))
                .catch(err => {
                    showStatus('Errore durante la copia dell\'HTML.', 'error');
                    console.error('Errore copia HTML:', err);
                    try { 
                        const textarea = document.createElement('textarea');
                        textarea.value = contentToCopy;
                        textarea.style.position = 'fixed'; document.body.appendChild(textarea);
                        textarea.select(); document.execCommand('copy'); document.body.removeChild(textarea);
                        showStatus('HTML copiato (fallback)!', 'success');
                    } catch (e) { showStatus('Copia fallita.', 'true'); }
                });
        } else {
            showStatus('Nessun HTML da copiare.', 'info');
        }
    });

    saveButton.addEventListener('click', () => {
        // Se la textarea è visibile, usa il suo contenuto (formattato).
        // Altrimenti, formatta currentHtmlContent (pulito) per il salvataggio.
        // Questo assicura che il file salvato sia sempre leggibile/formattato.
        const contentToSave = !htmlSourceTextarea.classList.contains('hidden') 
                              ? htmlSourceTextarea.value 
                              : formatHtmlForTextarea(currentHtmlContent || ''); 

        if (contentToSave && !saveButton.disabled) {
            const pageName = pageNameInput.value.trim() || 'extracted_forms';
            const filename = sanitizeFilenameForSave(pageName) + '.html';
            // Il template HTML per il salvataggio ora riceverà 'contentToSave' che è già formattato
            const fileContent = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 20px; margin:0; background-color: #f4f4f4; color: #333; }
    .form-container-wrapper > h3 { 
        color: #3498db; margin-top: 20px; border-bottom: 1px solid #eee; 
        padding-bottom: 8px; margin-bottom: 15px; 
    }
    .form-container-wrapper > h3:first-child {
        margin-top: 0;
    }
    .form-container-wrapper > form { 
        background-color: #fff; border: 1px solid #ddd; border-radius: 8px; 
        padding: 20px; margin-bottom: 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
    }
    h2.main-title { text-align: center; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 30px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
    input[type="text"], input[type="email"], input[type="password"], input[type="url"],
    input[type="tel"], input[type="number"], input[type="date"], input[type="time"],
    input[type="search"], textarea, select {
      width: calc(100% - 22px); padding: 10px; margin-bottom: 15px; border: 1px solid #ccc;
      border-radius: 4px; box-sizing: border-box; font-size: 1em;
    }
    input[type="checkbox"], input[type="radio"] { margin-right: 8px; vertical-align: middle; }
    label > input[type="checkbox"], label > input[type="radio"] { margin-bottom: 0; }
    fieldset { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
    legend { font-weight: bold; color: #3498db; padding: 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #eee; padding: 8px; text-align: left; }
    th { background-color: #f9f9f9; }
    hr { margin: 30px 0; border: 0; border-top: 2px dashed #ccc; }
  </style>
</head>
<body>
  <h2 class="main-title">${pageName.replace(/</g, "<").replace(/>/g, ">")} - Forms Estratti</h2>
  <div class="form-container-wrapper">
    ${contentToSave} 
  </div>
</body>
</html>`;
            const blob = new Blob([fileContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({ url: url, filename: filename, saveAs: true }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    showStatus(`Errore salvataggio: ${chrome.runtime.lastError.message}`, 'error');
                    const a = document.createElement('a'); a.href = url; a.download = filename;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showStatus(`File "${filename}" salvato (fallback).`, 'success');
                } else {
                    showStatus(`Download di "${filename}" avviato.`, 'success');
                }
            });
        } else {
            showStatus('Nessun HTML da salvare.', 'info');
        }
    });

    // --- Caricamento Dati JSON e Assegnazione Valori ---
    // ... (invariato) ...
    loadDataButton.addEventListener('click', () => {
        dataFileInput.click(); 
    });

    dataFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.name.endsWith('.json') && file.type !== 'application/json') {
            showStatus('Seleziona un file JSON (.json).', 'error');
            dataInput.value = ''; event.target.value = null; return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            dataInput.value = e.target.result;
            showStatus('File JSON caricato.', 'success');
        };
        reader.onerror = (e) => {
            showStatus('Errore lettura file JSON.', 'error'); dataInput.value = '';
        };
        reader.readAsText(file);
        event.target.value = null;
    });

    assignValuesButton.addEventListener('click', async () => {
        const jsonDataString = dataInput.value.trim();
        if (!jsonDataString) {
            showStatus('Area dati JSON vuota.', 'error'); return;
        }
        let parsedData;
        try {
            parsedData = JSON.parse(jsonDataString);
            if (!Array.isArray(parsedData) || !parsedData.every(item => typeof item === 'object' && item !== null && 'id' in item && 'valore' in item)) {
                showStatus('Formato JSON non valido.', 'error', 7000); return;
            }
        } catch (error) {
            showStatus(`Errore parsing JSON: ${error.message}`, 'error', 7000); return;
        }
        if (parsedData.length === 0) {
            showStatus('Nessun dato JSON valido.', 'info'); return;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            showStatus('Scheda attiva non trovata.', 'error'); return;
        }
        showStatus('Assegnazione valori...', 'info', 0);
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (data) => window.assignFormValuesInPage(data),
                args: [parsedData]
            });
            if (results && results[0] && results[0].result) {
                const { assignmentsCount, notFoundCount, errorMessages } = results[0].result;
                let statusMsg = `Valori assegnati: ${assignmentsCount}. Non trovati/Errori: ${notFoundCount}.`;
                if (errorMessages && errorMessages.length > 0) console.warn("Errori assegnazione:", errorMessages);
                showStatus(statusMsg, assignmentsCount > 0 && notFoundCount === 0 ? 'success' : (assignmentsCount > 0 ? 'info' : 'error'), 7000);
            } else {
                showStatus('Risultato inatteso dall\'assegnazione.', 'warning', 7000);
            }
        } catch (error) {
            showStatus(`Errore assegnazione: ${error.message}`, 'error');
        }
    });
});