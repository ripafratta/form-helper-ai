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
          attr === 'aria-label' || attr === 'aria-labelledby' || attr === 'aria-describedby' || attr === 'role') {
        if (originalElement.hasAttribute(attr) && attrValue !== null && attrValue.trim() !== '') {
          newElement.setAttribute(attr, attrValue);
        }
      } else if (attr === 'type') {
        let typeToSet = originalElement.getAttribute('type');
        const role = originalElement.getAttribute('role');
        if (!typeToSet && role) {
            const roleToTypeMapping = {
                'textbox': 'text', 'checkbox': 'checkbox', 'radio': 'radio',
                'button': 'button', 'listbox': 'select-one', // o select-multiple se multiple è true
                'combobox': 'text', 'switch': 'checkbox'
            };
            if (roleToTypeMapping[role]) {
                typeToSet = roleToTypeMapping[role];
            }
        }
        if (tagNameLower === 'button' && !typeToSet) {
            typeToSet = 'button'; // Default per <button>
        }
        if (typeToSet) {
            newElement.setAttribute('type', typeToSet);
        }
      }
      else if (attr === 'required' && originalElement.required) newElement.setAttribute('required', '');
      else if (attr === 'disabled' && originalElement.disabled) newElement.setAttribute('disabled', '');
      else if (attr === 'readonly' && originalElement.readOnly) newElement.setAttribute('readonly', '');
      else if (attr === 'multiple' && originalElement.multiple) newElement.setAttribute('multiple', '');
      else if (attr === 'value') {
        if (tagNameLower === 'input' || (tagNameLower === 'button' && !newElement.textContent && originalElement.value) ) {
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
    if (['input', 'select', 'textarea', 'button'].includes(tagName)) {
      if (tagName === 'input') {
        const inputType = element.type ? element.type.toLowerCase() : '';
        if (['hidden', 'submit', 'reset', 'image'].includes(inputType)) {
          return false;
        }
      }
      return true;
    }
    const interactiveRoles = [
      'button', 'textbox', 'checkbox', 'radio', 'switch',
      'listbox', 'combobox', 'slider', 'spinbutton', 'searchbox'
    ];
    if (role && interactiveRoles.includes(role)) {
      return true;
    }
    return false;
  }

  // MODIFICATA: Ora accetta e usa processedElementsSet
  function getAssociatedLabelText(fieldElement, processedElementsSet) {
    if (!fieldElement) return null;
    let labelText = null;
    let usedLabelElement = null;

    // 1. node.closest('label') (if input is wrapped in label)
    const closestLabel = fieldElement.closest('label');
    if (closestLabel && !processedElementsSet.has(closestLabel)) {
        const nestedInteractiveElements = Array.from(closestLabel.querySelectorAll('input, select, textarea, button, [role="button"], [role="textbox"]'))
                                            .filter(el => el !== fieldElement && isInteractiveElement(el, new Set())); // Usa un Set temporaneo per questo check
        if (nestedInteractiveElements.length === 0) {
            labelText = closestLabel.textContent;
            if (labelText) {
                usedLabelElement = closestLabel;
                return { text: labelText.trim().replace(/\s+/g, ' '), sourceElement: usedLabelElement };
            }
        }
    }

    // 2. If node.id, then document.querySelector(`label[for="${CSS.escape(node.id)}"]`)
    if (fieldElement.id) {
        try {
            const forLabel = document.querySelector(`label[for="${CSS.escape(fieldElement.id)}"]`);
            if (forLabel && !processedElementsSet.has(forLabel)) {
                labelText = forLabel.textContent;
                if (labelText) {
                    usedLabelElement = forLabel;
                    return { text: labelText.trim().replace(/\s+/g, ' '), sourceElement: usedLabelElement };
                }
            }
        } catch (e) { console.warn("Errore querySelector label[for]:", e); }
    }

    // 3. Text from `aria-labelledby` attribute on node
    const ariaLabelledBy = fieldElement.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
        const ids = ariaLabelledBy.split(' ').filter(id => id.trim() !== '');
        let combinedText = '';
        for (const id of ids) {
            const labelledByElement = document.getElementById(id);
            if (labelledByElement) { // Non marchiamo questi elementi come processati qui, potrebbe essere testo generico
                combinedText += (labelledByElement.textContent || '').trim().replace(/\s+/g, ' ') + ' ';
            }
        }
        if (combinedText.trim()) {
            return { text: combinedText.trim(), sourceElement: null };
        }
    }

    // 4. Text from `aria-label` attribute on node
    const ariaLabel = fieldElement.getAttribute('aria-label');
    if (ariaLabel) {
        return { text: ariaLabel.trim().replace(/\s+/g, ' '), sourceElement: null };
    }

    return null;
  }

  function isLogicalFormContainer(containerElement, processedElementsSetGlobal) {
    if (!containerElement || processedElementsSetGlobal.has(containerElement) ||
        containerElement.tagName.toLowerCase() === 'form' ||
        containerElement.closest('form') !== null) {
      return false;
    }
    try {
        const style = window.getComputedStyle(containerElement);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1) {
            return false;
        }
    } catch(e) { /* ignore */ }

    const role = containerElement.getAttribute('role');
    if (role === 'form' || role === 'search') {
      const interactiveDescendants = Array.from(containerElement.querySelectorAll('*')).filter(el => isInteractiveElement(el, processedElementsSetGlobal));
      if (interactiveDescendants.length > 0) {
          let hasDirectOrNestedRelevantFields = false;
          for (const desc of interactiveDescendants) {
              let current = desc.parentElement; let isSafePath = true;
              while(current && current !== containerElement) {
                  if (current.tagName.toLowerCase() === 'form' || processedElementsSetGlobal.has(current)) {
                      isSafePath = false; break;
                  }
                  current = current.parentElement;
              }
              if (isSafePath) { hasDirectOrNestedRelevantFields = true; break; }
          }
          return hasDirectOrNestedRelevantFields;
      }
      return false;
    }

    let inputLikeCount = 0; let buttonLikeCount = 0; let visibleInteractiveElementsCount = 0;
    const descendants = containerElement.querySelectorAll('*');
    for (const el of descendants) {
      if (processedElementsSetGlobal.has(el) || el.closest('form') !== null) { continue; }
      let parentCandidate = el.parentElement; let inOtherLogicalCandidate = false;
      while(parentCandidate && parentCandidate !== containerElement) {
          if (parentCandidate.hasAttribute('data-logical-form-processed')) { inOtherLogicalCandidate = true; break; }
          parentCandidate = parentCandidate.parentElement;
      }
      if(inOtherLogicalCandidate) continue;
      let isElVisible = false;
      try { const style = window.getComputedStyle(el); if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0) { isElVisible = true; } }
      catch(e) { /* ignore */ }
      if (!isElVisible) continue;
      if (isInteractiveElement(el, processedElementsSetGlobal)) {
        visibleInteractiveElementsCount++;
        const elTagName = el.tagName.toLowerCase(); const elRole = el.getAttribute('role'); const elType = el.type ? el.type.toLowerCase() : null;
        if ((elTagName === 'input' && !['submit', 'reset', 'button', 'image', 'hidden'].includes(elType)) ||
            elTagName === 'textarea' || elTagName === 'select' ||
            ['textbox', 'searchbox', 'listbox', 'combobox', 'slider', 'spinbutton', 'switch', 'checkbox', 'radio'].includes(elRole) ) {
          inputLikeCount++;
        } else if (elTagName === 'button' || elRole === 'button' || (elTagName === 'input' && ['button', 'submit', 'reset', 'image'].includes(elType))) {
          buttonLikeCount++;
        }
      }
    }
    const meetsDensityCriteria = (inputLikeCount >= 1 && buttonLikeCount >= 1) || inputLikeCount >= 2;
    const isSearchContainerWithInput = (role === 'search' && inputLikeCount >=1);
    if (meetsDensityCriteria || isSearchContainerWithInput) {
      if (visibleInteractiveElementsCount < 1) return false;
      if (containerElement.tagName.toLowerCase() === 'fieldset' && visibleInteractiveElementsCount >=1) return true;
      if (containerElement.hasAttribute('aria-label') || containerElement.hasAttribute('aria-labelledby')) return true;
      const textContent = containerElement.textContent.trim().replace(/\s+/g, ' ');
      const childElementCount = containerElement.children.length;
      if (textContent.length > 500 && childElementCount > 30 && inputLikeCount < 3 && buttonLikeCount < 1) { return false; }
      if (textContent.length > 0 || childElementCount > 0 || visibleInteractiveElementsCount >=1) { return true; }
    }
    return false;
  }

  function getSingleElementChild(node) {
    if (!node || !node.childNodes) return null; let elementChild = null; let elementCount = 0;
    for (let i = 0; i < node.childNodes.length; i++) { const child = node.childNodes[i]; if (child.nodeType === Node.ELEMENT_NODE) { elementCount++; elementChild = child; } else if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim() !== '') { return null; } }
    return elementCount === 1 ? elementChild : null;
  }

  function getOnlySignificantTextContent(node) {
    if (!node || !node.childNodes || node.childNodes.length === 0) return null; let textContent = null; let foundElement = false; let significantTextCount = 0;
    for (let i = 0; i < node.childNodes.length; i++) { const child = node.childNodes[i]; if (child.nodeType === Node.ELEMENT_NODE) { foundElement = true; break; } else if (child.nodeType === Node.TEXT_NODE) { const trimmedText = child.nodeValue.trim(); if (trimmedText !== '') { significantTextCount++; if (significantTextCount > 1) return null; textContent = trimmedText.replace(/\s+/g, ' '); } } }
    return (!foundElement && significantTextCount === 1) ? textContent : null;
  }

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
          if (tagName === 'input' && ['submit', 'reset', 'hidden'].includes(node.type?.toLowerCase())) {
              processedElementsSet.add(node); return;
          }

          let isOriginallyHidden = false;
          let checkVisibility = !['form', 'fieldset', 'legend', 'label', 'option'].includes(tagName);

          if (['input', 'select', 'textarea', 'button'].includes(tagName) ||
              ['textbox', 'checkbox', 'radio', 'button', 'listbox', 'combobox', 'switch', 'slider', 'spinbutton'].includes(role)) {
              try {
                  const style = window.getComputedStyle(node);
                  if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.01) {
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
                                      isVisible = false; break;
                                  }
                              } catch (e) { /* ignora */ }
                              parent = parent.parentElement;
                          }
                      }
                  } catch (e) {/* Assume visibile */ }
              }
              if (!isVisible) { processedElementsSet.add(node); return; }
          }

          let simplifiedNode = null;

          switch (tagName) {
              case 'span':
              case 'b': case 'i': case 'em': case 'strong': case 'u': case 's': case 'strike': case 'small':
                  node.childNodes.forEach(child => processNode(child, parentSimplifiedElement, processedElementsSet));
                  // Non marcare questi tag inline come processati a meno che non abbiano un ID / ruolo significativo
                  // Questo previene che una label che li contiene venga skippata
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
                  // Se la label è già stata usata (es. da getAssociatedLabelText per un campo precedente),
                  // non la processiamo di nuovo. Il check all'inizio di processNode lo gestisce.
                  // Questa logica si applica se la label non è stata ancora "consumata".
                  if (node.textContent.trim() || node.querySelector('input, select, textarea, button')) { // Ha testo o contiene un input
                      simplifiedNode = document.createElement('label');
                      simplifyElement(node, simplifiedNode); // Copia 'for', 'id', ecc.
                      parentSimplifiedElement.appendChild(simplifiedNode);
                      processedElementsSet.add(node); // Marca la label originale come processata

                      node.childNodes.forEach(child => processNode(child, simplifiedNode, processedElementsSet));
                  } else {
                      // Label vuota o non significativa (senza testo e senza input figli diretti)
                      processedElementsSet.add(node); // Marca come processata e ignora
                  }
                  break; // Esce dallo switch

              case 'input': case 'textarea': case 'select': case 'button':
              case 'form': case 'fieldset': case 'legend':
                  let effectiveTagName = tagName;
                  const effectiveRole = node.getAttribute('role');
                  if (effectiveRole) {
                      const roleToTag = {
                          'textbox': 'input', 'checkbox': 'input', 'radio': 'input', 'switch': 'input',
                          'button': 'button', 'listbox': 'select', 'combobox': 'input',
                          'slider': 'input', 'spinbutton': 'input'
                      };
                      if (roleToTag[effectiveRole]) {
                          effectiveTagName = roleToTag[effectiveRole];
                      }
                  }

                  if (['form', 'fieldset', 'legend'].includes(tagName) && !['input', 'textarea', 'select', 'button'].includes(effectiveTagName) ) {
                      simplifiedNode = document.createElement(tagName);
                      simplifyElement(node, simplifiedNode);
                      parentSimplifiedElement.appendChild(simplifiedNode);
                      processedElementsSet.add(node);
                      node.childNodes.forEach(child => processNode(child, simplifiedNode, processedElementsSet));
                  }
                  else if (['input', 'textarea', 'select', 'button'].includes(effectiveTagName)) {
                      simplifiedNode = document.createElement(effectiveTagName);
                      simplifyElement(node, simplifiedNode);

                      const labelInfo = getAssociatedLabelText(node, processedElementsSet);
                      if (labelInfo && labelInfo.text) {
                          // Non creare una nuova label se il parent è già la label sorgente
                          let skipLabelCreation = false;
                          if (labelInfo.sourceElement && parentSimplifiedElement.isSameNode(labelInfo.sourceElement)) {
                              skipLabelCreation = true;
                          }
                          // O se il parent è una label e l'input è l'unico figlio interattivo (gestione label wrappanti)
                          else if (parentSimplifiedElement.tagName === 'LABEL') {
                            const interactiveChildrenInParentLabel = Array.from(parentSimplifiedElement.querySelectorAll('input,select,textarea,button,[role]'))
                                .filter(el => isInteractiveElement(el, new Set()));
                            if (interactiveChildrenInParentLabel.length === 1 && interactiveChildrenInParentLabel[0].isSameNode(simplifiedNode)) {
                                // Questo è più complesso, per ora ci affidiamo a non duplicare se sourceElement è il parent
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
                              processedElementsSet.add(labelInfo.sourceElement); // Marca la label originale come usata
                          }
                      }

                      if (isOriginallyHidden) { // Riferito a isOriginallyHidden del campo corrente
                          simplifiedNode.setAttribute('data-originally-hidden', 'true');
                      }

                      if (effectiveTagName === 'select') {
                          const options = node.querySelectorAll('option');
                          options.forEach(opt => {
                              if (processedElementsSet.has(opt)) return;
                              const simplifiedOpt = document.createElement('option');
                              simplifiedOpt.value = opt.value;
                              simplifiedOpt.textContent = opt.textContent ? opt.textContent.trim().replace(/\s+/g, ' ') : '';
                              if (opt.selected) simplifiedOpt.setAttribute('selected', '');
                              if (opt.disabled) simplifiedOpt.setAttribute('disabled', '');
                              simplifiedNode.appendChild(simplifiedOpt);
                              processedElementsSet.add(opt);
                          });
                      } else if (effectiveTagName === 'button') {
                          if (node.value && (!node.textContent || !node.textContent.trim())) { // Usa value se textContent è vuoto
                              simplifiedNode.textContent = node.value;
                          } else if (node.textContent) {
                              simplifiedNode.textContent = node.textContent.trim().replace(/\s+/g, ' ');
                          }
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
                          if (node.hasAttribute('colspan')) simplifiedNode.setAttribute('colspan', node.getAttribute('colspan'));
                          if (node.hasAttribute('rowspan')) simplifiedNode.setAttribute('rowspan', node.getAttribute('rowspan'));
                          if (tagName === 'th' && node.hasAttribute('scope')) simplifiedNode.setAttribute('scope', node.getAttribute('scope'));
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
                  (!parentSimplifiedElement.tagName || !['script', 'style', 'button', 'label'].includes(parentSimplifiedElement.tagName.toLowerCase())) &&
                  parentSimplifiedElement.getAttribute('role') !== 'button') {
                  parentSimplifiedElement.appendChild(document.createTextNode(text + ' '));
              }
          }
      }
  }

  // 1. Process Standard <form> Elements
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

    // Post-Processing per label wrappanti (se ancora necessario)
    const wrappingLabels = simplifiedForm.querySelectorAll('label');
    wrappingLabels.forEach(label => {
      const nestedInput = label.querySelector('input, select, textarea, button');
      if (nestedInput && nestedInput.parentNode === label) {
        const inputId = nestedInput.id;
        const labelFor = label.getAttribute('for');
        if (!labelFor || (inputId && labelFor === inputId)) { // Se la label è per questo input o non ha 'for'
            if (label.parentNode && label.nextSibling !== nestedInput) { // Evita di spostare se già dopo
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
      'input[data-originally-hidden="true"], select[data-originally-hidden="true"], textarea[data-originally-hidden="true"], button[data-originally-hidden="true"]'
    );
    potentialServiceFields.forEach(element => {
      const elementId = element.id; let hasAssociatedLabel = false;
      if (elementId) if (simplifiedForm.querySelector(`label[for="${CSS.escape(elementId)}"]`)) hasAssociatedLabel = true;
      if (!hasAssociatedLabel && element.parentElement && element.parentElement.tagName === 'LABEL') hasAssociatedLabel = true;
      let hasPlaceholder = element.hasAttribute('placeholder') && element.placeholder.trim() !== '';
      let hasAriaLabel = element.hasAttribute('aria-label') && element.getAttribute('aria-label').trim() !== '';
      if (element.hasAttribute('data-originally-hidden') && !hasAssociatedLabel && !hasPlaceholder && !hasAriaLabel && !element.value && !(element.tagName === 'BUTTON' && element.textContent.trim())) {
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
      if (ariaLabel) formTitleText = ariaLabel;
      else if (ariaLabelledBy) { const el = document.getElementById(ariaLabelledBy); if (el) formTitleText = el.textContent.trim().replace(/\s+/g, ' '); }
      else if (formElement.closest('section')?.getAttribute('aria-label')) formTitleText = formElement.closest('section').getAttribute('aria-label');
      else if (h1?.textContent.trim()) formTitleText = h1.textContent.trim().replace(/\s+/g, ' ');
      const firstLegend = formElement.querySelector('fieldset > legend');
      if (formTitleText === `Form ${index + 1}` && firstLegend?.textContent.trim()) formTitleText = firstLegend.textContent.trim().replace(/\s+/g, ' ');
      const formHeader = `<h3>${formTitleText} (Semplificato)</h3>`;
      simplifiedFormsHtml.push(formHeader + simplifiedForm.outerHTML);
    }
  });

  // 2. Identifying and Processing "Logical Forms"
  const potentialContainersSelectors = [
    'div[role="form"]', 'section[role="form"]', 'div[role="search"]', 'section[role="search"]',
    'fieldset', 'article', 'main', 'div', 'section'
  ];
  let allPotentialContainers = [];
  potentialContainersSelectors.forEach(selector => { try { document.querySelectorAll(selector).forEach(el => allPotentialContainers.push(el)); } catch (e) { console.warn(`Errore selettore logici: ${selector}`, e); } });
  allPotentialContainers = Array.from(new Set(allPotentialContainers));

  allPotentialContainers.forEach((containerElement) => {
    if (processedElements.has(containerElement) || containerElement.tagName.toLowerCase() === 'form' ||
        containerElement.closest('form') !== null || containerElement.hasAttribute('data-std-form-processed') ||
        containerElement.hasAttribute('data-logical-form-processed')) {
      return;
    }
    if (isLogicalFormContainer(containerElement, processedElements)) {
      const simplifiedLogicalForm = document.createElement('form');
      simplifiedLogicalForm.setAttribute('data-logical-form', 'true');
      let formTitleText = `Form Logico ${logicalFormIndex + 1}`;
      const containerAriaLabel = containerElement.getAttribute('aria-label');
      const containerAriaLabelledBy = containerElement.getAttribute('aria-labelledby');
      if (containerAriaLabel) formTitleText = containerAriaLabel;
      else if (containerAriaLabelledBy) { const el = document.getElementById(containerAriaLabelledBy); if (el) formTitleText = el.textContent.trim().replace(/\s+/g, ' ');}
      else if (containerElement.tagName.toLowerCase() === 'fieldset') { const legend = containerElement.querySelector('legend'); if (legend && legend.textContent.trim()) formTitleText = legend.textContent.trim().replace(/\s+/g, ' ');}
      else { let prevEl = containerElement.previousElementSibling; while(prevEl) { if (['h1','h2','h3','h4','h5','h6'].includes(prevEl.tagName.toLowerCase())) { const hText = prevEl.textContent.trim().replace(/\s+/g, ' '); if (hText) { formTitleText = hText; break;}} if (prevEl.tagName.toLowerCase() === 'form' || prevEl.hasAttribute('data-logical-form') || prevEl.getAttribute('role') === 'form' || prevEl.getAttribute('role') === 'search') break; prevEl = prevEl.previousElementSibling;}}
      simplifiedLogicalForm.setAttribute('data-derived-title', formTitleText);
      let formId = containerElement.id;
      if (!formId || document.getElementById('form-log-' + formId)) formId = 'form-log-' + Math.random().toString(36).substring(2, 10);
      else formId = 'form-log-' + formId;
      simplifiedLogicalForm.setAttribute('id', formId);
      if (containerElement.hasAttribute('action')) simplifiedLogicalForm.setAttribute('action', containerElement.getAttribute('action'));
      if (containerElement.hasAttribute('method')) simplifiedLogicalForm.setAttribute('method', containerElement.getAttribute('method'));

      processedElements.add(containerElement);
      containerElement.setAttribute('data-logical-form-processed', 'true');
      containerElement.childNodes.forEach(node => processNode(node, simplifiedLogicalForm, processedElements));

      const wrappingLabelsInLogical = simplifiedLogicalForm.querySelectorAll('label');
      wrappingLabelsInLogical.forEach(label => { /* ... come prima ... */ });
      const hiddenFieldsInLogical = simplifiedLogicalForm.querySelectorAll(
        'input[data-originally-hidden="true"], select[data-originally-hidden="true"], textarea[data-originally-hidden="true"], button[data-originally-hidden="true"]'
      );
      hiddenFieldsInLogical.forEach(element => { /* ... come prima ... */ });

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