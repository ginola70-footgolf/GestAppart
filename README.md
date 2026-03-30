# 🏠 GestAppart — Gestione Spese Appartamenti

App web per gestire le spese di più appartamenti. Funziona completamente offline nel browser, senza server o database. Tutti i dati vengono salvati nel `localStorage` del browser.

## 🚀 Utilizzo su GitHub Pages

1. Crea un repository su GitHub (es. `gestappart`)
2. Carica il file `index.html` nella root del repository
3. Vai su **Settings → Pages → Branch: main → Save**
4. L'app sarà disponibile su `https://tuousername.github.io/gestappart`

## ✨ Funzionalità

### 🏢 Appartamenti
- Aggiungi e gestisci più appartamenti con nome, indirizzo, piano, superficie
- Vista rapida dei totali spese per appartamento

### 💳 Spese
- Registra spese con: data, importo, appartamento, causale, dettaglio, fornitore, n° ricevuta
- Filtra per appartamento, anno, causale o testo libero
- Modifica ed elimina spese esistenti

### 📊 Report
- Tabella riepilogativa per **appartamento × anno × causale**
- Grafico a barre del trend annuale per ogni appartamento
- Filtri per anno e appartamento

### 🔔 Scadenze
- Inserisci scadenze con data, appartamento, causale e importo stimato
- Sezioni: **Scadute** / **In scadenza** / **Completate**
- Badge colorati con giorni mancanti
- Marca scadenze come completate

### 💾 Backup
- **Esporta** i dati in formato JSON
- **Importa** un backup precedente

## 📋 Causali predefinite

Condominio · Manutenzione · Utenze · Assicurazione · Tasse / IMU · Affitto · Ristrutturazione · Amministratore · Altro

---
*Un solo file HTML, nessuna dipendenza, funziona ovunque.*
