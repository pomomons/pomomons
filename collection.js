// collection.js — IndexedDB-backed Pokédex and collection screen

const Collection = (() => {
  const DB_NAME    = 'pomomons_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'caught';

  let db                 = null;
  let blenderReady       = false;   // event listeners attached once
  let pendingBlend       = null;    // { key, monId, displayName, rarity }
  let isDraggingSmoothie = false;   // flag readable by card dragover handlers

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

    // Blender confirm modal — bind once
    document.getElementById('btn-blend-yes')?.addEventListener('click', async () => {
      if (!pendingBlend) return;
      const { key, monId, displayName, rarity } = pendingBlend;
      pendingBlend = null;
      document.getElementById('blender-confirm').classList.remove('active');

      try {
        await deleteRecord(key);
        addSmoothieItem(displayName, rarity);
        renderSmoothieCount();
        SFX.play('blend');
        showBlendResult(displayName);

        // Clear active companion if the blended record was active, or no species records remain
        const activeRecKey = parseInt(localStorage.getItem('pm_active_rec_key') || '0', 10);
        const remaining    = await getAllCaughtWithKeys();
        const activeId     = parseInt(localStorage.getItem('pm_active') || '0', 10);
        if (activeRecKey === key || (activeId === monId && !remaining.some(r => r.id === monId))) {
          localStorage.removeItem('pm_active');
          localStorage.removeItem('pm_active_rec_key');
          localStorage.removeItem('pm_active_pal_level');
          localStorage.removeItem('pm_active_pal_exp');
          localStorage.removeItem('pm_active_shiny');
          localStorage.removeItem('pm_active_dark');
          if (typeof updateCompanionDisplay === 'function') updateCompanionDisplay();
        }

        renderMyMons();
      } catch (err) {
        console.warn('Blend failed', err);
      }
    });

    document.getElementById('btn-blend-no')?.addEventListener('click', () => {
      pendingBlend = null;
      document.getElementById('blender-confirm').classList.remove('active');
    });
  }

  // ── Public: addCaught ────────────────────────────────────────
  async function addCaught(record) {
    // If the player has no active companion yet, this catch becomes it.
    const isFirstCatch = !localStorage.getItem('pm_active');

    if (!db) {
      const list = JSON.parse(localStorage.getItem('pm_caught') || '[]');
      list.push(record);
      localStorage.setItem('pm_caught', JSON.stringify(list));
      const prev = parseInt(localStorage.getItem('pm_total_catches') || '0', 10);
      localStorage.setItem('pm_total_catches', prev + 1);
      if (isFirstCatch) {
        const mon = MONS.find(m => m.id === record.id);
        if (mon) await setActiveCompanion(mon, { _key: list.length - 1, ...record });
      }
      if (typeof renderStats === 'function') renderStats();
      return;
    }

    const newKey = await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.add(record);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror    = () => reject(tx.error);
    });

    const prev = parseInt(localStorage.getItem('pm_total_catches') || '0', 10);
    localStorage.setItem('pm_total_catches', prev + 1);

    // First catch → auto-equip it as the companion on the main screen.
    if (isFirstCatch) {
      const mon = MONS.find(m => m.id === record.id);
      if (mon) await setActiveCompanion(mon, { _key: newKey, ...record });
    }

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

  // ── Internal: getAllCaughtWithKeys — records include their IDB primary key
  function getAllCaughtWithKeys() {
    return new Promise((resolve, reject) => {
      const results = [];
      const tx      = db.transaction(STORE_NAME, 'readonly');
      const store   = tx.objectStore(STORE_NAME);
      store.openCursor().onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          results.push({ _key: cursor.primaryKey, ...cursor.value });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Internal: deleteRecord — removes one IDB record by its primary key
  function deleteRecord(key) {
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── Internal: updateRecord — patches one IDB record by its primary key
  function updateRecord(key, updates) {
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(key);
      req.onsuccess = () => {
        if (!req.result) { resolve(); return; }
        const updated = Object.assign({}, req.result, updates);
        store.put(updated, key);
        tx.oncomplete = resolve;
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Public: updateActivePalLevel — syncs level (and current exp) to IDB
  function updateActivePalLevel(newLevel) {
    const keyStr = localStorage.getItem('pm_active_rec_key');
    if (!keyStr || !db) return Promise.resolve();
    const key = parseInt(keyStr, 10);
    if (!key) return Promise.resolve();
    localStorage.setItem('pm_active_pal_level', newLevel);
    const exp = parseInt(localStorage.getItem('pm_active_pal_exp') || '0', 10);
    return updateRecord(key, { palLevel: newLevel, palExp: exp });
  }

  // ── Internal: addSmoothieItem — persists a smoothie to pm_items
  function addSmoothieItem(monName, rarity) {
    const items = JSON.parse(localStorage.getItem('pm_items') || '[]');
    items.push({ type: 'smoothie', name: monName + ' SMOOTHIE', rarity, blendedAt: Date.now() });
    localStorage.setItem('pm_items', JSON.stringify(items));
  }

  // ── Internal: showBlendConfirm — populates and reveals the confirm modal
  function showBlendConfirm(data) {
    pendingBlend = data;
    const overlay = document.getElementById('blender-confirm');
    const nameEl  = document.getElementById('blend-name');
    if (!overlay || !nameEl) return;
    nameEl.textContent = data.displayName;
    overlay.classList.add('active');
  }

  // ── Internal: showBlendResult — brief gold flash message after blending
  function showBlendResult(monName) {
    const msg = document.createElement('div');
    msg.className = 'blend-result-flash';
    const icon = document.createElement('img');
    icon.src = 'assets/sprites/Smoothie/Smoothie.png';
    icon.className = 'blend-result-icon';
    msg.appendChild(icon);
    msg.appendChild(document.createTextNode(` ${monName} SMOOTHIE OBTAINED!`));
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2700);
  }

  // ── Internal: renderSmoothieCount — updates the smoothie tally box
  function renderSmoothieCount() {
    const countEl = document.getElementById('smoothie-count');
    const box     = document.getElementById('smoothie-box');
    if (!countEl) return;
    const items = JSON.parse(localStorage.getItem('pm_items') || '[]');
    const count = items.filter(i => i.type === 'smoothie').length;
    countEl.textContent = count;
    if (box) box.setAttribute('draggable', count > 0 ? 'true' : 'false');
  }

  // ── Internal: applySmootie — consumes 1 smoothie, grants +1 pal level to a specific record
  async function applySmootie(mon, rec) {
    const items = JSON.parse(localStorage.getItem('pm_items') || '[]');
    const idx   = items.findIndex(i => i.type === 'smoothie');
    if (idx === -1) return;

    const PAL_MAX  = 100;
    const oldLevel = rec.palLevel || 1;
    if (oldLevel >= PAL_MAX) return;

    const newLevel = oldLevel + 1;

    // Update the IDB record directly
    if (db && rec._key !== undefined) {
      await updateRecord(rec._key, { palLevel: newLevel }).catch(() => {});
    }

    // Sync cache if this record is the active companion
    const activeKeyStr = localStorage.getItem('pm_active_rec_key');
    if (activeKeyStr && parseInt(activeKeyStr, 10) === rec._key) {
      localStorage.setItem('pm_active_pal_level', newLevel);
    }

    items.splice(idx, 1);
    localStorage.setItem('pm_items', JSON.stringify(items));

    renderSmoothieCount();
    SFX.play('levelUp');

    if (typeof updateCompanionDisplay === 'function') updateCompanionDisplay();

    const fromMon = typeof getMonStage === 'function' ? getMonStage(mon, oldLevel) : mon;
    const toMon   = typeof getMonStage === 'function' ? getMonStage(mon, newLevel) : mon;
    const evolved = fromMon.name !== toMon.name;

    if (evolved && typeof EvolutionScreen !== 'undefined') {
      EvolutionScreen.start({ evolved, fromMon, toMon, newLevel }, () => renderMyMons());
    } else {
      renderMyMons();
    }
  }

  // ── Internal: setupBlender — shows/hides zone, wires drop events once
  function setupBlender() {
    const zone = document.getElementById('blender-zone');
    const drop = document.getElementById('blender-drop');
    if (!zone || !drop) return;

    zone.classList.add('active');

    // Pin the top of the zone to just below the app header; bottom is fixed in CSS
    const appHeader = document.querySelector('.app-header');
    if (appHeader) {
      zone.style.top = (appHeader.getBoundingClientRect().bottom + 8) + 'px';
    }

    renderSmoothieCount();

    if (blenderReady) return;
    blenderReady = true;

    // Blender drop zone — accepts dragged mon cards
    drop.addEventListener('dragover', e => {
      e.preventDefault();
      drop.classList.add('drag-over');
    });

    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));

    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag-over');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data && data.key !== undefined) showBlendConfirm(data);
      } catch { /* ignore malformed data */ }
    });

    // Smoothie box — drag source for feeding mons
    const smoothieBox = document.getElementById('smoothie-box');
    if (smoothieBox) {
      smoothieBox.addEventListener('dragstart', e => {
        isDraggingSmoothie = true;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'smoothie' }));
        // Custom drag image: just the icon, no count, so players don't think
        // they're giving away all their smoothies at once.
        const ghost = document.createElement('img');
        ghost.src = 'assets/sprites/Smoothie/Smoothie.png';
        ghost.style.cssText = 'position:fixed;top:-200px;width:40px;height:40px;image-rendering:pixelated;';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 20, 20);
        setTimeout(() => ghost.remove(), 0);
      });
      smoothieBox.addEventListener('dragend', () => {
        isDraggingSmoothie = false;
      });
    }
  }

  // ── Internal: setActiveCompanion ────────────────────────────
  async function setActiveCompanion(mon, rec = null) {
    SFX.play('select');

    // Persist the current active companion's level+exp back to its IDB record before switching
    const oldKeyStr = localStorage.getItem('pm_active_rec_key');
    if (oldKeyStr && db) {
      const oldKey   = parseInt(oldKeyStr, 10);
      const oldLevel = parseInt(localStorage.getItem('pm_active_pal_level') || '1', 10);
      const oldExp   = parseInt(localStorage.getItem('pm_active_pal_exp')   || '0', 10);
      if (oldKey) updateRecord(oldKey, { palLevel: oldLevel, palExp: oldExp }).catch(() => {});
    }

    localStorage.setItem('pm_active', mon.id);

    if (rec) {
      localStorage.setItem('pm_active_rec_key',   rec._key);
      localStorage.setItem('pm_active_pal_level', rec.palLevel || 1);
      localStorage.setItem('pm_active_pal_exp',   rec.palExp   || 0);
      localStorage.setItem('pm_active_shiny',     rec.shiny ? '1' : '0');
      localStorage.setItem('pm_active_dark',      rec.dark  ? '1' : '0');
    }

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
      palLevel   = catchData.maxPalLevel || 1;
      displayMon = typeof getMonStage === 'function' ? getMonStage(mon, palLevel) : mon;
    }

    // Canvas thumbnail
    const canvas  = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 64;
    MonSprite.draw(canvas, displayMon, { fit: 0.85, shiny: catchData?.hasShiny || false });
    card.appendChild(canvas);

    // Dex number
    const dexEl = document.createElement('p');
    dexEl.className   = 'mon-card-dexnum';
    dexEl.textContent = catchData && displayMon.dexNum
      ? `#${String(displayMon.dexNum).padStart(3, '0')}`
      : '#???';
    card.appendChild(dexEl);

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

      if (typeof makeTypeBadges === 'function' && displayMon.type) {
        card.appendChild(makeTypeBadges(displayMon.type));
      }
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

  // ── Internal: buildDexCard — dex tile (owned = full sprite, unowned = silhouette) ──
  function buildDexCard(mon, owned) {
    const card = document.createElement('div');
    card.className = 'mon-card';
    if (!owned) card.classList.add('unseen');

    const canvas  = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 64;
    MonSprite.draw(canvas, mon, { fit: 0.85, shiny: false });
    if (!owned) canvas.style.filter = 'brightness(0) opacity(.18)';
    card.appendChild(canvas);

    const dexEl = document.createElement('p');
    dexEl.className   = 'mon-card-dexnum';
    dexEl.textContent = mon.dexNum ? `#${String(mon.dexNum).padStart(3, '0')}` : '#???';
    card.appendChild(dexEl);

    const nameEl = document.createElement('p');
    nameEl.className   = 'mon-card-name';
    nameEl.textContent = owned ? mon.name : '???';
    card.appendChild(nameEl);

    if (owned && typeof makeTypeBadges === 'function' && mon.type) {
      card.appendChild(makeTypeBadges(mon.type));
    }

    return card;
  }

  // ── Public: renderDex — one tile per dex entry (base + evolutions), sorted by dexNum ─────
  async function renderDex() {
    // Build flat list of every dex entry
    const allDexEntries = [];
    if (typeof MONS !== 'undefined') {
      for (const mon of MONS) {
        allDexEntries.push(mon);
        if (mon.evolutions) {
          for (const evo of mon.evolutions) {
            allDexEntries.push({ ...mon, ...evo, id: mon.id, rarity: mon.rarity });
          }
        }
      }
    }
    allDexEntries.sort((a, b) => (a.dexNum || 999) - (b.dexNum || 999));

    const TOTAL_DEX = allDexEntries.length;
    const grid  = document.getElementById('dex-grid');
    const count = document.getElementById('dex-count');

    if (!db) {
      if (count) count.textContent = `0 / ${TOTAL_DEX}`;
      if (grid)  grid.innerHTML    = '<p class="empty-state">Collection unavailable (storage not supported).</p>';
      return;
    }

    let ownedNames;
    try {
      ownedNames = await getCaughtNames();
    } catch (err) {
      if (grid) grid.innerHTML = '<p class="empty-state">Could not load collection.</p>';
      return;
    }

    if (count) count.textContent = `${ownedNames.size} / ${TOTAL_DEX}`;

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const entry of allDexEntries) {
      fragment.appendChild(buildDexCard(entry, ownedNames.has(entry.name)));
    }
    grid.appendChild(fragment);

    if (typeof MonSprite !== 'undefined') {
      MonSprite.preloadAll(allDexEntries, renderDex);
    }
  }

  // ── Internal: buildIndividualCard — one record per catch ─────
  function buildIndividualCard(mon, rec, activeRecKey) {
    const palLevel  = rec.palLevel || 1;
    const stageMon  = typeof getMonStage === 'function' ? getMonStage(mon, palLevel) : mon;
    const isActive  = rec._key === activeRecKey;

    const card = document.createElement('div');
    card.className = 'mon-card';
    if (rec.shiny) card.classList.add('shiny');
    if (rec.dark)  card.classList.add('dark');
    if (isActive)  card.classList.add('active-companion');

    if (isActive) {
      const star = document.createElement('span');
      star.className   = 'mon-card-active-indicator';
      star.textContent = '\u2605';
      card.appendChild(star);
    }

    const canvas  = document.createElement('canvas');
    canvas.width  = 64;
    canvas.height = 64;
    MonSprite.draw(canvas, stageMon, { fit: 0.85, shiny: rec.shiny || false, dark: rec.dark || false });
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

    // Type badges — listed just like on the pomodex page
    if (typeof makeTypeBadges === 'function' && stageMon.type) {
      card.appendChild(makeTypeBadges(stageMon.type));
    }

    // Drag source — for blending
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        key: rec._key,
        monId: mon.id,
        displayName: stageMon.name,
        rarity: mon.rarity,
      }));
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    // Drop target — for smoothie feeding
    card.addEventListener('dragover', e => {
      if (!isDraggingSmoothie) return;
      e.preventDefault();
      card.classList.add('smoothie-hover');
    });
    card.addEventListener('dragleave', () => card.classList.remove('smoothie-hover'));
    card.addEventListener('drop', e => {
      card.classList.remove('smoothie-hover');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data?.type === 'smoothie') {
          e.preventDefault();
          applySmootie(mon, rec);
        }
      } catch { /* ignore */ }
    });

    card.addEventListener('click', () => setActiveCompanion(mon, rec));
    return card;
  }

  // ── Public: renderMyMons — every individual caught record ─────
  async function renderMyMons() {
    const grid  = document.getElementById('mymons-grid');
    const count = document.getElementById('mymons-count');

    setupBlender();

    if (!db) {
      if (count) count.textContent = '0';
      if (grid)  grid.innerHTML    = '<p class="empty-state">Collection unavailable.</p>';
      return;
    }

    let allCaught;
    try {
      allCaught = await getAllCaughtWithKeys();
    } catch (err) {
      if (grid) grid.innerHTML = '<p class="empty-state">Could not load mons.</p>';
      return;
    }

    if (count) count.textContent = allCaught.length;

    if (allCaught.length === 0) {
      grid.innerHTML = '<p class="empty-state">Catch your first Pomomon to see it here!</p>';
      return;
    }

    const activeRecKey = parseInt(localStorage.getItem('pm_active_rec_key') || '0', 10) || null;
    const sorted       = [...allCaught].sort((a, b) => (b.caughtAt || 0) - (a.caughtAt || 0));

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const rec of sorted) {
      const mon = MONS.find(m => m.id === rec.id);
      if (!mon) continue;
      fragment.appendChild(buildIndividualCard(mon, rec, activeRecKey));
    }
    grid.appendChild(fragment);

    // Re-render once any still-loading sprites finish — fixes blank thumbnails on first load
    if (typeof MonSprite !== 'undefined') {
      MonSprite.preloadAll(MONS, renderMyMons);
    }
  }

  // ── Public: clearAll — wipe every caught record from the store ─
  function clearAll() {
    return new Promise((resolve, reject) => {
      if (!db) { resolve(); return; }
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── Public: getCaughtNames ───────────────────────────────────
  // Returns a Set of mon names the player has obtained, including
  // evolution stages they have already reached.
  async function getCaughtNames() {
    if (!db) return new Set();
    const records = await getAllCaught();
    const names = new Set();
    if (typeof MONS === 'undefined') return names;
    for (const rec of records) {
      const base = MONS.find(m => m.id === rec.id);
      if (!base) continue;
      names.add(base.name);
      if (base.evolutions) {
        for (const evo of base.evolutions) {
          if ((rec.palLevel || 1) >= evo.atLevel) names.add(evo.name);
        }
      }
    }
    return names;
  }

  return { init, addCaught, clearAll, renderDex, renderMyMons, updateActivePalLevel, getCaughtNames };
})();
