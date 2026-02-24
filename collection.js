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
      const prev = parseInt(localStorage.getItem('pm_total_catches') || '0', 10);
      localStorage.setItem('pm_total_catches', prev + 1);
      if (typeof renderStats === 'function') renderStats();
      return;
    }

    await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add(record);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });

    const prev = parseInt(localStorage.getItem('pm_total_catches') || '0', 10);
    localStorage.setItem('pm_total_catches', prev + 1);
    if (typeof renderStats === 'function') renderStats();

    // Refresh grid immediately if a collection screen is visible
    if (document.getElementById('screen-mymons')?.classList.contains('active')) renderMyMons();
    if (document.getElementById('screen-dex')?.classList.contains('active'))    renderDex();
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
    // updateCompanionDisplay is defined in app.js (loads after collection.js)
    if (typeof updateCompanionDisplay === 'function') {
      updateCompanionDisplay();
    } else {
      document.getElementById('companion-name').textContent = mon.name;
      CompanionCanvas.setMon(mon);
    }
    if (document.getElementById('screen-dex')?.classList.contains('active'))    renderDex();
    if (document.getElementById('screen-mymons')?.classList.contains('active')) renderMyMons();
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

    // Resolve current evolution stage for caught mons
    let displayMon = mon;
    let palLevel   = 1;
    if (catchData) {
      palLevel   = parseInt(localStorage.getItem(`pm_pal_level_${mon.id}`) || '1', 10);
      displayMon = typeof getMonStage === 'function' ? getMonStage(mon, palLevel) : mon;
    }

    // Canvas thumbnail
    const canvas  = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 64;
    MonSprite.draw(canvas, displayMon, { scale: 0.8, shiny: catchData?.hasShiny || false });
    card.appendChild(canvas);

    // Name
    const nameEl = document.createElement('p');
    nameEl.className   = 'mon-card-name';
    nameEl.textContent = catchData ? displayMon.name : '???';
    card.appendChild(nameEl);

    // Rarity + pal level (caught mons only)
    if (catchData) {
      const rarityEl = document.createElement('p');
      rarityEl.className   = `mon-card-rarity ${mon.rarity}`;
      rarityEl.textContent = mon.rarity.toUpperCase();
      card.appendChild(rarityEl);

      const lvlEl = document.createElement('p');
      lvlEl.className   = 'mon-card-pallvl';
      lvlEl.textContent = `LVL ${palLevel}`;
      card.appendChild(lvlEl);
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

  // ── Public: renderDex — one card per species ─────────────────
  async function renderDex() {
    const TOTAL_MONS = typeof MONS !== 'undefined' ? MONS.length : 0;
    const grid  = document.getElementById('dex-grid');
    const count = document.getElementById('dex-count');

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
      grid.innerHTML = '';
      // Still render all mons as unseen
    }

    const activeId = parseInt(localStorage.getItem('pm_active') || '0', 10);

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const mon of MONS) {
      fragment.appendChild(buildCard(mon, caughtMap.get(mon.id) || null, activeId));
    }
    grid.appendChild(fragment);
  }

  // ── Internal: buildIndividualCard — one record per catch ─────
  function buildIndividualCard(mon, rec, activeId) {
    const palLevel  = parseInt(localStorage.getItem(`pm_pal_level_${mon.id}`) || '1', 10);
    const stageMon  = typeof getMonStage === 'function' ? getMonStage(mon, palLevel) : mon;

    const card = document.createElement('div');
    card.className = 'mon-card';
    if (rec.shiny)           card.classList.add('shiny');
    if (mon.id === activeId) card.classList.add('active-companion');

    if (mon.id === activeId) {
      const star = document.createElement('span');
      star.className   = 'mon-card-active-indicator';
      star.textContent = '\u2605';
      card.appendChild(star);
    }

    const canvas  = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 64;
    MonSprite.draw(canvas, stageMon, { scale: 0.8, shiny: rec.shiny || false });
    card.appendChild(canvas);

    const nameEl = document.createElement('p');
    nameEl.className   = 'mon-card-name';
    nameEl.textContent = stageMon.name;
    card.appendChild(nameEl);

    const rarityEl = document.createElement('p');
    rarityEl.className   = `mon-card-rarity ${mon.rarity}`;
    rarityEl.textContent = mon.rarity.toUpperCase();
    card.appendChild(rarityEl);

    const lvlEl = document.createElement('p');
    lvlEl.className   = 'mon-card-pallvl';
    lvlEl.textContent = `LVL ${palLevel}`;
    card.appendChild(lvlEl);

    card.addEventListener('click', () => setActiveCompanion(mon));
    return card;
  }

  // ── Public: renderMyMons — every individual caught record ─────
  async function renderMyMons() {
    const grid  = document.getElementById('mymons-grid');
    const count = document.getElementById('mymons-count');

    if (!db) {
      if (count) count.textContent = '0';
      if (grid)  grid.innerHTML    = '<p class="empty-state">Collection unavailable.</p>';
      return;
    }

    let allCaught;
    try {
      allCaught = await getAllCaught();
    } catch (err) {
      if (grid) grid.innerHTML = '<p class="empty-state">Could not load mons.</p>';
      return;
    }

    if (count) count.textContent = allCaught.length;

    if (allCaught.length === 0) {
      grid.innerHTML = '<p class="empty-state">Catch your first Pomomon to see it here!</p>';
      return;
    }

    const activeId = parseInt(localStorage.getItem('pm_active') || '0', 10);
    const sorted   = [...allCaught].sort((a, b) => (b.caughtAt || 0) - (a.caughtAt || 0));

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const rec of sorted) {
      const mon = MONS.find(m => m.id === rec.id);
      if (!mon) continue;
      fragment.appendChild(buildIndividualCard(mon, rec, activeId));
    }
    grid.appendChild(fragment);
  }

  return { init, addCaught, renderDex, renderMyMons };
})();
