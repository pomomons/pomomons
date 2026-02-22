// collection.js — IndexedDB-backed Pokédex and collection screen

const Collection = (() => {
  const DB_NAME    = 'pomomons_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'caught';

  let db = null;

  // ── IndexedDB setup ─────────────────────────────────────────
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { autoIncrement: true });
          store.createIndex('by_id', 'id', { unique: false });
        }
      };

      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── Migrate localStorage → IndexedDB ─────────────────────────
  async function migrate() {
    const raw = localStorage.getItem('pm_caught');
    if (!raw) return;

    let records;
    try { records = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(records) || records.length === 0) return;

    await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const rec of records) store.add(rec);
      tx.oncomplete = () => {
        localStorage.removeItem('pm_caught');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Public: init ─────────────────────────────────────────────
  async function init() {
    if (typeof indexedDB === 'undefined') {
      console.warn('Collection: IndexedDB unavailable');
      return;
    }
    try {
      db = await openDB();
      await migrate();
    } catch (err) {
      console.warn('Collection: failed to open DB', err);
    }
  }

  // ── Public: addCaught ────────────────────────────────────────
  async function addCaught(record) {
    if (!db) {
      const list = JSON.parse(localStorage.getItem('pm_caught') || '[]');
      list.push(record);
      localStorage.setItem('pm_caught', JSON.stringify(list));
      return;
    }

    await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add(record);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });

    // Refresh grid immediately if collection screen is visible
    if (document.getElementById('screen-collection')?.classList.contains('active')) {
      render();
    }
  }

  // ── Internal: getAllCaught ───────────────────────────────────
  function getAllCaught() {
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Internal: setActiveCompanion ────────────────────────────
  function setActiveCompanion(mon) {
    SFX.play('select');
    localStorage.setItem('pm_active', mon.id);
    document.getElementById('companion-name').textContent = mon.name;
    CompanionCanvas.setMon(mon);
    render();
  }

  // ── Internal: buildCard ──────────────────────────────────────
  // catchData: null (unseen) | { count, hasShiny }
  function buildCard(mon, catchData, activeId) {
    const card = document.createElement('div');
    card.className = 'mon-card';
    if (!catchData)          card.classList.add('unseen');
    if (catchData?.hasShiny) card.classList.add('shiny');
    if (catchData && mon.id === activeId) card.classList.add('active-companion');

    // Active indicator star
    if (catchData && mon.id === activeId) {
      const star = document.createElement('span');
      star.className   = 'mon-card-active-indicator';
      star.textContent = '\u2605';
      card.appendChild(star);
    }

    // Canvas thumbnail
    const canvas  = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 64;
    MonSprite.draw(canvas, mon, { scale: 0.8, shiny: catchData?.hasShiny || false });
    card.appendChild(canvas);

    // Name
    const nameEl = document.createElement('p');
    nameEl.className   = 'mon-card-name';
    nameEl.textContent = catchData ? mon.name : '???';
    card.appendChild(nameEl);

    // Rarity label (caught mons only)
    if (catchData) {
      const rarityEl = document.createElement('p');
      rarityEl.className   = `mon-card-rarity ${mon.rarity}`;
      rarityEl.textContent = mon.rarity.toUpperCase();
      card.appendChild(rarityEl);
    }

    // Count badge (only when caught more than once)
    if (catchData?.count > 1) {
      const badge = document.createElement('span');
      badge.className   = 'mon-card-count';
      badge.textContent = `\u00d7${catchData.count}`;
      card.appendChild(badge);
    }

    // Click to set as active companion
    if (catchData) {
      card.addEventListener('click', () => setActiveCompanion(mon));
    }

    return card;
  }

  // ── Public: render ───────────────────────────────────────────
  async function render() {
    const TOTAL_MONS = typeof MONS !== 'undefined' ? MONS.length : 0;
    const grid  = document.getElementById('collection-grid');
    const count = document.getElementById('collection-count');

    if (!db) {
      if (count) count.textContent = `0 / ${TOTAL_MONS}`;
      if (grid)  grid.innerHTML    = '<p class="empty-state">Collection unavailable (storage not supported).</p>';
      return;
    }

    let allCaught;
    try {
      allCaught = await getAllCaught();
    } catch (err) {
      if (grid) grid.innerHTML = '<p class="empty-state">Could not load collection.</p>';
      return;
    }

    // Build Map<id, { count, hasShiny }>
    const caughtMap = new Map();
    for (const rec of allCaught) {
      const existing = caughtMap.get(rec.id);
      if (existing) {
        existing.count++;
        if (rec.shiny) existing.hasShiny = true;
      } else {
        caughtMap.set(rec.id, { count: 1, hasShiny: rec.shiny || false });
      }
    }

    // Update count — always, before any early return
    if (count) count.textContent = `${caughtMap.size} / ${TOTAL_MONS}`;

    if (caughtMap.size === 0) {
      grid.innerHTML = '<p class="empty-state">Complete a focus session to encounter your first Pomomon!</p>';
      return;
    }

    const activeId = parseInt(localStorage.getItem('pm_active') || '0', 10);

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const mon of MONS) {
      fragment.appendChild(buildCard(mon, caughtMap.get(mon.id) || null, activeId));
    }
    grid.appendChild(fragment);
  }

  return { init, addCaught, render };
})();
