# 🏠 GestAppart — Gestione Spese Appartamenti

App web per gestire le spese di più appartamenti. L'interfaccia è ospitata su GitHub Pages; il salvataggio condiviso può essere configurato su Cloudflare Workers + D1.

## Cloudflare Workers + D1

Il backend è incluso in `cloudflare/`. **La configurazione e la distribuzione Cloudflare richiedono l'accesso al tuo account Cloudflare**, quindi le operazioni indicate sotto vanno eseguite dal proprietario dell'account.

### 1. Crea il database e configura Wrangler

Installa Node.js e Wrangler (comandi dalla cartella `cloudflare/`):

```sh
npm install -g wrangler
npx wrangler login
npx wrangler d1 create gestappart-db
```

Copia il `database_id` restituito dal comando nel campo `database_id` di `cloudflare/wrangler.toml`, sostituendo `REPLACE_WITH_DATABASE_ID`. Poi inizializza il database e distribuisci il Worker:

```sh
npx wrangler d1 execute gestappart-db --remote --file=./schema.sql
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

Imposta una password lunga e unica per `APP_PASSWORD`. Per `SESSION_SECRET` usa un valore casuale robusto (almeno 32 byte), diverso dalla password. Questi segreti vanno inseriti ai prompt Wrangler, **mai nel codice o in GitHub**.

### 2. Configura l'indirizzo API

Dopo il deploy, Wrangler mostra un URL simile a `https://gestappart-api.<tuo-subdominio>.workers.dev`. Apri `cloudflare-sync.js` e sostituisci `https://REPLACE_WITH_WORKER_SUBDOMAIN.workers.dev` in `API_BASE` con l'URL effettivo.

### 3. Collega l'adattatore alla pagina

Aggiungi questa riga **dopo lo script inline esistente e prima di `</body>`** in `index.html`:

```html
<script src="./cloudflare-sync.js"></script>
```

Fai commit e pubblica su GitHub Pages. L'origine autorizzata dal Worker è già impostata su `https://ginola70-footgolf.github.io` in `cloudflare/wrangler.toml`. Per sviluppo locale, aggiungi l'origine `http://localhost:...` a `ALLOWED_ORIGINS` e distribuisci nuovamente il Worker.

Al primo accesso inserisci `APP_PASSWORD`: se D1 è vuoto, l'app importa una sola volta i dati già presenti nel browser; altrimenti carica il contenuto del database. Successivamente il database Cloudflare è la fonte condivisa e il contenuto `localStorage` del browser viene rimosso. Esporta comunque backup JSON periodici.

### API e protezioni

- `POST /api/login` scambia la password per un token di sessione firmato, conservato solo in memoria nel browser.
- `GET /api/data` e `POST /api/data` richiedono il token e leggono/scrivono il record singleton in D1.
- Il Worker applica una allowlist CORS, limita le dimensioni del payload e non espone chiavi amministrative nel frontend.
- L'accesso è condiviso da chiunque conosca la password: non usare una password riutilizzata e cambiarla con `npx wrangler secret put APP_PASSWORD` se viene divulgata.

## GitHub Pages

L'interfaccia continua a essere pubblicata da GitHub Pages. Se il repo è pubblico, tutti i file committati nel repo sono pubblici: **non inserire backup o dati personali nei file JSON del repository**. Cloudflare D1 non rende privato ciò che è già stato committato pubblicamente. Valuta la rimozione dei dati sensibili dal repository e la rotazione di eventuali credenziali pubblicate.

## Funzionalità

- Gestione di appartamenti, spese, report e scadenze
- Filtri per appartamento, anno, causale e testo
- Backup e ripristino JSON
- Sincronizzazione autenticata con Cloudflare D1, una volta completata la configurazione

Il Worker è in `cloudflare/worker.js`; lo schema SQL è in `cloudflare/schema.sql`.
