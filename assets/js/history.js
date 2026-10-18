const HISTORY_STORAGE_KEY = 'anitox_watch_history';
const MAX_HISTORY_ITEMS = 50;

function getWatchHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read watch history from localStorage:', err);
    return [];
  }
}

function saveWatchHistory({ ani_id, title_eng, season = 1, episode, anime_thumbnail }) {
  if (!ani_id || !episode) return;

  const numericId = Number(ani_id);
  const numericEp = Number(episode);

  let history = getWatchHistory();

  const existingIndex = history.findIndex(item => Number(item.ani_id) === numericId);

  const prevItem = existingIndex > -1 ? history[existingIndex] : {};

  const entry = {
    ani_id: numericId,
    title_eng: title_eng || prevItem.title_eng || 'Unknown Title',
    season: season || prevItem.season || 1,
    episode: numericEp,
    anime_thumbnail: anime_thumbnail || prevItem.anime_thumbnail || '',
    updated_at: Date.now()
  };

  if (existingIndex > -1) {
    history.splice(existingIndex, 1);
  }

  history.unshift(entry);

  if (history.length > MAX_HISTORY_ITEMS) {
    history = history.slice(0, MAX_HISTORY_ITEMS);
  }

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save watch history to localStorage:', err);
  }
}

function removeWatchHistoryItem(ani_id) {
  let history = getWatchHistory();
  history = history.filter(item => Number(item.ani_id) !== Number(ani_id));
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}