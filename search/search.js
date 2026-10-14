const ANILIST_API = 'https://graphql.anilist.co';

let currentQuery = '';
let currentFilter = 'all';
let debounceTimer = null;

const SEARCH_QUERY = `
query ($search: String, $format: MediaFormat, $genre: String, $sort: [MediaSort]) {
  Page (page: 1, perPage: 24) {
    media (search: $search, format: $format, genre: $genre, sort: $sort, type: ANIME) {
      id
      title {
        english
        romaji
      }
      coverImage {
        large
      }
      format
      averageScore
    }
  }
}
`;

async function fetchAnimeList(search = '', filter = 'all') {
    const grid = document.getElementById('search-results-grid');
    grid.innerHTML = '<div class="grid-msg">Loading anime...</div>';

    const variables = {};
    if (search.trim()) {
        variables.search = search.trim();
        variables.sort = ['SEARCH_MATCH', 'POPULARITY_DESC'];
    } else {
        variables.sort = ['TRENDING_DESC', 'POPULARITY_DESC'];
    }

    if (['TV', 'MOVIE', 'OVA'].includes(filter)) {
        variables.format = filter;
    } else if (filter !== 'all') {
        variables.genre = filter;
    }

    try {
        const res = await fetch(ANILIST_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: SEARCH_QUERY,
                variables
            })
        });

        if (!res.ok) throw new Error(`AniList HTTP error: ${res.status}`);
        const json = await res.json();
        const results = json.data?.Page?.media || [];

        renderResults(results);
    } catch (err) {
        console.error('AniList Search error:', err);
        grid.innerHTML = '<div class="grid-msg">Failed to load anime. Please try again.</div>';
    }
}

function renderResults(animeList) {
    const grid = document.getElementById('search-results-grid');
    const countLabel = document.getElementById('results-count');

    if (!animeList || animeList.length === 0) {
        grid.innerHTML = '<div class="grid-msg">No anime found matching your criteria.</div>';
        if (countLabel) countLabel.textContent = '0 results';
        return;
    }

    if (countLabel) {
        countLabel.textContent = `${animeList.length} results`;
    }

    grid.innerHTML = animeList.map(item => {
        const title = item.title.english || item.title.romaji || 'Unknown Title';
        const cover = item.coverImage?.large || 'https://placehold.co/165x240/111/fff?text=No+Cover';
        const rating = item.averageScore ? (item.averageScore / 10).toFixed(1) : 'N/A';
        const format = item.format || 'TV';

        return `
            <a href="../anime/?id=${item.id}" class="search-card" data-id="${item.id}">
                <img 
                    src="${cover}" 
                    alt="${title}" 
                    loading="lazy" 
                    onerror="this.src='https://placehold.co/165x240/111/fff?text=No+Cover'"
                />
                <h3 title="${title}">${title}</h3>
                <div class="card-meta">
                    <span class="card-rating">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        ${rating}
                    </span>
                    <span class="card-type">${format}</span>
                </div>
            </a>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    const titleEl = document.getElementById('results-title');

    fetchAnimeList();

    input.addEventListener('input', (e) => {
        currentQuery = e.target.value;
        clearBtn.hidden = !currentQuery;

        if (titleEl) {
            titleEl.textContent = currentQuery ? `Results for "${currentQuery}"` : 'Trending Anime';
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchAnimeList(currentQuery, currentFilter);
        }, 350);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        currentQuery = '';
        clearBtn.hidden = true;
        if (titleEl) titleEl.textContent = 'Trending Anime';
        fetchAnimeList('', currentFilter);
        input.focus();
    });

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            currentFilter = chip.dataset.filter;
            fetchAnimeList(currentQuery, currentFilter);
        });
    });
});