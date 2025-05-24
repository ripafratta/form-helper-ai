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

// Esempio di utilizzo:
const prompt = createFormExtractionPrompt(htmlContent, document.title);
console.log(prompt);