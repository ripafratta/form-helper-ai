# HTML Form Helper

Estensione per Google Chrome per facilitare l'interazione con i form HTML: estrae la struttura essenziale dei form da una pagina web, permette di visualizzarne e modificarne il codice sorgente semplificato, salvarlo, e utilizzare dati strutturati (JSON) per compilare automaticamente i campi.

## Funzionalità

*   **Estrazione Form:** Identifica e estrae i form HTML presenti nella pagina attiva con algoritmi avanzati di riconoscimento.
*   **Semplificazione HTML:** Rimuove elementi e attributi non essenziali per ottenere una struttura pulita e focalizzata sui campi compilabili.
*   **Visualizzazione Flessibile:** Permette di passare tra una **Anteprima HTML** (rendering del codice estratto) e la visualizzazione del **Codice Sorgente** modificabile.
*   **Modifica Codice Sorgente:** Nella vista codice sorgente, è possibile modificare l'HTML estratto. Le modifiche possono essere "applicate" per aggiornare la vista.
*   **Copia HTML:** Copia negli appunti il codice HTML estratto e semplificato.
*   **Salva HTML:** Salva l'HTML estratto come file `.html`, includendo stili CSS di base per una buona leggibilità.
*   **Caricamento Dati JSON:** Carica dati per la compilazione dei campi da un file `.json` o copiandoli/incollandoli direttamente.
*   **Assegnazione Valori:** Compila automaticamente i campi del form nella pagina web attiva utilizzando i dati caricati.
*   **Messaggi di Stato:** Fornisce feedback visivo sull'esito delle operazioni.

## Funzionalità AI

*   **Configurazione AI:** Permette di selezionare un provider LLM (Google Gemini, OpenAI ChatGPT) e inserire la relativa chiave API.
*   **Mapping Semantico con AI:** Analizza l'HTML del form estratto e i dati JSON forniti dall'utente utilizzando l'LLM configurato per creare mapping semantici intelligenti.
*   **Revisione del Mapping:** Il JSON generato dall'AI viene mostrato per controllo e modifica prima dell'applicazione.
*   **Assegnazione Valori Mappati dall'AI:** Applica i valori utilizzando il JSON mappato dall'AI.

## Logica di Estrazione Form

### Algoritmo di Riconoscimento Form

L'estensione utilizza un **sistema a doppio livello** per identificare e estrarre i form:

#### 1. **Form Standard (`<form>`)**
- Rileva tutti gli elementi `<form>` presenti nella pagina
- Estrae la struttura interna preservando la gerarchia semantica
- Mantiene attributi essenziali: `id`, `name`, `action`, `method`

#### 2. **Form Logici (Pattern Recognition)**
L'estensione identifica anche **contenitori logici** che funzionano come form senza utilizzare il tag `<form>`:

**Criteri di Identificazione:**
- Elementi con `role="form"` o `role="search"`
- Contenitori con almeno 2 campi input O 1 campo input + 1 button
- Fieldset con elementi interattivi
- Sezioni con attributi `aria-label` o `aria-labelledby`

**Filtri di Qualità:**
- Esclude contenitori troppo generici (>500 caratteri di testo, >30 elementi figli)
- Verifica la densità di elementi interattivi
- Controlla la visibilità degli elementi

### Sistema di Associazione Etichette

L'estensione utilizza un **algoritmo gerarchico a 5 livelli** per associare etichette ai campi:

#### **Livello 1: Associazione Diretta (Priorità Massima)**
```html
<label for="campo1">Nome</label>
<input id="campo1" type="text">
```

#### **Livello 2: ARIA Labelledby**
```html
<div id="etichetta">Email</div>
<input aria-labelledby="etichetta" type="email">
```

#### **Livello 3: ARIA Label**
```html
<input aria-label="Telefono" type="tel">
```

#### **Livello 4: Componente Wrapper (Frameworks Moderni)**
Per framework come Angular, React, Vue:
```html
<p-calendar aria-label="Data Nascita">
  <input id="data" type="tel">
</p-calendar>
```

**Pattern Riconosciuti:**
- `<label>Testo</label><custom-component>...</custom-component>`
- `<div>Etichetta:</div><wrapper><input></wrapper>`
- Componenti con prefissi: `p-`, `app-`, `sdk-`, `mat-`, `ion-`, `ng-`, `v-`, `react-`

#### **Livello 5: Label Wrappante (Ultima Risorsa)**
```html
<label>
  Nome Completo
  <input type="text">
</label>
```

### Estrazione Testo Etichette

**Algoritmo di Pulizia del Testo:**
1. **Rimozione Elementi Interattivi:** Elimina input, button, select annidati
2. **Gestione Commenti:** Ignora commenti HTML/Angular (`<!---->`)
3. **Estrazione Nodi Testo:** Naviga ricorsivamente i nodi DOM
4. **Fallback al Title:** Usa l'attributo `title` se il testo non è disponibile
5. **Normalizzazione:** Rimuove spazi eccessivi e caratteri di separazione finali

### Elementi Processati ed Esclusi

#### **Elementi Inclusi:**
- ✅ `<input>` (tutti i tipi eccetto hidden, submit, reset, image, button)
- ✅ `<textarea>`
- ✅ `<select>` e `<option>`
- ✅ `<fieldset>` e `<legend>`
- ✅ `<label>` (con testo estratto pulito)
- ✅ Elementi con ruoli: `textbox`, `combobox`, `listbox`, `checkbox`, `radio`, `switch`, `slider`

#### **Elementi Esclusi:**
- ❌ `<button>` (tutti i tipi)
- ❌ `<input type="button|submit|reset|image|hidden">`
- ❌ Elementi con ruoli: `button`, `spinbutton`, `searchbox`
- ❌ Script, stili, metadata (`<script>`, `<style>`, `<head>`, etc.)
- ❌ Elementi di navigazione (`<nav>`, `<header>`, `<footer>`)
- ❌ Elementi nascosti senza etichette/placeholder

### Preservazione Semantica

**Attributi Essenziali Mantenuti:**
- Identificatori: `id`, `name`
- Tipi e valori: `type`, `value`, `placeholder`
- Stato: `required`, `checked`, `selected`, `disabled`, `readonly`
- Associazioni: `for`, `aria-label`, `aria-labelledby`
- Vincoli: `min`, `max`, `step`, `pattern`
- Accessibilità: `title`, `role`

**Struttura HTML Preservata:**
- Gerarchia form > fieldset > legend
- Associazioni label-input
- Tabelle con colspan/rowspan
- Liste e raggruppamenti semantici

## Installazione

Per installare l'estensione in Chrome (o browser compatibili come Brave, Edge):

1.  Scarica i file del progetto (clona il repository o scarica lo ZIP).
2.  Apri Chrome e vai su `chrome://extensions/`.
3.  Abilita la **Modalità sviluppatore** (di solito un interruttore in alto a destra).
4.  Clicca sul pulsante **Carica unpacked** (o "Carica estensione non pacchettizzata").
5.  Seleziona la cartella che contiene i file dell'estensione (quella con `manifest.json`).
6.  L'estensione dovrebbe apparire nell'elenco e la sua icona comparirà nella barra degli strumenti di Chrome.

## Utilizzo

### Estrazione Form

1.  Naviga alla pagina web che contiene il form che desideri estrarre.
2.  Clicca sull'icona dell'estensione "Form Helper" nella barra degli strumenti di Chrome.
3.  Clicca sul pulsante **"Estrai Forms"**. L'estensione analizzerà la pagina con gli algoritmi descritti sopra.
4.  Il campo "Nome Pagina" verrà pre-compilato con il titolo della pagina.

### Visualizzazione e Modifica

4.  **Visualizzazione HTML:** Utilizza i radio button "Anteprima" e "Codice Sorgente" per alternare la visualizzazione.
    *   **Anteprima:** Mostra come appare il form estratto con gli stili di base.
    *   **Codice Sorgente:** Mostra il codice HTML grezzo in una textarea modificabile.
5.  **Modifica:** Se modifichi il codice, clicca su **"Applica Modifiche al Codice"** per aggiornare l'anteprima.

### Azioni sull'HTML

6.  **"Copia HTML"**: Copia il contenuto HTML negli appunti.
7.  **"Salva come HTML"**: Scarica l'HTML come file `.html` con stili inclusi.

### Compilazione Automatica

8.  **Dati per Compilazione:** Incolla i tuoi dati JSON nella textarea o clicca **"Carica file .json"**.
9.  **Assegnazione Valori:** Clicca **"Assegna Valori al Form"** per compilare automaticamente i campi.

### Configurazione e Mapping AI (Opzionale)

10. **Configurazione AI:** Seleziona un modello LLM specifico e inserisci la tua chiave API.
11. **Mapping con AI:** Clicca **"Mappa Dati con AI"** per creare mapping semantici intelligenti.
12. **Verifica e Applicazione:** Controlla il mapping suggerito e clicca **"Assegna Valori (da Suggerimento AI)"**.

## Formato Dati JSON per la Compilazione

I dati per la compilazione diretta devono essere forniti come un **array di oggetti JSON**:

```json
[
  { "id": "nomeUtente", "valore": "Mario" },
  { "id": "cognomeUtente", "valore": "Rossi" },
  { "id": "email", "valore": "mario.rossi@example.com" },
  { "id": "checkboxAccetto", "valore": "OK" },      
  { "id": "radioOpzione2", "valore": "ValoreOpzione2" }, 
  { "id": "commenti", "valore": "Questo è un commento di prova." },
  { "id": "paese", "valore": "IT" } 
]
```

### Note sul Formato Valore:

- **Text/Email/Password/Number/URL/Tel/Date/Time/Textarea/Select:** Valore stringa esatta
- **Checkbox:** `"OK"`, `true`, `"true"` per selezionare; `"KO"`, `false`, `"false"` per deselezionare
- **Radio:** L'ID deve corrispondere alla specifica opzione radio da selezionare
- **File Input:** Non supportati per motivi di sicurezza

## Compatibilità Framework

L'estensione è ottimizzata per funzionare con:

- ✅ **HTML Puro** - Form standard e strutture personalizzate
- ✅ **Angular** - Componenti PrimeNG (p-calendar, p-dropdown, etc.)
- ✅ **React** - Componenti Material-UI, Ant Design, etc.
- ✅ **Vue.js** - Element UI, Vuetify, etc.
- ✅ **Framework CSS** - Bootstrap, Tailwind, Foundation
- ✅ **Librerie UI** - jQuery UI, Semantic UI, etc.

## Limitazioni

- **Form Dinamici Complessi:** Form generati completamente via JavaScript senza markup HTML potrebbero non essere riconosciuti
- **Shadow DOM:** Elementi all'interno di Shadow DOM potrebbero non essere accessibili
- **Iframe:** Form in iframe separati richiedono elaborazione individuale
- **Campi senza ID:** L'assegnazione automatica funziona tramite ID; campi senza ID non sono compilabili automaticamente

## Sicurezza e Privacy

- **Nessun Invio Dati:** Tutti i dati rimangono locali nel browser
- **Chiavi API:** Salvate localmente, mai trasmesse a terzi
- **Sandboxing:** L'anteprima