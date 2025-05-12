# HTML Form Helper

Estensione per Google Chrome per facilitare l'interazione con i form HTML: estrae la struttura essenziale dei form da una pagina web, permette di visualizzarne e modificarne il codice sorgente semplificato, salvarlo, e utilizzare dati strutturati (JSON) per compilare automaticamente i campi.

## Funzionalità

*   **Estrazione Form:** Identifica e estrae i form HTML presenti nella pagina attiva.
*   **Semplificazione HTML:** Rimuove elementi e attributi non essenziali (come script, stili, elementi nascosti senza etichette/placeholder, ecc.) per ottenere una struttura più pulita e focalizzata sui campi compilabili.
*   **Visualizzazione Flessibile:** Permette di passare tra una **Anteprima HTML** (rendering del codice estratto) e la visualizzazione del **Codice Sorgente** modificabile.
*   **Modifica Codice Sorgente:** Nella vista codice sorgente, è possibile modificare l'HTML estratto. Le modifiche possono essere "applicate" per aggiornare la vista (e i dati usati per Copia/Salva/Assegna, sebbene l'assegnazione si basi sugli ID originali).
*   **Copia HTML:** Copia negli appunti il codice HTML estratto e semplificato (o quello modificato nella textarea).
*   **Salva HTML:** Salva l'HTML estratto e semplificato (o quello modificato) come file `.html`, includendo stili CSS di base per una buona leggibilità.
*   **Caricamento Dati JSON:** Carica dati per la compilazione dei campi da un file `.json` o copiandoli/incollandoli direttamente nella textarea dedicata.
*   **Assegnazione Valori:** Compila automaticamente i campi del form nella pagina web attiva utilizzando i dati caricati, basandosi sulla corrispondenza dell'attributo `id` del campo con l'`id` specificato nel JSON.
*   **Messaggi di Stato:** Fornisce feedback visivo sull'esito delle operazioni.

## Installazione

Per installare l'estensione in Chrome (o browser compatibili come Brave, Edge):

1.  Scarica i file del progetto (clona il repository o scarica lo ZIP).
2.  Apri Chrome e vai su `chrome://extensions/`.
3.  Abilita la **Modalità sviluppatore** (di solito un interruttore in alto a destra).
4.  Clicca sul pulsante **Carica unpacked** (o "Carica estensione non pacchettizzata").
5.  Seleziona la cartella che contiene i file dell'estensione (quella con `manifest.json`).
6.  L'estensione dovrebbe apparire nell'elenco e la sua icona comparirà nella barra degli strumenti di Chrome.

## Utilizzo

1.  Naviga alla pagina web che contiene il form che desideri estrarre o compilare.
2.  Clicca sull'icona dell'estensione "Form Helper" nella barra degli strumenti di Chrome. Si aprirà il popup.
3.  **Estrazione Form:** Clicca sul pulsante **"Estrai Forms"**. L'estensione analizzerà la pagina, estrarrà e semplificherà i form e mostrerà il risultato nell'area di output. Il campo "Nome Pagina" verrà pre-compilato con il titolo della pagina.
4.  **Visualizzazione HTML:** Utilizza i radio button "Anteprima" e "Codice Sorgente" per alternare la visualizzazione.
    *   **Anteprima:** Mostra come appare il form estratto con gli stili di base.
    *   **Codice Sorgente:** Mostra il codice HTML grezzo in una textarea modificabile. Puoi apportare modifiche qui. Se modifichi il codice, clicca su **"Applica Modifiche al Codice"** per aggiornare il contenuto che verrà usato per Copia/Salva/Anteprima.
5.  **Azioni sull'HTML:**
    *   **"Copia HTML"**: Copia il contenuto HTML attualmente visualizzato/applicato negli appunti.
    *   **"Salva come HTML"**: Scarica l'HTML attualmente visualizzato/applicato come file `.html`. Il nome del file sarà basato sul contenuto del campo "Nome Pagina".
6.  **Dati per Compilazione:**
    *   Nella sezione "Dati per Compilazione (JSON)", puoi incollare i tuoi dati direttamente nella textarea o cliccare **"Carica file .json"** per selezionare un file dal tuo computer.
    *   Assicurati che i dati JSON rispettino il formato specificato (vedi sotto).
7.  **Assegnazione Valori:** Clicca sul pulsante **"Assegna Valori al Form"**. L'estensione scorrerà i dati JSON e tenterà di inserire i valori nei campi del form nella pagina web attiva che corrispondono agli ID specificati nel JSON.

## Formato Dati JSON per la Compilazione

I dati per la compilazione devono essere forniti come un **array di oggetti JSON**. Ogni oggetto deve avere due chiavi principali:

*   `id`: Una stringa che corrisponde all'attributo `id` del campo (input, textarea, select) nella pagina web.
*   `valore`: Una stringa o un valore booleano che rappresenta il dato da inserire nel campo.

**Esempio di file JSON:**

```json
[
  { "id": "nomeUtente", "valore": "Mario" },
  { "id": "cognomeUtente", "valore": "Rossi" },
  { "id": "email", "valore": "mario.rossi@example.com" },
  { "id": "checkboxAccetto", "valore": "OK" },      
  { "id": "radioOpzione2", "valore": "ValoreOpzione2" }, 
  { "id": "commenti", "valore": "Questo è un commento di prova su più righe." },
  { "id": "paese", "valore": "IT" } 
]
```

## Note sul Formato Valore:

Per input di tipo text, email, password, number, url, tel, date, time, textarea e select, il valore deve essere la stringa esatta o il numero da inserire/selezionare.
Per input di tipo checkbox, il valore "OK" (stringa), true (booleano) o "true" (stringa) selezionerà la checkbox. Il valore "KO" (stringa), false (booleano) o "false" (stringa) deselezionerà la checkbox. Altri valori per le checkbox potrebbero essere ignorati.
Per input di tipo radio, l'ID nel JSON (item.id) deve corrispondere all'ID della specifica opzione input[type=radio] che si vuole selezionare. Il valore nel JSON può essere "OK" o corrispondere all'attributo value dell'input radio (quest'ultimo è preferibile per maggiore precisione). Le altre opzioni con lo stesso name verranno automaticamente deselezionate dal browser.
Gli input[type=file] non sono supportati per motivi di sicurezza.

## Limitazioni
L'estrazione si basa principalmente sui tag <form>. Form dinamici complessi o creati senza il tag <form> potrebbero non essere riconosciuti o estratti correttamente.
La semplificazione HTML è euristica e potrebbe non funzionare perfettamente su tutti i siti web con strutture molto complesse o non standard.
L'assegnazione valori funziona principalmente tramite ID. Campi senza ID potrebbero non essere compilabili con questa funzione.

## Licenza
Questo progetto è rilasciato sotto la licenza MIT. 

## Crediti
Utilizza DOMPurify per la sanitizzazione (sebbene la logica di estrazione corrente si concentri più sulla semplificazione strutturale che sulla sanitizzazione del HTML grezzo dell'intera pagina).

Questo codice è stato realizzato con il supporto di Google AI Studio: link alla chat: https://aistudio.google.com/prompts/10V2LuSonl2oIcrxz-iBnHa6SNxnRqXNH 