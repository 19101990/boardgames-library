const DATABASE_NAME = 'boardgames-library-offline';
const GAME_STORES = ['games', 'game-details'];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open offline storage.'));
  });
}

function readSavedGame(gameId) {
  return openDatabase().then((database) => {
    if (!GAME_STORES.every((storeName) => database.objectStoreNames.contains(storeName))) {
      database.close();
      return { game: null, details: null };
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(GAME_STORES, 'readonly');
      const gameRequest = transaction.objectStore('games').get(gameId);
      const detailsRequest = transaction.objectStore('game-details').get(gameId);
      let game;
      let details;

      gameRequest.onsuccess = () => {
        game = gameRequest.result || null;
      };
      detailsRequest.onsuccess = () => {
        details = detailsRequest.result || null;
      };
      transaction.oncomplete = () => {
        database.close();
        resolve({ game, details });
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Could not read saved game.'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error('Could not read saved game.'));
      };
    });
  });
}

function setText(id, value) {
  document.getElementById(id).textContent = value == null ? '' : String(value);
}

function setList(id, items, getText) {
  const list = document.getElementById(id);
  list.replaceChildren();

  for (const item of items) {
    const element = document.createElement('li');
    element.textContent = getText(item);
    list.append(element);
  }
}

function formatPlaytime(game) {
  if (!game.min_playtime) return 'Play time not listed';
  if (game.max_playtime && game.max_playtime !== game.min_playtime) {
    return `${game.min_playtime}–${game.max_playtime} minutes`;
  }
  return `${game.min_playtime} minutes`;
}

function renderGame(game, details) {
  const image = document.getElementById('image');
  const imageUrl = game.image_url || game.thumbnail_url || game.image || game.thumbnail;
  image.alt = game.title;
  image.hidden = !imageUrl;
  if (imageUrl) {
    image.src = imageUrl;
    image.onerror = () => {
      image.hidden = true;
    };
  }

  setText('initial', game.title ? game.title.charAt(0).toUpperCase() : '?');
  setText('title', game.title || 'Saved game');
  setText(
    'metadata',
    `${game.year_published || 'Year unknown'} · ${game.min_players || '?'}–${game.max_players || '?'} players · ${formatPlaytime(game)}`
  );
  setText('description', game.description || 'No description saved.');
  document.getElementById('description-section').hidden = !game.description;

  const rating = game.rating ?? game.bgg_rating;
  const weight = game.weight ?? game.complexity_weight;
  const badges = document.getElementById('badges');
  badges.replaceChildren();
  for (const label of [
    game.status === 'owned' ? `In collection · ${game.language || 'EN'}` : 'Wanted',
    rating == null ? null : `BGG rating · ${Number(rating).toFixed(1)}`,
  ]) {
    if (!label) continue;
    const badge = document.createElement('span');
    badge.className = 'status';
    badge.textContent = label;
    badges.append(badge);
  }

  setList(
    'stats',
    [
      `Players: ${game.min_players || '?'}–${game.max_players || '?'}`,
      `Play time: ${formatPlaytime(game)}`,
      `Published: ${game.year_published || 'Not listed'}`,
      weight == null ? null : `Complexity: ${Number(weight).toFixed(1)} / 5`,
    ].filter(Boolean),
    (item) => item
  );

  const mechanics = Array.isArray(game.mechanics) ? game.mechanics : [];
  const categories = Array.isArray(game.categories) ? game.categories : [];
  setText('mechanics', mechanics.join(' · ') || 'No mechanics saved.');
  setText('categories', categories.join(' · ') || 'No categories saved.');
  document.getElementById('mechanics-section').hidden = mechanics.length === 0;
  document.getElementById('categories-section').hidden = categories.length === 0;

  const hasCachedDetails = Boolean(details && details.has_cached_details);
  setText(
    'expansions-status',
    hasCachedDetails ? '' : 'Expansion information was not saved for offline viewing.'
  );
  setText('plays-status', hasCachedDetails ? '' : 'Play history was not saved for offline viewing.');
  setList(
    'expansions',
    details && Array.isArray(details.expansions) ? details.expansions : [],
    (expansion) => `${expansion.title} · ${expansion.is_owned ? 'Owned' : 'Wanted'}`
  );
  setList(
    'plays',
    details && Array.isArray(details.plays) ? details.plays : [],
    (play) => `${play.play_date} · ${play.player_count} players${play.notes ? ` · ${play.notes}` : ''}`
  );

  document.getElementById('loading').hidden = true;
  document.getElementById('game').hidden = false;
  document.title = `${game.title || 'Saved game'} — Board Game Shelf`;
}

async function loadGame() {
  const gameId = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '');

  try {
    const saved = await readSavedGame(gameId);
    if (saved.game) {
      renderGame(saved.game, saved.details);
      return;
    }
    setText('loading', 'This game is not saved on this device. Open it online to make it available offline.');
  } catch (error) {
    console.error('Could not load the saved game:', error);
    setText('loading', 'Saved game information could not be read on this device.');
  }
}

loadGame();
