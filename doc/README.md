# HTML Form Helper

Estensione per Google Chrome con due funzionalità di base:

 * Estrarre dalla pagina web la struttura dei form HTML, permette di visualizzarne e modificarne il codice sorgente semplificato, salvarlo;
 * Compilare in modo automatico i campi del form utilizzando dati strutturati (JSON) o semplice testo.

 Entrambe le due funzionalità supportano due diversi tipi di utilizzo:

 * 

## Funzionalità di Estrazione

*   **Estrazione Form:** Identifica e estrae i form HTML presenti nella pagina attiva con algoritmi avanzati di riconoscimento.
*   **Estrazione Form con AI:** Utilizza modelli AI (LLM) per analizzare il DOM completo della pagina e estrarre form intelligentemente con associazione automatica delle etichette.
*   **Semplificazione HTML:** Rimuove elementi e attributi non essenziali per ottenere una struttura pulita e focalizzata sui campi compilabili.
*   **Visualizzazione Flessibile:** Permette di passare tra una **Anteprima HTML** (rendering del codice estratto) e la visualizzazione del **Codice Sorgente** modificabile.
*   **Modifica Codice Sorgente:** Nella vista codice sorgente, è possibile modificare l'HTML estratto. Le modifiche possono essere "applicate" per aggiornare la vista.
*   **Copia HTML:** Copia negli appunti il codice HTML estratto e semplificato.
*   **Salva HTML:** Salva l'HTML estratto come file `.html`, includendo stili CSS di base per una buona leggibilità.

## Funzionalità di Compilazione

*   **Caricamento Dati:** Carica i dati da usare per la compilazione del form da un file `.json`, in alternativa permette di incollarli direttamente in una textarea.
*   **Assegnazione Valori:** Compila automaticamente il form della pagina web attiva utilizzando i dati caricati.
*   **Messaggi di Stato:** Fornisce feedback visivo sull'esito delle operazioni.

## Funzionalità AI avanzate

*   **Configurazione AI:** Permette di selezionare un provider LLM (Google Gemini, OpenAI ChatGPT) e inserire la relativa chiave API.
*   **Estrazione Form Intelligente:** Analizza il DOM completo della pagina utilizzando l'AI per identificare e estrarre form con associazione automatica delle etichette basata sul contesto semantico.
*   **Mapping Semantico con AI:** Analizza l'HTML del form estratto e i dati JSON forniti dall'utente utilizzando l'LLM configurato per creare mapping semantici intelligenti.
*   **Revisione del Mapping:** Il JSON generato dall'AI viene mostrato per controllo e modifica prima dell'applicazione.
*   **Assegnazione Valori Mappati dall'AI:** Applica i valori utilizzando il JSON mappato dall'AI.

## Metodologie di Estrazione Form

### 1. Estrazione Algoritmica (Pulsante "Estrai Forms")

Utilizza algoritmi JavaScript deterministici per l'estrazione rapida e precisa:

#### Algoritmo di Riconoscimento Form

L'estensione utilizza un **sistema a doppio livello** per identificare e estrarre i form:

##### **Form Standard (`<form>`)**
- Rileva tutti gli elementi `<form>` presenti nella pagina
- Estrae la struttura interna preservando la gerarchia semantica
- Mantiene attributi essenziali: `id`, `name`, `action`, `method`

##### **Form Logici (Pattern Recognition)**
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

#### Sistema di Associazione Etichette

L'estensione utilizza un **algoritmo gerarchico a 5 livelli** per associare etichette ai campi:

##### **Livello 1: Associazione Diretta (Priorità Massima)**
```html
<label for="campo1">Nome</label>
<input id="campo1" type="text">
```

##### **Livello 2: ARIA Labelledby**
```html
<div id="etichetta">Email</div>
<input aria-labelledby="etichetta" type="email">
```

##### **Livello 3: ARIA Label**
```html
<input aria-label="Telefono" type="tel">
```

##### **Livello 4: Componente Wrapper (Frameworks Moderni)**
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

##### **Livello 5: Label Wrappante (Ultima Risorsa)**
```html
<label>
  Nome Completo
  <input type="text">
</label>
```

#### Estrazione Testo Etichette

**Algoritmo di Pulizia del Testo:**
1. **Rimozione Elementi Interattivi:** Elimina input, button, select annidati
2. **Gestione Commenti:** Ignora commenti HTML/Angular (`<!---->`)
3. **Estrazione Nodi Testo:** Naviga ricorsivamente i nodi DOM
4. **Fallback al Title:** Usa l'attributo `title` se il testo non è disponibile
5. **Normalizzazione:** Rimuove spazi eccessivi e caratteri di separazione finali

### 2. Estrazione AI-Powered (Pulsante "Estrai Forms con AI")

Utilizza modelli linguistici avanzati per un'analisi semantica approfondita del DOM:

#### Vantaggi dell'Estrazione AI

**Comprensione Semantica Avanzata:**
- Analizza il contesto completo della pagina per identificare form nascosti o non convenzionali
- Riconosce pattern complessi di associazione etichetta-campo basati sul significato del contenuto
- Gestisce strutture HTML dinamiche e framework moderni con maggiore precisione

**Associazione Etichette Intelligente:**
- Deduce etichette dal contesto anche quando mancano associazioni esplicite
- Interpreta testi descrittivi, titoli di sezione e contenuti correlati
- Risolve ambiguità di associazione utilizzando il significato semantico

**Gestione Framework Avanzata:**
- Riconosce componenti personalizzati di framework JavaScript moderni
- Identifica form generati dinamicamente e single-page applications
- Estrae form da shadow DOM e strutture component-based

#### Processo di Estrazione AI

1. **Analisi DOM Completa:** L'AI riceve l'intero documento HTML della pagina
2. **Identificazione Form Intelligente:** Utilizza comprensione semantica per identificare tutti i form, anche quelli non convenzionali
3. **Associazione Etichette Contestuale:** Associa etichette basandosi sul significato e sul contesto semantico
4. **Generazione HTML Strutturato:** Produce HTML semplificato ottimizzato con etichette associate correttamente

#### Modelli AI Supportati

**Google Gemini:**
- Gemini 1.5 Flash (Veloce, ottimizzato per task rapidi)  
- Gemini 1.5 Pro (Potente, analisi approfondita)
- Gemini 2.5 Pro/Flash (Versioni avanzate in preview)
- Gemma 3 (Modelli open-source: 27B, 12B, 4B IT)

**OpenAI ChatGPT:**
- GPT-4o (Nuovo modello multimodale ottimizzato)
- GPT-4 Turbo (Modello potente per task complessi)
- GPT-3.5 Turbo (Bilanciato tra prestazioni e costi)

#### Prompt Engineering Avanzato

L'estensione utilizza prompt strutturati che includono:

**Istruzioni Dettagliate di Estrazione:**
- Regole precise per identificazione form standard e logici
- Criteri di inclusione/esclusione elementi
- Priorità gerarchiche per associazione etichette

**Gestione Visibilità e Stato:**
- Inclusione elementi nascosti con attributi significativi
- Esclusione campi readonly e disabled
- Preservazione semantica per tutti gli stati input

**Formato Output Standardizzato:**
- HTML semplificato con struttura coerente
- Titoli descrittivi per ogni form identificato
- Separatori visivi tra form diverse

#### Quando Utilizzare l'Estrazione AI

**Raccomandato per:**
- ✅ Pagine con form complessi o non convenzionali
- ✅ Single Page Applications (SPA) e framework moderni
- ✅ Form generati dinamicamente via JavaScript
- ✅ Strutture component-based (React, Angular, Vue)
- ✅ Pagine con associazioni etichetta-campo ambigue
- ✅ Form con layout personalizzati o CSS complesso

**L'estrazione algoritmica è sufficiente per:**
- ✅ Form HTML standard ben strutturati
- ✅ Pagine con markup semantico corretto
- ✅ Form con associazioni label[for] esplicite
- ✅ Strutture semplici e convenzionali

### Elementi Processati ed Esclusi

#### **Elementi Inclusi:**
- ✅ `<input>` (tutti i tipi eccetto submit, reset, image, button)
- ✅ `<input type="hidden">` **SEMPRE INCLUSO** (ignorando visibilità CSS)
- ✅ `<textarea>`
- ✅ `<select>` e `<option>`
- ✅ `<fieldset>` e `<legend>`
- ✅ `<label>` (con testo estratto pulito)
- ✅ Elementi con ruoli: `textbox`, `combobox`, `listbox`, `checkbox`, `radio`, `switch`, `slider`

#### **Elementi Esclusi:**
- ❌ `<button>` (tutti i tipi)
- ❌ `<input type="button|submit|reset|image">`
- ❌ **`<input readonly>` e `<textarea readonly>`** - SEMPRE ESCLUSI
- ❌ Elementi `disabled`
- ❌ Elementi con ruoli: `button`, `spinbutton`, `searchbox`
- ❌ Script, stili, metadata (`<script>`, `<style>`, `<head>`, etc.)
- ❌ Elementi di navigazione (`<nav>`, `<header>`, `<footer>`)

### Preservazione Semantica

**Attributi Essenziali Mantenuti:**
- Identificatori: `id`, `name`
- Tipi e valori: `type`, `value`, `placeholder`
- Stato: `required`, `checked`, `selected`, `disabled` (NON readonly)
- Associazioni: `for`, `aria-label`, `aria-labelledby`
- Vincoli: `min`, `max`, `step`, `pattern`, `multiple`
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
3.  **Scegli il metodo di estrazione:**
    *   **Estrazione Algoritmica:** Clicca **"Estrai Forms"** per un'analisi rapida con algoritmi deterministici
    *   **Estrazione AI:** Clicca **"Estrai Forms con AI"** per un'analisi semantica avanzata (richiede configurazione AI)
4.  Il campo "Nome Pagina" verrà pre-compilato con il titolo della pagina.

### Visualizzazione e Modifica

5.  **Visualizzazione HTML:** Utilizza i radio button "Anteprima" e "Codice Sorgente" per alternare la visualizzazione.
    *   **Anteprima:** Mostra come appare il form estratto con gli stili di base.
    *   **Codice Sorgente:** Mostra il codice HTML grezzo in una textarea modificabile.
6.  **Modifica:** Se modifichi il codice, clicca su **"Applica Modifiche al Codice"** per aggiornare l'anteprima.

### Azioni sull'HTML

7.  **"Copia HTML"**: Copia il contenuto HTML negli appunti.
8.  **"Salva come HTML"**: Scarica l'HTML come file `.html` con stili inclusi.

### Compilazione Automatica

9.  **Dati per Compilazione:** Incolla i tuoi dati JSON nella textarea o clicca **"Carica file .json"**.
10. **Assegnazione Valori:** Clicca **"Assegna Valori (da JSON Input)"** per compilare automaticamente i campi.

### Configurazione e Mapping AI

11. **Configurazione AI:** Nella sezione "Configura AI", seleziona un modello LLM e inserisci la tua chiave API.
12. **Mapping con AI:** Clicca **"Mappa Dati con AI"** per creare mapping semantici intelligenti.
13. **Verifica e Applicazione:** Controlla il mapping suggerito e clicca **"Assegna Valori (da Suggerimento AI)"**.

## Formato Dati JSON per la Compilazione

### Formato Standard (Assegnazione Diretta)

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

### Formato Flessibile (Input per AI)

Per il mapping AI, è possibile utilizzare formati più flessibili:

```json
[
  { "descrizione": "Nome dell'utente", "valore_dato": "Mario" },
  { "descrizione": "Cognome dell'utente", "valore_dato": "Rossi" },
  { "descrizione": "Indirizzo email", "valore_dato": "mario.rossi@example.com" },
  { "descrizione": "Accettazione termini", "valore_dato": true },
  { "descrizione": "Paese di residenza", "valore_dato": "Italia" }
]
```

L'AI interpreterà automaticamente le descrizioni e mapperà i valori agli ID appropriati dei campi del form.

### Note sul Formato Valore:

- **Text/Email/Password/Number/URL/Tel/Date/Time/Textarea/Select:** Valore stringa esatta
- **Checkbox:** `"OK"`, `true`, `"true"` per selezionare; `"KO"`, `false`, `"false"` per deselezionare
- **Radio:** L'ID deve corrispondere alla specifica opzione radio da selezionare
- **File Input:** Non supportati per motivi di sicurezza

## Configurazione AI

### Requisiti

1. **Selezione Modello:** Scegli un provider LLM tra Google Gemini e OpenAI ChatGPT
2. **Chiave API:** Inserisci la chiave API valida per il provider scelto
3. **Salvataggio:** Clicca "Salva Configurazione AI" per persistere le impostazioni

### Ottenimento Chiavi API

**Google Gemini:**
- Visita [Google AI Studio](https://aistudio.google.com/)
- Accedi con il tuo account Google
- Genera una API Key per l'accesso ai modelli Gemini

**OpenAI ChatGPT:**
- Visita [OpenAI Platform](https://platform.openai.com/)
- Accedi al tuo account OpenAI
- Vai in "API Keys" e genera una nuova chiave

### Sicurezza

- Le chiavi API sono salvate localmente nel browser
- Non vengono mai trasmesse a server terzi
- Utilizzate esclusivamente per chiamate dirette alle API ufficiali

## Compatibilità Framework

L'estensione è ottimizzata per funzionare con:

- ✅ **HTML Puro** - Form standard e strutture personalizzate
- ✅ **Angular** - Componenti PrimeNG (p-calendar, p-dropdown, etc.)
- ✅ **React** - Componenti Material-UI, Ant Design, etc.
- ✅ **Vue.js** - Element UI, Vuetify, etc.
- ✅ **Framework CSS** - Bootstrap, Tailwind, Foundation
- ✅ **Librerie UI** - jQuery UI, Semantic UI, etc.
- ✅ **Single Page Applications** - Applicazioni JavaScript moderne
- ✅ **Progressive Web Apps** - PWA con form dinamici

## Limitazioni

### Estrazione Algoritmica
- **Form Dinamici Complessi:** Form generati completamente via JavaScript senza markup HTML potrebbero non essere riconosciuti
- **Shadow DOM:** Elementi all'interno di Shadow DOM potrebbero non essere accessibili
- **Associazioni Implicite:** Etichette non associate esplicitamente possono essere perse

### Estrazione AI
- **Dipendenza API:** Richiede connessione internet e chiave API valida
- **Costi:** Utilizzo soggetto ai costi dell'API del provider scelto
- **Latenza:** Tempi di elaborazione più lunghi rispetto all'estrazione algoritmica
- **Limiti Token:** Pagine molto grandi potrebbero superare i limiti di token dell'API

### Limitazioni Generali
- **Iframe:** Form in iframe separati richiedono elaborazione individuale
- **Campi senza ID:** L'assegnazione automatica funziona tramite ID; campi senza ID non sono compilabili automaticamente
- **File Input:** Non supportati per motivi di sicurezza del browser

## Sicurezza e Privacy

- **Nessun Invio Dati Personali:** I dati del form rimangono locali nel browser
- **Chiavi API:** Salvate localmente, mai trasmesse a terzi
- **Comunicazioni API:** Solo il DOM HTML (senza dati sensibili) viene inviato per l'analisi AI
- **Sandboxing:** L'anteprima HTML utilizza sandbox per prevenire esecuzione script
- **Validazione Input:** Tutti gli input JSON vengono validati prima dell'elaborazione

## Risoluzione Problemi

### Estrazione AI Non Funziona
1. Verifica che la configurazione AI sia salvata correttamente
2. Controlla la validità della chiave API
3. Assicurati di avere connessione internet
4. Verifica che il modello scelto sia disponibile

### Form Non Estratti Correttamente
1. Prova l'estrazione AI per form complessi
2. Verifica che i form abbiano ID univoci
3. Controlla la struttura HTML della pagina
4. Considera l'utilizzo di entrambi i metodi per confronto

### Compilazione Automatica Non Funziona
1. Verifica il formato JSON dei dati
2. Controlla che gli ID nel JSON corrispondano agli ID dei campi
3. Assicurati che i campi non siano readonly o disabled
4. Utilizza il mapping AI per associazioni complesse

## Supporto e Contributi

Per segnalazioni bug, richieste di funzionalità o contributi al codice, consulta la documentazione del repository o contatta gli sviluppatori attraverso i canali ufficiali del progetto.