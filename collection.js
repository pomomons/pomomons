// collection.js — IndexedDB-backed Pokédex and collection screen

const Collection = (() => {
  const DB_NAME    = 'pomomons_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'caught';

  let db                 = null;
  let blenderReady       = false;   // event listeners attached once
  let pendingBlend       = null;    // { key, monId, displayName, rarity }
  let isDraggingSmoothie = false;   // flag readable by card dragover handlers

  // Mon-detail card state (individual caught mon)
  let detailReady = false;          // detail overlay listeners attached once
  let detailMon   = null;           // base mon of the record being viewed
  let detailRec   = null;           // the IDB record ({ _key, ... }) being viewed
  // Optional one-shot handler for this card's BACK button, set per open().
  // Post-catch, BACK belongs to the encounter flow rather than the timer.
  let detailOnClose = null;

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

  // Catches feed the stats strip, which tracks a lifetime total and a
  // per-day bucket side by side. app.js owns that pairing (addStat); this
  // falls back to the lifetime total alone if it somehow isn't loaded, the
  // same defensive shape the renderStats calls below use.
  function bumpCatchCount() {
    if (typeof addStat === 'function') { addStat('catches', 1); return; }
    const prev = parseInt(localStorage.getItem('pm_total_catches') || '0', 10);
    localStorage.setItem('pm_total_catches', prev + 1);
    if (typeof Signup !== 'undefined') Signup.event('mon-caught');
  }

  // ── Public: addCaught ────────────────────────────────────────
  async function addCaught(record) {
    // Stamp per-individual traits once, at catch time (stable forever after).
    if (record.gender == null   && typeof randomGender === 'function') record.gender = randomGender();
    if (record.nature == null   && typeof randomNature === 'function') record.nature = randomNature();
    if (record.heldItem === undefined) record.heldItem = null;   // no items yet
    if (record.nickname === undefined) record.nickname = null;

    // If the player has no active companion yet, this catch becomes it.
    const isFirstCatch = !localStorage.getItem('pm_active');

    // A dark or shiny is a rare pull — flag the backup prompt to offer itself
    // at the next calm moment, regardless of how many catches/sessions in.
    if ((record.shiny || record.dark) &&
        typeof Signup !== 'undefined' && Signup.noteRareCatch) {
      Signup.noteRareCatch();
    }

    if (!db) {
      const list = JSON.parse(localStorage.getItem('pm_caught') || '[]');
      list.push(record);
      localStorage.setItem('pm_caught', JSON.stringify(list));
      bumpCatchCount();
      if (isFirstCatch) {
        const mon = MONS.find(m => m.id === record.id);
        if (mon) await setActiveCompanion(mon, { _key: list.length - 1, ...record });
      }
      if (typeof renderStats === 'function') renderStats();
      return list.length - 1;
    }

    const newKey = await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.add(record);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror    = () => reject(tx.error);
    });

    bumpCatchCount();

    // First catch → auto-equip it as the companion on the main screen.
    if (isFirstCatch) {
      const mon = MONS.find(m => m.id === record.id);
      if (mon) await setActiveCompanion(mon, { _key: newKey, ...record });
    }

    if (typeof renderStats === 'function') renderStats();

    // Refresh grid immediately if a collection screen is visible
    if (document.getElementById('screen-mymons')?.classList.contains('active')) renderMyMons();
    if (document.getElementById('screen-dex')?.classList.contains('active'))    renderDex();

    // Returned so callers (e.g. the catch screen's INFO button) can open the
    // detail card for this exact record.
    return newKey;
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

    // Same reasoning as savePalExp in app.js: getMonStage returns the species
    // stage, which carries no shiny/dark flag. Take those from the record
    // being levelled so the evolution animation draws this mon, not a plain
    // one of its kind.
    const variant = { shiny: !!rec.shiny, dark: !!rec.dark };
    const stageAt = (lv) => ({
      ...(typeof getMonStage === 'function' ? getMonStage(mon, lv) : mon),
      ...variant,
    });
    const fromMon = stageAt(oldLevel);
    const toMon   = stageAt(newLevel);
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

  // Find the record a My Mons card stands for. Those cards are per-SPECIES —
  // one tile however many of that mon you own — so they have no single record
  // to hand over. Pick the one the tile is actually drawing: its rare variant
  // if you own one (the tile draws the shiny sprite whenever hasShiny is set),
  // then the highest pal level within that group.
  async function bestRecordFor(monId) {
    let all;
    if (db) {
      all = await getAllCaughtWithKeys();
    } else {
      all = JSON.parse(localStorage.getItem('pm_caught') || '[]')
        .map((r, i) => ({ _key: i, ...r }));
    }
    const mine = all.filter(r => r.id === monId);
    if (!mine.length) return null;
    const rare = r => (r.shiny || r.dark ? 1 : 0);
    mine.sort((a, b) => (rare(b) - rare(a)) || ((b.palLevel || 1) - (a.palLevel || 1)));
    return mine[0];
  }

  // ── Internal: setActiveCompanion ────────────────────────────
  async function setActiveCompanion(mon, rec = null) {
    SFX.play('select');

    // A My Mons card click arrives with no record. Resolving one here is not
    // optional: the block below only writes pm_active_shiny / pm_active_dark /
    // the pal level when it HAS a record, so without this the new companion
    // silently inherited the previous one's flags. That is what left a shiny
    // pal drawn — and evolving — as a plain one.
    if (!rec) rec = await bestRecordFor(mon.id).catch(() => null);

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
    } else {
      // Lookup failed (no record, or the store threw). Clear the variant
      // rather than let the outgoing companion's flags stick to this one.
      localStorage.setItem('pm_active_shiny', '0');
      localStorage.setItem('pm_active_dark',  '0');
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

    // Pal level (caught mons only) — rarity tiers removed
    if (catchData) {
      const lvlEl = document.createElement('p');
      lvlEl.className   = 'mon-card-pallvl';
      lvlEl.textContent = `LV ${palLevel}`;
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

    // Caught entries open the species page (picture, type, rarity, evolution
    // path) — the same screen shown right after a catch. Not the individual
    // detail card: a dex entry is a species, so it has no nickname/gender/
    // caught date, and there may be several caught records behind one entry.
    // Uncaught tiles stay inert; .mon-card.unseen already shows no pointer.
    if (owned && typeof MonInfoScreen !== 'undefined') {
      card.addEventListener('click', () => MonInfoScreen.start(mon, () => {}));
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
    nameEl.textContent = rec.nickname || stageMon.name;
    card.appendChild(nameEl);

    // Only shiny/dark variants get a rarity label now (tiers removed)
    if (rec.dark || rec.shiny) {
      const rarityEl = document.createElement('p');
      rarityEl.className   = `mon-card-rarity ${rec.dark ? 'pitch-black' : 'ultra-rare'}`;
      rarityEl.textContent = rec.dark ? 'DARK' : 'SHINY';
      card.appendChild(rarityEl);
    }

    const lvlEl = document.createElement('p');
    lvlEl.className   = 'mon-card-pallvl';
    lvlEl.textContent = `LV ${palLevel}`;
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

    card.addEventListener('click', () => openMonDetail(mon, rec));
    return card;
  }

  // ── Internal: openMonDetail — the individual mon's detail card ─
  // opts.onClose: called when BACK is pressed, and awaited BEFORE this card
  // is taken down, so whatever replaces it is already up. Cleared on every
  // open, so a card opened from My Mons never inherits the catch flow's.
  async function openMonDetail(mon, rec, opts) {
    const overlay = document.getElementById('mon-detail-overlay');
    if (!overlay) return;

    detailOnClose = opts && typeof opts.onClose === 'function' ? opts.onClose : null;

    // Backfill traits for records caught before these fields existed, then
    // persist so a mon's gender/nature never changes between views.
    const patch = {};
    if (rec.gender == null && typeof randomGender === 'function') { rec.gender = randomGender(); patch.gender = rec.gender; }
    if (rec.nature == null && typeof randomNature === 'function') { rec.nature = randomNature(); patch.nature = rec.nature; }
    if (rec.heldItem === undefined) rec.heldItem = null;
    if (rec.nickname === undefined) rec.nickname = null;
    if (Object.keys(patch).length && db && rec._key !== undefined) {
      updateRecord(rec._key, patch).catch(() => {});
    }

    detailMon = mon;
    detailRec = rec;

    // Wire the overlay's buttons exactly once; they read detailMon/detailRec.
    if (!detailReady) {
      detailReady = true;
      const renameRow = document.getElementById('mon-detail-rename-row');
      const input     = document.getElementById('mon-detail-nickname-input');

      const closeRename = () => { renameRow.hidden = true; };
      const saveRename  = async () => {
        const val = input.value.trim();
        detailRec.nickname = val || null;
        if (db && detailRec._key !== undefined) {
          await updateRecord(detailRec._key, { nickname: detailRec.nickname }).catch(() => {});
        }
        closeRename();
        renderDetail();
        renderMyMons();
      };

      document.getElementById('btn-mon-detail-back').addEventListener('click', async () => {
        MonDetailCanvas.stop();
        // Read and clear first: a second click while the next card is still
        // opening must not run it twice.
        const after = detailOnClose;
        detailOnClose = null;
        try {
          if (after) await after();
        } finally {
          // finally, so a failed handoff can't strand the player on a card
          // whose BACK button now does nothing.
          overlay.classList.remove('active');
        }
      });
      document.getElementById('btn-mon-detail-rename').addEventListener('click', () => {
        input.value = detailRec.nickname || '';
        renameRow.hidden = false;
        input.focus();
        input.select();
      });
      document.getElementById('btn-mon-detail-save').addEventListener('click', saveRename);
      document.getElementById('btn-mon-detail-cancel').addEventListener('click', closeRename);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); saveRename(); }
        if (e.key === 'Escape') { e.preventDefault(); closeRename(); }
      });
      document.getElementById('btn-mon-detail-equip').addEventListener('click', async () => {
        await setActiveCompanion(detailMon, detailRec);
        updateEquipButton();
      });
    }

    document.getElementById('mon-detail-rename-row').hidden = true;
    renderDetail();
    overlay.classList.add('active');
  }

  // ── Public: openActiveMonDetail — open the equipped companion's own
  // detail card (e.g. from clicking its LV badge on the timer screen).
  // Looks the record up by pm_active_rec_key rather than trusting any
  // cached copy, since XP/level change constantly while it's active.
  async function openActiveMonDetail() {
    const keyStr = localStorage.getItem('pm_active_rec_key');
    const key    = keyStr ? parseInt(keyStr, 10) : null;
    if (!key || !db || typeof MONS === 'undefined') return;

    const all = await getAllCaughtWithKeys();
    const rec = all.find(r => r._key === key);
    if (!rec) return;

    const mon = MONS.find(m => m.id === rec.id);
    if (!mon) return;

    openMonDetail(mon, rec);
  }

  // ── Internal: renderDetail — fill the detail card from detailRec ─
  function renderDetail() {
    const rec      = detailRec;
    const mon      = detailMon;
    const palLevel = rec.palLevel || 1;
    const stageMon = typeof getMonStage === 'function' ? getMonStage(mon, palLevel) : mon;

    const dark  = !!rec.dark;
    const shiny = !!rec.shiny;

    // Header: dex # + variant label
    const dexEl = document.getElementById('mon-detail-dexnum');
    dexEl.textContent = stageMon.dexNum ? `#${String(stageMon.dexNum).padStart(3, '0')}` : '';
    const rarEl = document.getElementById('mon-detail-rarity');
    rarEl.textContent = dark ? 'DARK' : shiny ? 'SHINY' : '';
    rarEl.className   = `mon-detail-rarity ${dark ? 'pitch-black' : shiny ? 'ultra-rare' : ''}`;

    // Name: nickname takes the headline, species shown beneath when nicknamed
    const nameEl    = document.getElementById('mon-detail-name');
    const speciesEl = document.getElementById('mon-detail-species');
    if (rec.nickname) {
      nameEl.textContent    = rec.nickname;
      speciesEl.textContent = stageMon.name.toUpperCase();
      speciesEl.hidden      = false;
    } else {
      nameEl.textContent    = stageMon.name.toUpperCase();
      speciesEl.textContent = '';
      speciesEl.hidden      = true;
    }

    // Stat rows
    document.getElementById('mds-species').textContent = stageMon.name.toUpperCase();
    document.getElementById('mds-level').textContent   = `LV ${palLevel}`;

    // How close this mon is to its next level — same idea as the EXP bar
    // under a Pokémon's level on its summary screen: current/needed XP as
    // both a number and a fill bar. PAL_MAX mirrors app.js's savePalExp().
    const PAL_MAX  = 100;
    const xpTextEl = document.getElementById('mds-xp-text');
    const xpBarEl  = document.getElementById('mds-xp-bar');
    if (xpTextEl && xpBarEl) {
      // The active companion's record only gets its palExp persisted to IDB
      // on level-up (see updateActivePalLevel) — mid-level it's stale, so
      // read the live numbers from localStorage for that one mon instead.
      const activeKey = parseInt(localStorage.getItem('pm_active_rec_key') || '0', 10) || null;
      const isActive  = rec._key !== undefined && rec._key === activeKey;
      const exp = isActive
        ? parseInt(localStorage.getItem('pm_active_pal_exp') || '0', 10)
        : (rec.palExp || 0);

      if (palLevel >= PAL_MAX) {
        xpTextEl.textContent = 'MAX LEVEL';
        xpBarEl.style.width  = '100%';
      } else {
        const needed = typeof palExpThreshold === 'function' ? palExpThreshold(palLevel) : 1;
        xpTextEl.textContent = `${exp} / ${needed} XP`;
        xpBarEl.style.width  = Math.max(0, Math.min(100, (exp / needed) * 100)) + '%';
      }
    }

    // Type badges live in their own stat row
    const typeEl = document.getElementById('mds-type');
    if (typeEl && typeof makeTypeBadges === 'function') {
      typeEl.innerHTML = '';
      if (stageMon.type) typeEl.appendChild(makeTypeBadges(stageMon.type));
      else typeEl.textContent = '—';
    }

    const g = rec.gender === 'F'
      ? { sym: '♀', label: 'FEMALE', cls: 'female' }
      : { sym: '♂', label: 'MALE',   cls: 'male'   };
    const genEl = document.getElementById('mds-gender');
    genEl.className = `mds-v ${g.cls}`;
    genEl.innerHTML = '';
    const sym = document.createElement('span');
    sym.className   = 'gsym';
    sym.textContent = g.sym;
    genEl.appendChild(sym);
    genEl.appendChild(document.createTextNode(' ' + g.label));

    const natEl = document.getElementById('mds-nature');
    natEl.innerHTML = '';
    const natName = document.createElement('span');
    natName.textContent = (rec.nature || 'UNKNOWN').toUpperCase();
    natEl.appendChild(natName);
    const flavor = (typeof NATURE_FLAVOR !== 'undefined' && rec.nature) ? NATURE_FLAVOR[rec.nature] : '';
    if (flavor) {
      const sub = document.createElement('span');
      sub.className   = 'mds-sub';
      sub.textContent = flavor;
      natEl.appendChild(sub);
    }

    const itemEl = document.getElementById('mds-item');
    itemEl.textContent = rec.heldItem ? String(rec.heldItem).toUpperCase() : 'NONE';
    itemEl.classList.toggle('muted', !rec.heldItem);

    const caughtEl = document.getElementById('mds-caught');
    caughtEl.textContent = rec.caughtAt
      ? new Date(rec.caughtAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()
      : 'UNKNOWN';

    updateEquipButton();

    // Animated sprite (canvas drawing lives in game.js)
    if (typeof MonDetailCanvas !== 'undefined') {
      MonDetailCanvas.start(document.getElementById('mon-detail-canvas'),
        { ...stageMon, shiny, dark });
    }
  }

  // ── Internal: updateEquipButton — reflect active-companion state ─
  function updateEquipButton() {
    const btn = document.getElementById('btn-mon-detail-equip');
    if (!btn || !detailRec) return;
    const activeKey = parseInt(localStorage.getItem('pm_active_rec_key') || '0', 10) || null;
    const isActive  = detailRec._key === activeKey;
    btn.textContent = isActive ? 'EQUIPPED' : 'SET AS COMPANION';
    btn.disabled    = isActive;
    btn.classList.toggle('is-equipped', isActive);
  }

  // ── My Mons sort order ────────────────────────────────────────
  // Four orders over the same list of individual records. Every comparator
  // ends in the same tie-break chain so the grid is fully deterministic —
  // two mons that match on the chosen key never swap places between renders,
  // which they would under an unstable sort and would read as the grid
  // shuffling itself.
  //
  // _key is IndexedDB's autoIncrement, handed out in catch order, so it is
  // the last-resort age stand-in for records saved before caughtAt existed.
  const SORT_KEY = 'pm_mymons_sort';

  const caughtOrder = (r) => r.caughtAt || 0;

  // Shiny outranks dark outranks plain. Shiny wins outright at catch time
  // (see the roll in game.js), so a record flagged both is shiny.
  const rarityRank = (r) => (r.shiny ? 2 : r.dark ? 1 : 0);

  // The base species, not the evolved stage on the card. Sorting by species
  // should gather every Tomotot together whether or not it has evolved, and
  // stages carry their own dexNum which would scatter them.
  function speciesRank(r) {
    const mon = MONS.find((m) => m.id === r.id);
    return (mon && (mon.dexNum || mon.id)) || 9999;
  }

  const SORTS = {
    newest: {
      label: 'NEWEST',
      cmp: (a, b) => caughtOrder(b) - caughtOrder(a),
    },
    species: {
      label: 'SPECIES',
      cmp: (a, b) => speciesRank(a) - speciesRank(b)
                  || (b.palLevel || 1) - (a.palLevel || 1),
    },
    level: {
      label: 'LEVEL',
      cmp: (a, b) => (b.palLevel || 1) - (a.palLevel || 1)
                  || speciesRank(a) - speciesRank(b),
    },
    rarity: {
      label: 'RARITY',
      cmp: (a, b) => rarityRank(b) - rarityRank(a)
                  || (b.palLevel || 1) - (a.palLevel || 1)
                  || speciesRank(a) - speciesRank(b),
    },
  };

  let sortMode = SORTS[localStorage.getItem(SORT_KEY)] ? localStorage.getItem(SORT_KEY) : 'newest';

  function sortRecords(records) {
    const { cmp } = SORTS[sortMode] || SORTS.newest;
    return [...records].sort((a, b) =>
      cmp(a, b)
      || caughtOrder(b) - caughtOrder(a)
      || (b._key || 0) - (a._key || 0));
  }

  // Anchored under its button exactly like the timer's mode picker. Fixed
  // position, so it is measured at open time rather than laid out in the
  // header, where it would have widened the pinned top strip.
  function setupSortMenu() {
    const btn  = document.getElementById('btn-mymons-sort');
    const menu = document.getElementById('mymons-sort-menu');
    if (!btn || !menu || btn.dataset.wired) return;
    btn.dataset.wired = '1';

    const label = document.getElementById('mymons-sort-label');
    const paint = () => {
      if (label) label.textContent = (SORTS[sortMode] || SORTS.newest).label;
      menu.querySelectorAll('.mode-option').forEach((o) => {
        const on = o.dataset.sort === sortMode;
        o.classList.toggle('active', on);
        o.setAttribute('aria-checked', String(on));
      });
    };
    const close = () => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = menu.hidden;
      if (opening) {
        const r = btn.getBoundingClientRect();
        menu.style.top = `${r.bottom + 6}px`;
        // Right-aligned: the button sits at the header's right edge, so a
        // left-anchored menu wider than it would hang off the viewport.
        menu.style.left = 'auto';
        menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
        menu.style.width = '';
      }
      menu.hidden = !opening;
      btn.setAttribute('aria-expanded', String(opening));
    });

    menu.addEventListener('click', (e) => {
      const opt = e.target.closest('.mode-option');
      if (!opt) return;
      e.stopPropagation();
      sortMode = SORTS[opt.dataset.sort] ? opt.dataset.sort : 'newest';
      localStorage.setItem(SORT_KEY, sortMode);
      if (typeof SFX !== 'undefined') SFX.play('click');
      paint();
      close();
      renderMyMons();
    });

    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', close);
    paint();
  }

  // ── Public: renderMyMons — every individual caught record ─────
  async function renderMyMons() {
    const grid  = document.getElementById('mymons-grid');
    const count = document.getElementById('mymons-count');

    setupBlender();
    setupSortMenu();

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
    const sorted       = sortRecords(allCaught);

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

  // ── Public: exportRecords / importRecords — for backup.js ────
  // The store owns the DB handle, so reading and writing whole collections
  // lives here rather than backup.js reaching into IndexedDB behind its back.
  //
  // Records travel with their primary keys. pm_active_rec_key points at one of
  // them, so letting autoIncrement hand out fresh keys on restore would leave
  // the player's chosen companion pointing at nothing.
  function exportRecords() {
    if (!db) {
      try { return JSON.parse(localStorage.getItem('pm_caught') || '[]'); }
      catch (e) { return []; }
    }
    return getAllCaughtWithKeys();
  }

  async function importRecords(records) {
    if (!Array.isArray(records)) throw new Error('not a record list');

    if (!db) {
      localStorage.setItem('pm_caught', JSON.stringify(
        records.map(({ _key, ...rest }) => rest)
      ));
      return records.length;
    }

    await clearAll();
    await new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const rec of records) {
        const { _key, ...value } = rec;
        // An explicit key is allowed on an autoIncrement store, and the store's
        // counter moves past it, so later catches don't collide with restored ones.
        if (Number.isInteger(_key)) store.add(value, _key);
        else store.add(value);
      }
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
    return records.length;
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

  return { init, addCaught, clearAll, exportRecords, importRecords, renderDex, renderMyMons, updateActivePalLevel, getCaughtNames, openMonDetail, openActiveMonDetail };
})();
