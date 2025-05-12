// DOMPurify è caricato tramite manifest.json prima di questo script,
// anche se la nuova funzione di estrazione non lo usa direttamente.
// Potrebbe essere utile per altre funzionalità future o per sanitizzare input.

// === Funzione da Iniettare nella Pagina (presa da nuovo-codice.js) ===
// Questa funzione viene eseguita nel contesto della pagina web,
// NON nel contesto del popup. Non può accedere a variabili o funzioni del popup.js
function extractAndSimplifyForms_logic() {
  const simplifiedFormsHtml = [];
  const forms = document.querySelectorAll('form');

  // Funzione helper per copiare attributi essenziali (MODIFICATA per readonly)
  function simplifyElement(originalElement, newElement) {
    const tagNameLower = originalElement.tagName.toLowerCase();
    const keepIdTags = ['form', 'input', 'select', 'textarea'];

    const essentialAttrs = [
      'id', 'name', 'type', 'value', 'placeholder', 'required', 'checked',
      'selected', 'disabled', /* 'readonly', */ // RIMOSSO readonly dalla lista
      'multiple', 'for', 'action', 'method',
      'min', 'max', 'step', 'pattern', 'title'
      // NOTA: 'class', 'style' sono deliberatamente omessi per semplificare,
      // ma potrebbero essere aggiunti se necessario per la struttura.
    ];

    essentialAttrs.forEach(attr => {
      if (attr === 'id') {
        if (keepIdTags.includes(tagNameLower) && originalElement.hasAttribute('id')) {
          const originalId = originalElement.getAttribute('id');
          if (originalId && originalId.trim() !== '') {
            newElement.setAttribute('id', originalId);
          }
        }
      } else {
        const attrValue = originalElement.getAttribute(attr);
        // Copia l'attributo se esiste e non è 'false' (per attributi booleani stringa)
        // O se la proprietà corrispondente è true (per attributi booleani come checked, selected)
        if (originalElement.hasAttribute(attr) && attrValue !== 'false') {
          newElement.setAttribute(attr, attrValue === null ? '' : attrValue);
        } else if (originalElement[attr] === true && ['checked', 'selected', 'required', 'disabled', 'multiple'].includes(attr)) {
          // Per gli attributi booleani puri, se la proprietà è true, imposta l'attributo (senza valore)
          newElement.setAttribute(attr, '');
        }
      }
    });

    // Non copiare MAI l'attributo readonly
    if (newElement.hasAttribute('readonly')) {
        newElement.removeAttribute('readonly');
    }

    if (originalElement.tagName === 'TEXTAREA' && originalElement.value) {
      newElement.textContent = originalElement.value; // Il valore di textarea è nel suo contenuto testuale
    }
  }

  // ... (resto di getOnlySignificantTextContent, getSingleElementChild, processNode come prima) ...
  // Funzione helper per ottenere l'unico figlio elemento (ignorando nodi di testo vuoti)
  function getSingleElementChild(node) {
    if (!node || !node.childNodes) return null;
    let elementChild = null;
    let elementCount = 0;
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        elementCount++;
        elementChild = child;
      } else if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim() !== '') {
        return null; // Ha anche testo significativo diretto, non conta come 'solo figlio elemento'
      }
    }
    return elementCount === 1 ? elementChild : null;
  }

  // Helper per ottenere il contenuto testuale SE un nodo contiene SOLO testo significativo
  // e nessun nodo elemento. Restituisce il testo trimmato o null.
  function getOnlySignificantTextContent(node) {
    if (!node || !node.childNodes || node.childNodes.length === 0) {
      return null;
    }
    let textContent = null;
    let foundElement = false;
    let significantTextCount = 0;

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        foundElement = true;
        break; // Trovato elemento, non è solo testo
      } else if (child.nodeType === Node.TEXT_NODE) {
        const trimmedText = child.nodeValue.trim();
        if (trimmedText !== '') {
          significantTextCount++;
          if (significantTextCount > 1) {
            // Trovato più di un nodo di testo significativo
            return null;
          }
          textContent = trimmedText.replace(/\s+/g, ' '); // Normalizza spazi interni
        }
      }
    }
    return (!foundElement && significantTextCount === 1) ? textContent : null;
  }


  // Funzione ricorsiva per processare i nodi
  function processNode(node, parentSimplifiedElement) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      // Filtri preliminari
      if (['script', 'style', 'noscript', 'head', 'meta', 'link', 'path', 'svg', 'button', 'footer', 'header', 'nav'].includes(tagName)) {
        return;
      }
      if (tagName === 'input' && ['submit', 'reset', 'button', 'hidden'].includes(node.type?.toLowerCase())) {
        return;
      }

      let isOriginallyHidden = false;
      let checkVisibility = !['form', 'fieldset', 'legend', 'label', 'option'].includes(tagName);

      if (['input', 'select', 'textarea'].includes(tagName)) {
        try {
          const style = window.getComputedStyle(node);
          if (node.hidden || style.display === 'none' || style.visibility === 'hidden') {
            isOriginallyHidden = true;
          }
        } catch (e) {/* Assume visible */ }
        checkVisibility = false;
      }

      if (checkVisibility) {
        let isVisible = true;
        if (node.hidden) isVisible = false;
        else {
          try {
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) isVisible = false;
            if (isVisible) {
              let parent = node.parentElement;
              while (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
                try {
                  const parentStyle = window.getComputedStyle(parent);
                  if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
                    isVisible = false;
                    break;
                  }
                } catch (e) { /* ignora */ }
                parent = parent.parentElement;
              }
            }
          } catch (e) {/* Assume visibile */ }
        }
        if (!isVisible) return;
      }

      let simplifiedNode = null;

      switch (tagName) {
        case 'span':
        case 'b': case 'i': case 'em': case 'strong': case 'u': case 's': case 'strike': case 'small':
          node.childNodes.forEach(child => processNode(child, parentSimplifiedElement));
          return;

        case 'div':
          const onlyText = getOnlySignificantTextContent(node);
          if (onlyText !== null) {
            simplifiedNode = document.createElement('span');
            simplifiedNode.textContent = onlyText + ' ';
            parentSimplifiedElement.appendChild(simplifiedNode);
          } else {
            const singleChild = getSingleElementChild(node);
            if (singleChild) {
              processNode(singleChild, parentSimplifiedElement);
            } else {
              const hasRelevantContent = node.textContent.trim() !== '' || node.querySelector('input, textarea, select, label, fieldset, legend, table, p, h1, h2, h3, h4, h5, h6, li');
              if (hasRelevantContent) {
                simplifiedNode = document.createElement(tagName);
                parentSimplifiedElement.appendChild(simplifiedNode);
                node.childNodes.forEach(child => processNode(child, simplifiedNode));
              } else {
                node.childNodes.forEach(child => processNode(child, parentSimplifiedElement));
              }
            }
          }
          return;

        case 'p':
          if (parentSimplifiedElement && ['td', 'th'].includes(parentSimplifiedElement.tagName.toLowerCase())) {
            node.childNodes.forEach(child => processNode(child, parentSimplifiedElement));
          } else {
            const hasRelevantContent = node.textContent.trim() !== '' || node.querySelector('input, textarea, select, label, fieldset, legend, table, h1, h2, h3, h4, h5, h6, li, ul, ol');
            if (hasRelevantContent) {
              simplifiedNode = document.createElement(tagName);
              parentSimplifiedElement.appendChild(simplifiedNode);
              node.childNodes.forEach(child => processNode(child, simplifiedNode));
            } else {
              node.childNodes.forEach(child => processNode(child, parentSimplifiedElement));
            }
          }
          return;

        case 'input': case 'textarea': case 'select': case 'label':
        case 'form': case 'fieldset': case 'legend':
          simplifiedNode = document.createElement(tagName);
          simplifyElement(node, simplifiedNode); // simplifyElement si occuperà di non copiare readonly
          if (isOriginallyHidden && ['input', 'select', 'textarea'].includes(tagName)) {
            simplifiedNode.setAttribute('data-originally-hidden', 'true');
          }
          if (tagName === 'select') {
            const options = node.querySelectorAll('option');
            options.forEach(opt => {
              const simplifiedOpt = document.createElement('option');
              simplifiedOpt.value = opt.value;
              simplifiedOpt.textContent = opt.textContent ? opt.textContent.trim().replace(/\s+/g, ' ') : '';
              if (opt.selected) simplifiedOpt.setAttribute('selected', '');
              if (opt.disabled) simplifiedOpt.setAttribute('disabled', '');
              // non copiamo readonly per le option, non è standard
              simplifiedNode.appendChild(simplifiedOpt);
            });
          }
          parentSimplifiedElement.appendChild(simplifiedNode);
          if (['form', 'label', 'fieldset', 'legend'].includes(tagName)) {
            node.childNodes.forEach(child => processNode(child, simplifiedNode));
          }
          break;

        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        case 'li': case 'ul': case 'ol':
        case 'table': case 'thead': case 'tbody': case 'tfoot': case 'tr': case 'th': case 'td':
          const hasRelevantContent = node.textContent.trim() !== '' || node.querySelector('input, textarea, select, label, fieldset, legend, table, p, h1, h2, h3, h4, h5, h6, li');
          if (hasRelevantContent) {
            simplifiedNode = document.createElement(tagName);
            if (['table', 'th', 'td'].includes(tagName)) {
              if (node.hasAttribute('colspan')) simplifiedNode.setAttribute('colspan', node.getAttribute('colspan'));
              if (node.hasAttribute('rowspan')) simplifiedNode.setAttribute('rowspan', node.getAttribute('rowspan'));
              if (tagName === 'th' && node.hasAttribute('scope')) simplifiedNode.setAttribute('scope', node.getAttribute('scope'));
            }
            parentSimplifiedElement.appendChild(simplifiedNode);
            node.childNodes.forEach(child => processNode(child, simplifiedNode));
          } else {
            node.childNodes.forEach(child => processNode(child, parentSimplifiedElement));
          }
          break;

        default:
          node.childNodes.forEach(child => processNode(child, parentSimplifiedElement));
          break;
      }

    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue.trim().replace(/\s+/g, ' ');
      if (text) {
        if (parentSimplifiedElement && !['script', 'style', 'button'].includes(parentSimplifiedElement.tagName?.toLowerCase())) {
          parentSimplifiedElement.appendChild(document.createTextNode(text + ' '));
        }
      }
    }
  }
  // ... (resto della logica di extractAndSimplifyForms_logic come prima) ...

  if (forms.length === 0) {
    return "<p style=\"padding:10px; color:gray;\">Nessun tag <form> trovato nella pagina.</p>";
  }

  forms.forEach((form, index) => {
    const simplifiedForm = document.createElement('form');
    simplifyElement(form, simplifiedForm);

    if (!simplifiedForm.hasAttribute('id') || simplifiedForm.getAttribute('id').trim() === '') {
      const randomId = 'form-' + Math.random().toString(36).substring(2, 10);
      simplifiedForm.setAttribute('id', randomId);
    }

    form.childNodes.forEach(node => processNode(node, simplifiedForm));

    // Post-Processing per riordino label
    const labels = simplifiedForm.querySelectorAll('label[for]');
    labels.forEach(label => {
      const labelFor = label.getAttribute('for');
      if (!labelFor) return;
      // Bisogna fare attenzione a ID con caratteri speciali per CSS.escape
      const targetElements = simplifiedForm.querySelectorAll(`#${CSS.escape(labelFor)}`);
      if (targetElements.length > 0) {
        const targetElement = targetElements[0];
        const currentPrevSibling = targetElement.previousElementSibling;
        if (currentPrevSibling !== label) {
          try {
            targetElement.parentNode.insertBefore(label, targetElement);
          } catch (e) { console.warn(`Impossibile spostare la label per '${labelFor}':`, e); }
        }
      }
    });

    const wrappingLabels = simplifiedForm.querySelectorAll('label');
    wrappingLabels.forEach(label => {
      const nestedInput = label.querySelector('input, select, textarea');
      if (nestedInput && nestedInput.parentNode === label) {
        if (label.parentNode) { 
             label.parentNode.insertBefore(nestedInput, label.nextSibling);
             if (nestedInput.nextSibling) {
                label.parentNode.insertBefore(document.createTextNode(' '), nestedInput.nextSibling);
             } else {
                label.parentNode.appendChild(document.createTextNode(' '));
             }
        }
      }
    });

    const potentialServiceFields = simplifiedForm.querySelectorAll(
      'input[data-originally-hidden="true"], select[data-originally-hidden="true"], textarea[data-originally-hidden="true"]'
    );
    potentialServiceFields.forEach(element => {
      const elementId = element.id;
      let hasLabel = false;
      if (elementId) {
        if (simplifiedForm.querySelector(`label[for="${CSS.escape(elementId)}"]`)) hasLabel = true;
      }
      if (!hasLabel && element.parentElement && element.parentElement.tagName === 'LABEL') {
        hasLabel = true;
      }
      let hasPlaceholder = element.hasAttribute('placeholder') && element.placeholder.trim() !== '';
      let hasPrecedingText = false;
      let sibling = element.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.TEXT_NODE && sibling.nodeValue.trim() !== '') {
          hasPrecedingText = true;
          break;
        }
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName !== 'LABEL' && sibling.textContent.trim() !== '') {
            hasPrecedingText = true;
            break;
        }
        sibling = sibling.previousSibling;
      }

      if (!hasLabel && !hasPlaceholder && !hasPrecedingText) {
        element.remove();
      } else {
        element.removeAttribute('data-originally-hidden');
      }
    });

    if (simplifiedForm.innerHTML.trim() !== '') {
      let formTitleText = `Form ${index + 1}`;
      const ariaLabel = form.getAttribute('aria-label');
      const ariaLabelledBy = form.getAttribute('aria-labelledby');
      const h1 = document.querySelector('h1'); 
      
      if (ariaLabel) {
        formTitleText = ariaLabel;
      } else if (ariaLabelledBy) {
        const el = document.getElementById(ariaLabelledBy);
        if (el) formTitleText = el.textContent.trim().replace(/\s+/g, ' ');
      } else if (form.closest('section')?.getAttribute('aria-label')) { // Optional chaining
        formTitleText = form.closest('section').getAttribute('aria-label');
      } else if (h1?.textContent.trim()) { // Optional chaining
        formTitleText = h1.textContent.trim().replace(/\s+/g, ' ');
      }
      const firstLegend = form.querySelector('fieldset > legend');
      if (formTitleText === `Form ${index + 1}` && firstLegend?.textContent.trim()) { // Optional chaining
          formTitleText = firstLegend.textContent.trim().replace(/\s+/g, ' ');
      }

      const formHeader = `<h3>${formTitleText} (Semplificato)</h3>`;
      simplifiedFormsHtml.push(formHeader + simplifiedForm.outerHTML);
    } else {
      simplifiedFormsHtml.push(`<!-- Form originale (indice ${index}) vuoto o non contenente elementi semplificabili -->`);
    }
  });

  return simplifiedFormsHtml.join('\n\n<hr style="margin: 20px 0; border: 1px dashed #ccc;">\n\n');
}
window.extractAndSimplifyForms_content = extractAndSimplifyForms_logic;


// ... (window.assignFormValuesInPage come prima) ...
window.assignFormValuesInPage = function(dataToAssign) {
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
                            if (element.value === valore || (valore === 'OK' && type === 'radio')) {
                                element.checked = true;
                                assignmentsCount++;
                            } else {
                                console.log(`Content script: Radio "${id}" (value="${element.value}") non selezionato con valore JSON "${valore}".`);
                            }
                            break;
                        case 'checkbox':
                            if (valore === 'OK' || valore === true || String(valore).toLowerCase() === 'true') {
                                element.checked = true;
                            } else if (valore === 'KO' || valore === false || String(valore).toLowerCase() === 'false') {
                                element.checked = false;
                            }
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
                 if(element.value === valore || ( (type === 'checkbox' || type === 'radio') && element.checked === (valore === 'OK' || valore === true || String(valore).toLowerCase() === 'true') ) ){
                     console.log(`Content script: Valore assegnato correttamente a "${id}".`);
                 } else if (type !== 'file' && (tagName === 'input' || tagName === 'textarea' || tagName === 'select')) { 
                     console.warn(`Content script: Valore per "${id}" potrebbe non essere stato assegnato come previsto. Element.value: "${element.value}", JSON value: "${valore}"`);
                     if(tagName === 'select') errorMessages.push(`Per select "${id}", il valore "${valore}" potrebbe non essere un'opzione valida.`);
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