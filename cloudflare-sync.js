/* GestAppart Cloudflare D1 adapter.
 * Set API_BASE after deploying the Cloudflare Worker. Do not put credentials here.
 */
(() => {
  'use strict';

  const API_BASE = 'https://gestappart-api.workers.dev';
  const STORAGE_KEY = 'gestappart';
  const originalGet = DB.get;
  let cache = { apt: [], spese: [], scadenze: [] };
  let token = null;
  let ready = false;
  let saving = Promise.resolve();

  const overlay = document.createElement('div');
  overlay.id = 'cloudAuthOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(26,23,20,.78);display:flex;align-items:center;justify-content:center;padding:20px;font-family:DM Sans,sans-serif;';
  overlay.innerHTML = `
    <form id="cloudAuthForm" style="width:100%;max-width:420px;background:#FDFAF4;padding:28px;border:1px solid #D4CDB8;border-radius:4px;box-shadow:0 8px 32px rgba(0,0,0,.2)">
      <h2 style="font-family:DM Serif Display,serif;margin:0 0 8px;color:#1A1714">Collega GestAppart al cloud</h2>
      <p id="cloudAuthMessage" style="color:#6B6456;margin:0 0 16px">Inserisci la password di accesso Cloudflare per caricare i dati condivisi.</p>
      <label for="cloudPassword" style="display:block;font-size:12px;font-weight:600;margin-bottom:5px;color:#6B6456">Password</label>
      <input id="cloudPassword" type="password" autocomplete="current-password" required style="width:100%;padding:10px;border:1px solid #D4CDB8;margin-bottom:12px">
      <button id="cloudLoginButton" type="submit" style="width:100%;padding:11px;background:#C8410A;color:white;border:0;cursor:pointer">Accedi e sincronizza</button>
      <p style="font-size:11px;color:#6B6456;margin:14px 0 0">I dati vengono caricati su Cloudflare D1, non nel repository GitHub.</p>
    </form>`;
  document.body.appendChild(overlay);

  function setMessage(message, isError = false) {
    const el = document.getElementById('cloudAuthMessage');
    el.textContent = message;
    el.style.color = isError ? '#A01A1A' : '#6B6456';
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && path === '/api/data') {
        token = null;
        ready = false;
        overlay.style.display = 'flex';
        setMessage('Sessione scaduta: accedi di nuovo per continuare.', true);
      }
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    return result;
  }

  function validData(data) {
    return data && Array.isArray(data.apt) && Array.isArray(data.spese) && Array.isArray(data.scadenze);
  }

  function redraw() {
    populateAllSelects();
    renderDashboard();
    renderApt();
    renderSpese();
    if (document.getElementById('section-report').classList.contains('active')) renderReport();
    if (document.getElementById('section-scadenze').classList.contains('active')) renderScadenze();
  }

  DB.get = () => cache;
  DB.set = data => {
    if (!validData(data)) throw new Error('Archivio GestAppart non valido');
    cache = data;
    if (ready) {
      const snapshot = JSON.stringify(cache);
      saving = saving.then(async () => {
        const result = await api('/api/data', { method: 'POST', body: snapshot });
        return result;
      }).catch(error => {
        setMessage(`Errore di sincronizzazione: ${error.message}. I dati restano temporaneamente in memoria; riprova dopo la connessione.`, true);
        overlay.style.display = 'flex';
        throw error;
      });
      saving.catch(() => {});
    }
  };

  document.getElementById('cloudAuthForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('cloudLoginButton');
    const password = document.getElementById('cloudPassword').value;
    button.disabled = true;
    button.textContent = 'Connessione…';
    try {
      if (API_BASE.includes('REPLACE_WITH')) throw new Error('Prima configura API_BASE in cloudflare-sync.js con l’URL del Worker distribuito.');
      const login = await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
      token = login.token;
      const remote = await api('/api/data');
      if (remote.data && validData(remote.data)) {
        cache = remote.data;
      } else {
        const local = originalGet();
        cache = validData(local) ? local : { apt: [], spese: [], scadenze: [] };
        await api('/api/data', { method: 'POST', body: JSON.stringify(cache) });
      }
      ready = true;
      localStorage.removeItem(STORAGE_KEY);
      document.getElementById('cloudPassword').value = '';
      overlay.style.display = 'none';
      redraw();
      if (typeof toast === 'function') toast('Dati caricati e sincronizzati con Cloudflare');
    } catch (error) {
      token = null;
      ready = false;
      setMessage(`Accesso/sincronizzazione non riusciti: ${error.message}`, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Accedi e sincronizza';
    }
  });
})();
