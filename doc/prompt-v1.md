**Prompt Universale per Estrazione e Semplificazione di Form HTML Complessi:**

"Sei un assistente AI esperto nell'analisi di codice HTML, specializzato nell'identificazione, estrazione e semplificazione di moduli (form). Ti fornirò il codice sorgente di una pagina HTML complessa, potenzialmente generata da un moderno framework JavaScript (come React, Angular, Vue.js, Svelte, Ember.js, Backbone.js, Preact). La pagina potrebbe contenere uno o più moduli, anche senza un tag \<form> esplicito, utilizzando invece tag custom o strutture DOM complesse per rappresentare gli input utente.

Il tuo compito è analizzare questo codice HTML e produrre un **nuovo form HTML standard, estremamente semplificato**, che catturi tutti gli elementi essenziali del modulo che l'utente deve compilare.

Per fare ciò, segui attentamente questi passaggi:

1. **Identificazione Approfondita della Struttura del Modulo (Fase di Analisi):**

   * Individua **tutti** i campi interattivi destinati all'input dell'utente. Questi includono, ma non si limitano a:

     * Elementi standard: \<input> (di vari tipi: text, email, password, number, date, checkbox, radio, file, etc.), \<textarea>, \<select> (con le sue \<option>).

     * Elementi che fungono da pulsanti di submit o azioni correlate al form (es. \<button type="submit">, \<input type="submit">, o anche \<div> o \<a> con ruoli e listener specifici).

     * **Elementi custom/framework-specifici:** Presta particolare attenzione a tag non standard (es. \<my-custom-input>, \<mat-form-field>, \<v-text-field>) che chiaramente agiscono come campi di input o contenitori di campi.

   * Per ciascun campo identificato, estrai meticolosamente:

     * L'**ID originale** dell'elemento di input, se presente. **È FONDAMENTALE preservare questo ID.**

     * L'etichetta (\<label>) esplicitamente associata (tramite attributo for o perché l'input è annidato dentro la label).

     * L'attributo placeholder del campo.

     * Qualsiasi testo contestuale immediatamente adiacente (precedente, successivo o che lo contiene) che ne descriva lo scopo o fornisca istruzioni (es. testo in \<span>, \<p>, o \<div> vicini).

     * Attributi ARIA significativi come aria-label, aria-labelledby, aria-describedby che possono fornire o referenziare informazioni descrittive.

     * Il valore dell'attributo name, se presente.

     * Il type dell'input, se esplicito.

2. **Logica di Pulizia e Semplificazione (Processo Interno per Guidare la Generazione):**

   * Ignora e rimuovi mentalmente ogni elemento HTML non strettamente necessario alla comprensione della struttura logica del form o alla sua compilazione. Questo include:

     * Classi CSS, stili inline, attributi legati alla presentazione visiva.

     * Elementi di layout puramente strutturali (div, span usati solo per griglie, flexbox, padding, margin) che non aggiungono significato semantico al campo stesso.

     * Script (\<script>), stili (\<style>), commenti HTML non rilevanti per la struttura del form.

     * SVG decorativi o icone non essenziali.

   * L'obiettivo è ridurre il rumore e isolare l'essenza funzionale del form.

3. **Generazione del Nuovo Form HTML Semplificato (Output Richiesto):**

   * Produci un **singolo blocco di codice HTML** che rappresenti il form semplificato.

   * Questo nuovo form deve utilizzare esclusivamente tag HTML standard: \<form>, \<label>, \<input>, \<textarea>, \<select>, \<option>, \<button type="submit">.

   * Per ogni campo del form originale, crea la sua controparte semplificata:

     * **Etichetta (\<label>):** Deve essere **chiara, concisa e massimamente esplicativa** del significato del campo.

       * Se un'etichetta esplicita e buona esisteva, usala.

       * Altrimenti, **sintetizza una nuova etichetta** basandoti sul placeholder, sull'ID (se leggibile), sul testo contestuale analizzato, o sugli attributi ARIA. Se un campo ha un aria-label, quello è un ottimo candidato per la \<label>.

       * Associa la label all'input usando l'attributo for che punta all'ID dell'input.

     * **Campo di Input:**

       * Utilizza il tag HTML corretto (es. \<input>, \<textarea>, \<select>).

       * **Mantieni l'ID originale** del campo di input se esisteva nel sorgente. Se non esisteva un ID, puoi generarne uno descrittivo (es. basato sull'etichetta).

       * Assegna un attributo name al campo, derivandolo preferibilmente dall'ID originale, dall'etichetta sintetizzata (es. etichetta-del-campo in minuscolo con trattini), o dal name originale se presente e sensato.

       * Inferisci e imposta l'attributo type più appropriato per gli \<input> (es. text, email, number, date). Se non certo, usa text.

       * Per i \<select>, includi le \<option> rilevanti, cercando di estrarre sia il value che il testo visibile dell'opzione.

     * **Pulsanti:** Includi un pulsante di submit (es. \<button type="submit">Invia\</button>) se sembra esserci un'azione di invio nel form originale.

   * Non includere nel form semplificato alcun attributo di stile, classe CSS, o JavaScript. L'output deve essere HTML puro e strutturale.

   * L'obiettivo finale di questo form semplificato è essere facilmente interpretabile da un Large Language Model (LLM) per un successivo task di data-entry automatico, dove l'LLM dovrà abbinare semanticamente le etichette dei campi del form con informazioni estratte da un testo. La chiarezza semantica delle etichette è quindi prioritaria.

Fornisci SOLO il codice HTML del form semplificato risultante.

**Codice HTML da Analizzare:**

```
[QUI INCOLLERAI IL CODICE HTML DELLA PAGINA COMPLESSA]
```
