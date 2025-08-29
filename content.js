// DOMPurify è caricato tramite manifest.json prima di questo script,
// anche se la nuova funzione di estrazione non lo usa direttamente.
// Potrebbe essere utile per altre funzionalità future o per sanitizzare input.

// === Funzione da Iniettare nella Pagina ===
// Questa funzione viene eseguita nel contesto della pagina web,
// NON nel contesto del popup. Non può accedere a variabili o funzioni del popup.js
function extractAndSimplifyForms_logic() {
    const simplifiedFormsHtml = [];
    const processedElements = new Set(); // Per tenere traccia degli elementi già processati

    // Funzione helper per copiare attributi essenziali
    function simplifyElement(originalElement, newElement) {
        const tagNameLower = originalElement.tagName.toLowerCase();

        const essentialAttrs = [
            'id', 'name', 'type', 'value', 'placeholder', 'required', 'checked',
            'selected', 'disabled', 'readonly', 'multiple', 'for', 'action', 'method',
            'min', 'max', 'step', 'pattern', 'title', 'aria-label', 'aria-labelledby',
            'aria-describedby', 'role'
        ];

        essentialAttrs.forEach(attr => {
            const attrValue = originalElement.getAttribute(attr);
            if (attr === 'id' || attr === 'name' || attr === 'placeholder' || attr === 'action' || attr === 'method' ||
                attr === 'min' || attr === 'max' || attr === 'step' || attr === 'pattern' || attr === 'title' ||
                attr === 'aria-label' || attr === 'aria-labelledby' || attr === 'aria-describedby' || attr === 'role' ||
                attr === 'for') { // *** AGGIUNTO 'for' QUI ***
                if (originalElement.hasAttribute(attr) && attrValue !== null && attrValue.trim() !== '') {
                    newElement.setAttribute(attr, attrValue);
                }
            } else if (attr === 'type') {
                // *** PROBLEMA 3: NON CAMBIARE MAI IL TIPO ORIGINALE ***
                let typeToSet = originalElement.getAttribute('type');
                if (typeToSet) {
                    newElement.setAttribute('type', typeToSet);
                } else if (tagNameLower === 'button') {
                    newElement.setAttribute('type', 'button');
                }
                // *** RIMOSSO IL MAPPING DEI RUOLI CHE CAUSAVA LA TRASFORMAZIONE ***
            }
            else if (attr === 'required' && originalElement.required) newElement.setAttribute('required', '');
            else if (attr === 'disabled' && originalElement.disabled) newElement.setAttribute('disabled', '');
            else if (attr === 'readonly' && originalElement.readOnly) newElement.setAttribute('readonly', '');
            else if (attr === 'multiple' && originalElement.multiple) newElement.setAttribute('multiple', '');
            else if (attr === 'value') {
                if (tagNameLower === 'input' || (tagNameLower === 'button' && !newElement.textContent && originalElement.value)) {
                    newElement.setAttribute('value', originalElement.value);
                } else if (tagNameLower === 'select') {
                    newElement.setAttribute('value', originalElement.value);
                }
            }
            else if (attr === 'checked' && originalElement.checked) {
                newElement.setAttribute('checked', '');
            }
            else if (attr === 'selected' && originalElement.selected && tagNameLower === 'option') {
                newElement.setAttribute('selected', '');
            }
        });

        if (tagNameLower === 'textarea') {
            newElement.textContent = originalElement.value;
        }
    }

    function isInteractiveElement(element, processedElementsSetLocal) {
        if (!element || processedElementsSetLocal.has(element)) {
            return false;
        }
        const tagName = element.tagName.toLowerCase();
        const role = element.getAttribute('role');

        // *** ESCLUDI TUTTI I BUTTON ***
        if (tagName === 'button') {
            return false;
        }

        // *** ESCLUDI readonly E disabled ***
        if (element.readOnly || element.disabled) {
            return false;
        }

        // *** ESCLUDI ANCHE spinbutton E searchbox TRAMITE ROLE ***
        if (role && ['button', 'spinbutton', 'searchbox'].includes(role)) {
            return false;
        }

        if (['input', 'select', 'textarea'].includes(tagName)) {
            if (tagName === 'input') {
                const inputType = element.type ? element.type.toLowerCase() : '';
                // *** INCLUDI HIDDEN, ESCLUDI SOLO submit|reset|image|button ***
                if (['submit', 'reset', 'image', 'button'].includes(inputType)) {
                    return false;
                }
            }
            return true;
        }

        const interactiveRoles = [
            'textbox', 'checkbox', 'radio', 'switch',
            'listbox', 'combobox', 'slider'
        ];
        if (role && interactiveRoles.includes(role)) {
            return true;
        }
        return false;
    }

    // Funzione per estrarre solo il testo della label escludendo elementi interattivi annidati
    function extractLabelTextOnly(labelElement) {
        if (!labelElement) return '';

        // Prima prova a usare il testo diretto eliminando i commenti
        let text = '';

        // Itera sui nodi figli per catturare solo i nodi di testo, ignorando commenti e elementi
        function extractTextFromNode(node) {
            let result = '';
            for (let child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    result += child.textContent || '';
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    // *** USA isInteractiveElement PER CONSISTENZA ***
                    if (!isInteractiveElement(child, new Set())) {
                        result += extractTextFromNode(child);
                    }
                }
                // I commenti (Node.COMMENT_NODE) vengono automaticamente ignorati
            }
            return result;
        }

        text = extractTextFromNode(labelElement);

        // Fallback: se non c'è testo, usa il title
        if (!text.trim() && labelElement.hasAttribute('title')) {
            text = labelElement.getAttribute('title');
        }

        // Pulisce il testo
        text = text.trim().replace(/\s+/g, ' ');

        // Rimuove caratteri comuni di separazione alla fine
        text = text.replace(/[:：\-–—]\s*$/, '').trim();

        return text;
    }

    // Funzione helper per trovare la label per un elemento specifico
    function findLabelForElement(elementToLabel, processedElementsSet) {
        if (!elementToLabel) return null;

        let labelText = null;
        let usedLabelElement = null;

        // 1. PRIORITÀ MASSIMA: label[for="elementToLabel.id"]
        if (elementToLabel.id && elementToLabel.id.trim() !== '') {
            try {
                const forLabel = document.querySelector(`label[for="${CSS.escape(elementToLabel.id)}"]`);
                if (forLabel && !processedElementsSet.has(forLabel)) {
                    labelText = extractLabelTextOnly(forLabel); // *** USA LA NUOVA FUNZIONE ***
                    if (labelText && labelText.trim()) {
                        usedLabelElement = forLabel;
                        return {
                            text: labelText,
                            sourceElement: usedLabelElement,
                            method: 'label[for]'
                        };
                    }
                }
            } catch (e) {
                console.warn("Errore querySelector label[for]:", e);
            }
        }

        // 2. SECONDA PRIORITÀ: aria-labelledby sull'elemento stesso
        const ariaLabelledBy = elementToLabel.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const ids = ariaLabelledBy.split(' ').filter(id => id.trim() !== '');
            let combinedText = '';
            let referencedElements = [];

            for (const id of ids) {
                const labelledByElement = document.getElementById(id);
                if (labelledByElement) {
                    // Se è una label, usa la funzione di estrazione pulita
                    let elementText = '';
                    if (labelledByElement.tagName.toLowerCase() === 'label') {
                        elementText = extractLabelTextOnly(labelledByElement);
                    } else {
                        elementText = labelledByElement.textContent || '';
                    }

                    combinedText += elementText.trim().replace(/\s+/g, ' ') + ' ';
                    referencedElements.push(labelledByElement);
                }
            }

            if (combinedText.trim()) {
                return {
                    text: combinedText.trim(),
                    sourceElement: null, // Multipli elementi referenziati
                    referencedElements: referencedElements,
                    method: 'aria-labelledby'
                };
            }
        }

        // 3. TERZA PRIORITÀ: aria-label sull'elemento stesso
        const ariaLabel = elementToLabel.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
            return {
                text: ariaLabel.trim().replace(/\s+/g, ' '),
                sourceElement: null,
                method: 'aria-label'
            };
        }

        return null;
    }

    // Funzione per identificare il componente wrapper più appropriato
    function findWrapperComponent(fieldElement, processedElementsSet) {
        if (!fieldElement) return null;

        let currentWrapper = fieldElement.parentElement;
        let depth = 0;
        const MAX_WRAPPER_DEPTH = 5; // Aumentato per gestire componenti Angular più annidati

        while (currentWrapper && depth < MAX_WRAPPER_DEPTH) {
            const tagNameLower = currentWrapper.tagName.toLowerCase();
            const role = currentWrapper.getAttribute('role');

            // Criteri per identificare un componente wrapper valido
            const isCustomComponent = /^(p-|app-|sdk-|mat-|ion-|ng-|v-|react-)/.test(tagNameLower);
            const hasId = currentWrapper.id && currentWrapper.id.trim() !== '';
            const hasAriaAttributes = currentWrapper.hasAttribute('aria-labelledby') ||
                currentWrapper.hasAttribute('aria-label');
            const hasRelevantRole = role && !['presentation', 'none', 'document', 'article', 'region'].includes(role);

            // Condizioni per considerare questo elemento come wrapper
            const isValidWrapper = (isCustomComponent || hasId || hasAriaAttributes || hasRelevantRole) &&
                tagNameLower !== 'label' &&
                tagNameLower !== 'body' &&
                tagNameLower !== 'html';

            if (isValidWrapper) {
                // Verifica che questo wrapper sia "specifico" per il nostro fieldElement
                const interactiveElementsInWrapper = Array.from(currentWrapper.querySelectorAll(
                    'input, select, textarea, [role="textbox"], [role="combobox"], [role="listbox"]'
                    // *** RIMOSSO button, spinbutton, searchbox DA QUI ***
                )).filter(el => el !== fieldElement && isInteractiveElement(el, new Set()));

                // Se il wrapper contiene solo il nostro elemento o elementi nascosti/disabilitati
                const visibleInteractiveElements = interactiveElementsInWrapper.filter(el => {
                    try {
                        const style = window.getComputedStyle(el);
                        return !(el.hidden ||
                            style.display === 'none' ||
                            style.visibility === 'hidden' ||
                            parseFloat(style.opacity) < 0.1 ||
                            el.disabled);
                    } catch (e) {
                        return true; // Assume visibile se non possiamo controllare
                    }
                });

                if (visibleInteractiveElements.length === 0) {
                    return {
                        element: currentWrapper,
                        depth: depth,
                        type: isCustomComponent ? 'custom-component' : 'wrapper-with-id'
                    };
                }
            }

            // Controlli per uscire dal loop
            if (currentWrapper.tagName === 'BODY' ||
                currentWrapper.tagName === 'HTML' ||
                (currentWrapper.closest && currentWrapper.closest('form') !== fieldElement.closest('form'))) {
                break;
            }

            currentWrapper = currentWrapper.parentElement;
            depth++;
        }

        return null;
    }

    // Funzione migliorata per trovare etichette associate
    function getAssociatedLabelText(fieldElement, processedElementsSet) {
        if (!fieldElement) return null;

        // Strategia 1: Ricerca diretta per fieldElement
        let labelInfo = findLabelForElement(fieldElement, processedElementsSet);
        if (labelInfo) {
            return labelInfo;
        }

        // Strategia 2: Ricerca tramite componente wrapper
        const wrapperInfo = findWrapperComponent(fieldElement, processedElementsSet);
        if (wrapperInfo) {
            const wrapper = wrapperInfo.element;

            // 2a. Cerca label per il wrapper stesso
            labelInfo = findLabelForElement(wrapper, processedElementsSet);
            if (labelInfo) {
                labelInfo.method = labelInfo.method + ' (via wrapper)';
                return labelInfo;
            }

            // 2b. Cerca testo fratello del wrapper (pattern comune)
            const previousSibling = wrapper.previousElementSibling;
            if (previousSibling &&
                !isInteractiveElement(previousSibling, new Set()) &&
                !processedElementsSet.has(previousSibling)) {

                let siblingText = '';
                // Se il fratello è una label, usa la funzione di estrazione pulita
                if (previousSibling.tagName.toLowerCase() === 'label') {
                    siblingText = extractLabelTextOnly(previousSibling);
                } else {
                    siblingText = previousSibling.textContent?.trim().replace(/\s+/g, ' ') || '';
                }

                if (siblingText && siblingText.length > 0 && siblingText.length < 200) {
                    // Pattern comune: <label>Testo</label><custom-component>...</custom-component>
                    if (previousSibling.tagName.toLowerCase() === 'label') {
                        return {
                            text: siblingText,
                            sourceElement: previousSibling,
                            method: 'sibling-label'
                        };
                    }
                    // Pattern: <div>Testo:</div><custom-component>...</custom-component>
                    else if (['div', 'span', 'p'].includes(previousSibling.tagName.toLowerCase())) {
                        return {
                            text: siblingText,
                            sourceElement: previousSibling,
                            method: 'sibling-text'
                        };
                    }
                }
            }

            // 2c. Cerca nella struttura parent -> label + wrapper (altro pattern comune)
            const parent = wrapper.parentElement;
            if (parent) {
                const labelInParent = parent.querySelector('label');
                if (labelInParent &&
                    !processedElementsSet.has(labelInParent) &&
                    !labelInParent.hasAttribute('for')) { // Label non specifica

                    const labelText = extractLabelTextOnly(labelInParent); // *** USA LA NUOVA FUNZIONE ***
                    if (labelText && labelText.length > 0) {
                        // Verifica che questa label non sia già associata ad altri campi
                        const otherFieldsInParent = Array.from(parent.querySelectorAll(
                            'input, select, textarea' // *** RIMOSSO button ***
                        )).filter(el => el !== fieldElement);

                        const isLabelSpecific = otherFieldsInParent.length === 0 ||
                            otherFieldsInParent.every(el =>
                                processedElementsSet.has(el) ||
                                !isInteractiveElement(el, new Set())
                            );

                        if (isLabelSpecific) {
                            return {
                                text: labelText,
                                sourceElement: labelInParent,
                                method: 'parent-label'
                            };
                        }
                    }
                }
            }
        }

        // Strategia 3: closest('label') come ultima risorsa con controlli migliorati
        const closestLabel = fieldElement.closest('label');
        if (closestLabel && !processedElementsSet.has(closestLabel)) {
            const closestLabelFor = closestLabel.getAttribute('for');
            const fieldElementId = fieldElement.id;

            // Caso 1: Label ha 'for' che punta al nostro fieldElement
            if (fieldElementId && closestLabelFor === fieldElementId) {
                const text = extractLabelTextOnly(closestLabel); // *** USA LA NUOVA FUNZIONE ***
                if (text) {
                    return {
                        text: text,
                        sourceElement: closestLabel,
                        method: 'closest-label[for]'
                    };
                }
            }
            // Caso 2: Label wrappante senza 'for'
            else if (!closestLabelFor) {
                const interactiveInLabel = Array.from(closestLabel.querySelectorAll(
                    'input, select, textarea' // *** RIMOSSO button ***
                )).filter(el => isInteractiveElement(el, new Set()));

                if (interactiveInLabel.length === 1 &&
                    interactiveInLabel[0].isSameNode(fieldElement)) {
                    const text = extractLabelTextOnly(closestLabel); // *** USA LA NUOVA FUNZIONE ***
                    if (text) {
                        return {
                            text: text,
                            sourceElement: closestLabel,
                            method: 'closest-label-wrapper'
                        };
                    }
                }
            }
        }

        return null; // Nessuna etichetta trovata
    }

    // *** FUNZIONE MODIFICATA: isLogicalFormContainer (parte del conteggio) ***
    function isLogicalFormContainer(containerElement, processedElementsSetGlobal) {
        if (!containerElement || processedElementsSetGlobal.has(containerElement) || containerElement.tagName.toLowerCase() === 'form' || containerElement.closest('form') !== null) {
            return false;
        }
        try {
            const style = window.getComputedStyle(containerElement);
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) {
                return false;
            }
        } catch (e) { /* ignore */ }

        const role = containerElement.getAttribute('role');
        if (role === 'form' || role === 'search') {
            const interactiveDescendants = Array.from(containerElement.querySelectorAll('*')).filter(el => isInteractiveElement(el, processedElementsSetGlobal));
            if (interactiveDescendants.length > 0) {
                let hasDirectOrNestedRelevantFields = false;
                for (const desc of interactiveDescendants) {
                    let current = desc.parentElement;
                    let isSafePath = true;
                    while (current && current !== containerElement) {
                        if (current.tagName.toLowerCase() === 'form' || processedElementsSetGlobal.has(current)) {
                            isSafePath = false;
                            break;
                        }
                        current = current.parentElement;
                    }
                    if (isSafePath) {
                        hasDirectOrNestedRelevantFields = true;
                        break;
                    }
                }
                return hasDirectOrNestedRelevantFields;
            }
            return false;
        }

        let inputLikeCount = 0;
        let buttonLikeCount = 0;
        let visibleInteractiveElementsCount = 0;
        const descendants = containerElement.querySelectorAll('*');

        for (const el of descendants) {
            if (processedElementsSetGlobal.has(el) || el.closest('form') !== null) {
                continue;
            }

            let parentCandidate = el.parentElement;
            let inOtherLogicalCandidate = false;
            while (parentCandidate && parentCandidate !== containerElement) {
                if (parentCandidate.hasAttribute('data-logical-form-processed')) {
                    inOtherLogicalCandidate = true;
                    break;
                }
                parentCandidate = parentCandidate.parentElement;
            }
            if (inOtherLogicalCandidate) continue;

            // *** RIMOSSO CONTROLLO VISIBILITÀ - CONTA TUTTI GLI ELEMENTI ***
            // let isElVisible = false; 
            // try { 
            //     const style = window.getComputedStyle(el); 
            //     if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0) { 
            //         isElVisible = true; 
            //     } 
            // } catch (e) { /* ignore */ } 
            // if (!isElVisible) continue; 

            if (isInteractiveElement(el, processedElementsSetGlobal)) {
                visibleInteractiveElementsCount++; // *** RINOMINARE IN interactiveElementsCount ***
                const elTagName = el.tagName.toLowerCase();
                const elRole = el.getAttribute('role');
                const elType = el.type ? el.type.toLowerCase() : null;

                if ((elTagName === 'input' && !['submit', 'reset', 'button', 'image'].includes(elType)) || // *** RIMOSSO 'hidden' ***
                    elTagName === 'textarea' || elTagName === 'select' ||
                    ['textbox', 'listbox', 'combobox', 'slider', 'switch', 'checkbox', 'radio'].includes(elRole)) {
                    inputLikeCount++;
                } else if (elTagName === 'button' || elRole === 'button' ||
                    (elTagName === 'input' && ['button', 'submit', 'reset', 'image'].includes(elType))) {
                    buttonLikeCount++;
                }
            }
        }

        const meetsDensityCriteria = (inputLikeCount >= 1 && buttonLikeCount >= 1) || inputLikeCount >= 2;
        const isSearchContainerWithInput = (role === 'search' && inputLikeCount >= 1);

        if (meetsDensityCriteria || isSearchContainerWithInput) {
            if (visibleInteractiveElementsCount < 1) return false;
            if (containerElement.tagName.toLowerCase() === 'fieldset' && visibleInteractiveElementsCount >= 1) return true;
            if (containerElement.hasAttribute('aria-label') || containerElement.hasAttribute('aria-labelledby')) return true;
            const textContent = containerElement.textContent.trim().replace(/\s+/g, ' ');
            const childElementCount = containerElement.children.length;
            if (textContent.length > 500 && childElementCount > 30 && inputLikeCount < 3 && buttonLikeCount < 1) {
                return false;
            }
            if (textContent.length > 0 || childElementCount > 0 || visibleInteractiveElementsCount >= 1) {
                return true;
            }
        }
        return false;
    }

    function getSingleElementChild(node) {
        if (!node || !node.childNodes) return null; let elementChild = null; let elementCount = 0; for (let i = 0; i < node.childNodes.length; i++) { const child = node.childNodes[i]; if (child.nodeType === Node.ELEMENT_NODE) { elementCount++; elementChild = child; } else if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim() !== '') { return null; } } return elementCount === 1 ? elementChild : null;
    }

    function getOnlySignificantTextContent(node) {
        if (!node || !node.childNodes || node.childNodes.length === 0) return null; let textContent = null; let foundElement = false; let significantTextCount = 0; for (let i = 0; i < node.childNodes.length; i++) { const child = node.childNodes[i]; if (child.nodeType === Node.ELEMENT_NODE) { foundElement = true; break; } else if (child.nodeType === Node.TEXT_NODE) { const trimmedText = child.nodeValue.trim(); if (trimmedText !== '') { significantTextCount++; if (significantTextCount > 1) return null; textContent = trimmedText.replace(/\s+/g, ' '); } } } return (!foundElement && significantTextCount === 1) ? textContent : null;
    }

    // *** MODIFICA 1: isInteractiveElement - Includere hidden, escludere readonly ***
    function isInteractiveElement(element, processedElementsSetLocal) {
        if (!element || processedElementsSetLocal.has(element)) {
            return false;
        }
        const tagName = element.tagName.toLowerCase();
        const role = element.getAttribute('role');

        // *** ESCLUDI TUTTI I BUTTON ***
        if (tagName === 'button') {
            return false;
        }

        // *** ESCLUDI readonly E disabled ***
        if (element.readOnly || element.disabled) {
            return false;
        }

        // *** ESCLUDI ANCHE spinbutton E searchbox TRAMITE ROLE ***
        if (role && ['button', 'spinbutton', 'searchbox'].includes(role)) {
            return false;
        }

        if (['input', 'select', 'textarea'].includes(tagName)) {
            if (tagName === 'input') {
                const inputType = element.type ? element.type.toLowerCase() : '';
                // *** INCLUDI HIDDEN, ESCLUDI SOLO submit|reset|image|button ***
                if (['submit', 'reset', 'image', 'button'].includes(inputType)) {
                    return false;
                }
            }
            return true;
        }

        const interactiveRoles = [
            'textbox', 'checkbox', 'radio', 'switch',
            'listbox', 'combobox', 'slider'
        ];
        if (role && interactiveRoles.includes(role)) {
            return true;
        }
        return false;
    }

    // *** MODIFICA 2: processNode - Rimuovere controlli di visibilità ***
    function processNode(node, parentSimplifiedElement, processedElementsSet) {
        if (processedElementsSet.has(node)) {
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            const role = node.getAttribute('role');

            if (['script', 'style', 'noscript', 'head', 'meta', 'link', 'path', 'svg', 'footer', 'header', 'nav'].includes(tagName)) {
                processedElementsSet.add(node); return;
            }

            if (tagName === 'input') {
                const inputType = node.type?.toLowerCase();
                // *** ESCLUDI SOLO submit|reset|image|button, NON hidden ***
                if (['submit', 'reset', 'image', 'button'].includes(inputType)) {
                    processedElementsSet.add(node); return;
                }
            }

            // *** RIMOSSI TUTTI I CONTROLLI DI VISIBILITÀ ***
            // Non controllare più hidden, display:none, visibility:hidden, opacity
            let isOriginallyHidden = false;

            // *** MANTIENI SOLO IL CONTROLLO PER ELEMENTI INTERATTIVI (per il flag) ***
            if (['input', 'select', 'textarea'].includes(tagName) ||
                ['textbox', 'checkbox', 'radio', 'listbox', 'combobox', 'switch', 'slider'].includes(role)) {
                try {
                    const style = window.getComputedStyle(node);
                    if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.01) {
                        isOriginallyHidden = true; // *** SOLO PER FLAGGARE, NON PER ESCLUDERE ***
                    }
                } catch (e) {/* Assume visible */ }
            }

            let simplifiedNode = null;

            switch (tagName) {
                case 'button':
                    // *** SALTA COMPLETAMENTE I BUTTON ***
                    processedElementsSet.add(node);
                    return;

                case 'span':
                case 'b': case 'i': case 'em': case 'strong': case 'u': case 's': case 'strike': case 'small':
                    node.childNodes.forEach(child => processNode(child, parentSimplifiedElement, processedElementsSet));
                    if (node.id || node.getAttribute('role')) {
                        processedElementsSet.add(node);
                    }
                    return;

                case 'div':
                    const onlyTextDiv = getOnlySignificantTextContent(node);
                    if (onlyTextDiv !== null) {
                        simplifiedNode = document.createElement('span');
                        simplifiedNode.textContent = onlyTextDiv + ' ';
                        parentSimplifiedElement.appendChild(simplifiedNode);
                    } else {
                        const singleChildDiv = getSingleElementChild(node);
                        if (singleChildDiv) {
                            processNode(singleChildDiv, parentSimplifiedElement, processedElementsSet);
                        } else {
                            const hasRelevantContentDiv = node.children.length > 0 || node.textContent.trim() !== '';
                            if (hasRelevantContentDiv) {
                                simplifiedNode = document.createElement(tagName);
                                parentSimplifiedElement.appendChild(simplifiedNode);
                                node.childNodes.forEach(child => processNode(child, simplifiedNode, processedElementsSet));
                            } else {
                                node.childNodes.forEach(child => processNode(child, parentSimplifiedElement, processedElementsSet));
                            }
                        }
                    }
                    processedElementsSet.add(node);
                    return;

                case 'p':
                    const hasRelevantContentP = node.children.length > 0 || node.textContent.trim() !== '';
                    if (hasRelevantContentP) {
                        if (parentSimplifiedElement && ['td', 'th'].includes(parentSimplifiedElement.tagName.toLowerCase())) {
                            node.childNodes.forEach(child => processNode(child, parentSimplifiedElement, processedElementsSet));
                        } else {
                            simplifiedNode = document.createElement(tagName);
                            parentSimplifiedElement.appendChild(simplifiedNode);
                            node.childNodes.forEach(child => processNode(child, simplifiedNode, processedElementsSet));
                        }
                    } else {
                        node.childNodes.forEach(child => processNode(child, parentSimplifiedElement, processedElementsSet));
                    }
                    processedElementsSet.add(node);
                    return;

                case 'label':
                    if (node.textContent.trim() || node.querySelector('input, select, textarea')) {
                        simplifiedNode = document.createElement('label');
                        simplifyElement(node, simplifiedNode);
                        const labelText = extractLabelTextOnly(node);
                        if (labelText) {
                            simplifiedNode.textContent = labelText;
                        }
                        parentSimplifiedElement.appendChild(simplifiedNode);
                        processedElementsSet.add(node);
                        node.childNodes.forEach(child => processNode(child, simplifiedNode, processedElementsSet));
                    } else {
                        processedElementsSet.add(node);
                    }
                    break;

                case 'input': case 'textarea': case 'select':
                case 'form': case 'fieldset': case 'legend':
                    let effectiveTagName = tagName;

                    if (['form', 'fieldset', 'legend'].includes(tagName)) {
                        simplifiedNode = document.createElement(tagName);
                        simplifyElement(node, simplifiedNode);
                        parentSimplifiedElement.appendChild(simplifiedNode);
                        processedElementsSet.add(node);
                        node.childNodes.forEach(child => processNode(child, simplifiedNode, processedElementsSet));
                    }
                    else if (['input', 'textarea', 'select'].includes(effectiveTagName)) {
                        // *** CONTROLLA readonly E disabled QUI ***
                        if (node.readOnly || node.disabled) {
                            processedElementsSet.add(node);
                            return; // *** ESCLUDI campi readonly/disabled ***
                        }

                        simplifiedNode = document.createElement(effectiveTagName);
                        simplifyElement(node, simplifiedNode);

                        const labelInfo = getAssociatedLabelText(node, processedElementsSet);
                        if (labelInfo && labelInfo.text) {
                            let skipLabelCreation = false;

                            if (labelInfo.sourceElement && parentSimplifiedElement.isSameNode && parentSimplifiedElement.isSameNode(labelInfo.sourceElement)) {
                                skipLabelCreation = true;
                            }
                            else if (labelInfo.sourceElement && node.parentElement && node.parentElement.isSameNode && node.parentElement.isSameNode(labelInfo.sourceElement)) {
                                if (!parentSimplifiedElement.isSameNode || !parentSimplifiedElement.isSameNode(labelInfo.sourceElement)) {
                                    // Ok, crea la label
                                } else {
                                    skipLabelCreation = true;
                                }
                            }

                            if (!skipLabelCreation) {
                                const labelElement = document.createElement('label');
                                labelElement.textContent = labelInfo.text.trim().replace(/\s+/g, ' ') + ' ';
                                if (node.id && node.id.trim() !== '') {
                                    labelElement.setAttribute('for', node.id);
                                }
                                parentSimplifiedElement.appendChild(labelElement);
                            }

                            if (labelInfo.sourceElement && labelInfo.sourceElement.tagName === 'LABEL') {
                                processedElementsSet.add(labelInfo.sourceElement);
                            }

                            if (labelInfo.referencedElements && labelInfo.referencedElements.length > 0) {
                                labelInfo.referencedElements.forEach(el => {
                                    if (el.tagName === 'LABEL') {
                                        processedElementsSet.add(el);
                                    }
                                });
                            }
                        }

                        // *** MANTIENI IL FLAG PER ELEMENTI ORIGINARIAMENTE NASCOSTI ***
                        if (isOriginallyHidden) {
                            simplifiedNode.setAttribute('data-originally-hidden', 'true');
                        }

                        if (effectiveTagName === 'select') {
                            const options = node.querySelectorAll('option');
                            options.forEach(option => {
                                const simplifiedOption = document.createElement('option');
                                simplifyElement(option, simplifiedOption);
                                simplifiedOption.textContent = option.textContent;
                                simplifiedNode.appendChild(simplifiedOption);
                            });
                        }

                        parentSimplifiedElement.appendChild(simplifiedNode);
                        processedElementsSet.add(node);
                    }
                    break;

                case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
                case 'li': case 'ul': case 'ol':
                case 'table': case 'thead': case 'tbody': case 'tfoot': case 'tr': case 'th': case 'td':
                    const hasRelevantContentStruct = node.children.length > 0 || node.textContent.trim() !== '';
                    if (hasRelevantContentStruct) {
                        simplifiedNode = document.createElement(tagName);
                        if (['table', 'th', 'td'].includes(tagName)) {
                            ['colspan', 'rowspan'].forEach(attr => {
                                if (node.hasAttribute(attr)) {
                                    simplifiedNode.setAttribute(attr, node.getAttribute(attr));
                                }
                            });
                        }
                        parentSimplifiedElement.appendChild(simplifiedNode);
                        node.childNodes.forEach(child => processNode(child, simplifiedNode, processedElementsSet));
                        processedElementsSet.add(node);
                    } else {
                        node.childNodes.forEach(child => processNode(child, parentSimplifiedElement, processedElementsSet));
                        processedElementsSet.add(node);
                    }
                    break;

                default:
                    node.childNodes.forEach(child => processNode(child, parentSimplifiedElement, processedElementsSet));
                    processedElementsSet.add(node);
                    break;
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue.trim().replace(/\s+/g, ' ');
            if (text) {
                if (parentSimplifiedElement &&
                    (!parentSimplifiedElement.tagName || !['script', 'style', 'label'].includes(parentSimplifiedElement.tagName.toLowerCase())) &&
                    parentSimplifiedElement.getAttribute('role') !== 'button') {
                    parentSimplifiedElement.appendChild(document.createTextNode(text + ' '));
                }
            }
        }
    }

    const standardForms = document.querySelectorAll('form');
    let logicalFormIndex = 0;

    standardForms.forEach((formElement, index) => {
        if (processedElements.has(formElement)) { return; }
        const simplifiedForm = document.createElement('form');
        simplifyElement(formElement, simplifiedForm);
        if (!simplifiedForm.hasAttribute('id') || simplifiedForm.getAttribute('id').trim() === '') {
            const randomId = 'form-std-' + Math.random().toString(36).substring(2, 10);
            simplifiedForm.setAttribute('id', randomId);
        }
        processedElements.add(formElement);
        formElement.setAttribute('data-std-form-processed', 'true');

        formElement.childNodes.forEach(node => processNode(node, simplifiedForm, processedElements));

        formElement.removeAttribute('data-std-form-processed');

        const wrappingLabels = simplifiedForm.querySelectorAll('label');
        wrappingLabels.forEach(label => {
            const nestedInput = label.querySelector('input, select, textarea, button');
            if (nestedInput && nestedInput.parentNode === label) {
                const inputId = nestedInput.id;
                const labelFor = label.getAttribute('for');
                if (!labelFor || (inputId && labelFor === inputId)) {
                    if (label.parentNode && label.nextSibling !== nestedInput) {
                        label.parentNode.insertBefore(nestedInput, label.nextSibling);
                        const space = document.createTextNode(' ');
                        if (nestedInput.nextSibling) {
                            label.parentNode.insertBefore(space, nestedInput.nextSibling);
                        } else {
                            label.parentNode.appendChild(space);
                        }
                    }
                }
            }
        });

        const potentialServiceFields = simplifiedForm.querySelectorAll(
            'input[data-originally-hidden="true"], select[data-originally-hidden="true"], textarea[data-originally-hidden="true"]'
        );
        potentialServiceFields.forEach(element => {
            const elementId = element.id;
            let hasAssociatedLabel = false;

            if (elementId) {
                if (simplifiedForm.querySelector(`label[for="${CSS.escape(elementId)}"]`)) {
                    hasAssociatedLabel = true;
                }
            }
            if (!hasAssociatedLabel && element.parentElement && element.parentElement.tagName === 'LABEL') {
                hasAssociatedLabel = true;
            }

            let hasPlaceholder = element.hasAttribute('placeholder') && element.placeholder.trim() !== '';
            let hasAriaLabel = element.hasAttribute('aria-label') && element.getAttribute('aria-label').trim() !== '';
            let hasValue = element.value && element.value.trim() !== '';
            let isHidden = element.type && element.type.toLowerCase() === 'hidden';

            // *** MANTIENI SEMPRE I CAMPI HIDDEN ANCHE SENZA LABEL ***
            if (element.hasAttribute('data-originally-hidden') &&
                !hasAssociatedLabel && !hasPlaceholder && !hasAriaLabel && !hasValue &&
                !isHidden) { // *** NON rimuovere se è type="hidden" ***
                element.remove();
            } else {
                element.removeAttribute('data-originally-hidden');
            }
        });

        if (simplifiedForm.innerHTML.trim() !== '') {
            let formTitleText = `Form ${index + 1}`;
            const ariaLabel = formElement.getAttribute('aria-label');
            const ariaLabelledBy = formElement.getAttribute('aria-labelledby');
            const h1 = document.querySelector('h1');
            if (ariaLabel) {
                formTitleText = ariaLabel;
            } else if (ariaLabelledBy) {
                const el = document.getElementById(ariaLabelledBy);
                if (el) formTitleText = el.textContent.trim().replace(/\s+/g, ' ');
            } else if (formElement.closest('section')?.getAttribute('aria-label')) {
                formTitleText = formElement.closest('section').getAttribute('aria-label');
            } else if (h1?.textContent.trim()) {
                formTitleText = h1.textContent.trim().replace(/\s+/g, ' ');
            }

            const firstLegend = formElement.querySelector('fieldset > legend');
            if (formTitleText === `Form ${index + 1}` && firstLegend?.textContent.trim()) {
                formTitleText = firstLegend.textContent.trim().replace(/\s+/g, ' ');
            }

            const formHeader = `<h3>${formTitleText} (Semplificato)</h3>`;
            simplifiedFormsHtml.push(formHeader + simplifiedForm.outerHTML);
        }
    });

    const potentialContainersSelectors = [
        'div[role="form"]', 'section[role="form"]', 'div[role="search"]', 'section[role="search"]',
        'fieldset', 'article', 'main', 'div', 'section'
    ];
    let allPotentialContainers = [];
    potentialContainersSelectors.forEach(selector => {
        try {
            document.querySelectorAll(selector).forEach(el => allPotentialContainers.push(el));
        } catch (e) {
            console.warn(`Errore selettore logici: ${selector}`, e);
        }
    });
    allPotentialContainers = Array.from(new Set(allPotentialContainers));

    allPotentialContainers.forEach((containerElement) => {
        if (processedElements.has(containerElement) ||
            containerElement.tagName.toLowerCase() === 'form' ||
            containerElement.closest('form') !== null ||
            containerElement.hasAttribute('data-std-form-processed') ||
            containerElement.hasAttribute('data-logical-form-processed')) {
            return;
        }

        if (isLogicalFormContainer(containerElement, processedElements)) {
            const simplifiedLogicalForm = document.createElement('form');
            simplifiedLogicalForm.setAttribute('data-logical-form', 'true');

            let formTitleText = `Form Logico ${logicalFormIndex + 1}`;
            const containerAriaLabel = containerElement.getAttribute('aria-label');
            const containerAriaLabelledBy = containerElement.getAttribute('aria-labelledby');

            if (containerAriaLabel) {
                formTitleText = containerAriaLabel;
            } else if (containerAriaLabelledBy) {
                const el = document.getElementById(containerAriaLabelledBy);
                if (el) formTitleText = el.textContent.trim().replace(/\s+/g, ' ');
            } else if (containerElement.tagName.toLowerCase() === 'fieldset') {
                const legend = containerElement.querySelector('legend');
                if (legend && legend.textContent.trim()) {
                    formTitleText = legend.textContent.trim().replace(/\s+/g, ' ');
                }
            } else {
                let prevEl = containerElement.previousElementSibling;
                while (prevEl) {
                    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(prevEl.tagName.toLowerCase())) {
                        const hText = prevEl.textContent.trim().replace(/\s+/g, ' ');
                        if (hText) {
                            formTitleText = hText;
                            break;
                        }
                    }
                    if (prevEl.tagName.toLowerCase() === 'form' ||
                        prevEl.hasAttribute('data-logical-form') ||
                        prevEl.getAttribute('role') === 'form' ||
                        prevEl.getAttribute('role') === 'search') break;
                    prevEl = prevEl.previousElementSibling;
                }
            }

            simplifiedLogicalForm.setAttribute('data-derived-title', formTitleText);

            let formId = containerElement.id;
            if (!formId || document.getElementById('form-log-' + formId)) {
                formId = 'form-log-' + Math.random().toString(36).substring(2, 10);
            } else {
                formId = 'form-log-' + formId;
            }
            simplifiedLogicalForm.setAttribute('id', formId);

            if (containerElement.hasAttribute('action')) {
                simplifiedLogicalForm.setAttribute('action', containerElement.getAttribute('action'));
            }
            if (containerElement.hasAttribute('method')) {
                simplifiedLogicalForm.setAttribute('method', containerElement.getAttribute('method'));
            }

            processedElements.add(containerElement);
            containerElement.setAttribute('data-logical-form-processed', 'true');
            containerElement.childNodes.forEach(node => processNode(node, simplifiedLogicalForm, processedElements));

            const wrappingLabelsInLogical = simplifiedLogicalForm.querySelectorAll('label');
            wrappingLabelsInLogical.forEach(label => {
                const nestedInput = label.querySelector('input, select, textarea, button');
                if (nestedInput && nestedInput.parentNode === label) {
                    const inputId = nestedInput.id;
                    const labelFor = label.getAttribute('for');
                    if (!labelFor || (inputId && labelFor === inputId)) {
                        if (label.parentNode && label.nextSibling !== nestedInput) {
                            label.parentNode.insertBefore(nestedInput, label.nextSibling);
                            const space = document.createTextNode(' ');
                            if (nestedInput.nextSibling) {
                                label.parentNode.insertBefore(space, nestedInput.nextSibling);
                            } else {
                                label.parentNode.appendChild(space);
                            }
                        }
                    }
                }
            });

            const hiddenFieldsInLogical = simplifiedLogicalForm.querySelectorAll(
                'input[data-originally-hidden="true"], select[data-originally-hidden="true"], textarea[data-originally-hidden="true"], button[data-originally-hidden="true"]'
            );
            hiddenFieldsInLogical.forEach(element => {
                const elementId = element.id;
                let hasAssociatedLabel = false;
                if (elementId) {
                    if (simplifiedLogicalForm.querySelector(`label[for="${CSS.escape(elementId)}"]`)) {
                        hasAssociatedLabel = true;
                    }
                }
                if (!hasAssociatedLabel && element.parentElement && element.parentElement.tagName === 'LABEL') {
                    hasAssociatedLabel = true;
                }
                let hasPlaceholder = element.hasAttribute('placeholder') && element.placeholder.trim() !== '';
                let hasAriaLabel = element.hasAttribute('aria-label') && element.getAttribute('aria-label').trim() !== '';

                if (element.hasAttribute('data-originally-hidden') && !hasAssociatedLabel && !hasPlaceholder && !hasAriaLabel && !element.value && !(element.tagName === 'BUTTON' && element.textContent.trim())) {
                    element.remove();
                } else {
                    element.removeAttribute('data-originally-hidden');
                }
            });

            if (simplifiedLogicalForm.innerHTML.trim() !== '') {
                const formHeader = `<h3>${simplifiedLogicalForm.getAttribute('data-derived-title') || `Form Logico ${logicalFormIndex + 1}`} (Logico)</h3>`;
                simplifiedFormsHtml.push(formHeader + simplifiedLogicalForm.outerHTML);
                logicalFormIndex++;
            } else {
                containerElement.removeAttribute('data-logical-form-processed');
            }
        }
    });

    document.querySelectorAll('[data-std-form-processed="true"]').forEach(el => el.removeAttribute('data-std-form-processed'));
    document.querySelectorAll('[data-logical-form-processed="true"]').forEach(el => el.removeAttribute('data-logical-form-processed'));

    if (simplifiedFormsHtml.length === 0) {
        return "<p style=\"padding:10px; color:gray;\">Nessuna form o sezione interattiva con campi compilabili trovata nella pagina.</p>";
    }
    return simplifiedFormsHtml.join('\n\n<hr style="margin: 20px 0; border: 1px dashed #ccc;">\n\n');
}

window.extractAndSimplifyForms_content = extractAndSimplifyForms_logic;

window.assignFormValuesInPage = function (dataToAssign) {
    console.log('Content script: Inizio assegnazione valori:', dataToAssign);
    let assignmentsCount = 0;
    let notFoundCount = 0;
    let errorMessages = [];

    if (!Array.isArray(dataToAssign)) {
        const msg = 'Content script: Errore - i dati da assegnare non sono un array.';
        console.error(msg, dataToAssign);
        errorMessages.push(msg);
        return { assignmentsCount, notFoundCount, errorMessages };
    }

    for (const item of dataToAssign) {
        if (typeof item !== 'object' || item === null || typeof item.id !== 'string' || !('valore' in item)) {
            const errItemMsg = `Content script: Saltato item malformato (mancano id o valore): ${JSON.stringify(item)}`;
            console.warn(errItemMsg);
            errorMessages.push(errItemMsg);
            notFoundCount++;
            continue;
        }

        const { id, valore } = item;

        const element = document.getElementById(id);

        if (element) {
            const tagName = element.tagName.toLowerCase();
            const type = element.type ? element.type.toLowerCase() : null;
            console.log(`Content script: Trovato elemento ID "${id}" (tag: ${tagName}, type: ${type}). Valore da assegnare: "${valore}"`);

            try {
                if (tagName === 'input') {
                    switch (type) {
                        case 'radio':
                            if (element.value === valore || valore === 'OK') {
                                element.checked = true;
                                assignmentsCount++;
                            }
                            break;
                        case 'checkbox':
                            // For checkboxes, check if the value matches the checkbox's value or if it's a boolean/OK/KO
                            const shouldCheck = (element.value === valore) || 
                                             (valore === 'OK' || valore === true || String(valore).toLowerCase() === 'true');
                            element.checked = shouldCheck;
                            // Also trigger the change event to ensure any attached handlers are notified
                            const event = new Event('change', { bubbles: true });
                            element.dispatchEvent(event);
                            assignmentsCount++;
                            break;
                        case 'file':
                            console.warn(`Content script: Assegnazione a input[type=file] (ID: "${id}") non supportata.`);
                            errorMessages.push(`Assegnazione a input file (ID: ${id}) non supportata.`);
                            notFoundCount++;
                            break;
                        default:
                            element.value = valore;
                            assignmentsCount++;
                            break;
                    }
                } else if (tagName === 'textarea' || tagName === 'select') {
                    element.value = valore;
                    assignmentsCount++;
                } else {
                    console.warn(`Content script: Elemento con ID "${id}" (tag: ${tagName}) non è un campo form standard.`);
                    notFoundCount++;
                    errorMessages.push(`Elemento non supportato (ID: ${id}, tag: ${tagName})`);
                }

                if (element.value === valore || ((type === 'checkbox' || type === 'radio') && element.checked === (valore === 'OK' || valore === true || String(valore).toLowerCase() === 'true'))) {
                    console.log(`Content script: Valore assegnato correttamente a "${id}".`);
                } else if (type !== 'file' && (tagName === 'input' || tagName === 'textarea' || tagName === 'select')) {
                    console.warn(`Content script: Valore per "${id}" potrebbe non essere stato assegnato come previsto. Element.value: "${element.value}", JSON value: "${valore}"`);
                    if (tagName === 'select') errorMessages.push(`Per select "${id}", il valore "${valore}" potrebbe non essere un'opzione valida.`);
                }

            } catch (e) {
                console.error(`Content script: Errore durante l'assegnazione a ID "${id}":`, e);
                errorMessages.push(`Errore per ID ${id}: ${e.message}`);
                notFoundCount++;
            }
        } else {
            console.warn(`Content script: Elemento con ID "${id}" non trovato.`);
            notFoundCount++;
            errorMessages.push(`Elemento non trovato (ID: ${id})`);
        }
    }

    const resultSummary = `Assegnazione completata. Assegnati: ${assignmentsCount}, Non trovati/Errori/Saltati: ${notFoundCount}.`;
    console.log(`Content script: ${resultSummary}`);
    if (errorMessages.length > 0) {
        console.warn("Content script: Dettagli errori/avvisi:", errorMessages);
    }
    return { assignmentsCount, notFoundCount, errorMessages };
};