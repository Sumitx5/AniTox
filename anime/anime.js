const ANILIST_API = 'https://graphql.anilist.co';
const EPS_PER_BATCH = 50;

let animeId = null;
let totalEpisodes = 12;

function getAnimeId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || '21';
}

const ANIME_QUERY = `
query ($id: Int) {
  Media (id: $id, type: ANIME) {
    id
    title {
      romaji
      english
      native
    }
    bannerImage
    coverImage {
      extraLarge
      large
    }
    description(asHtml: false)
    episodes
    nextAiringEpisode {
      episode
    }
    status
    format
    season
    seasonYear
    averageScore
    genres
    duration
  }
}
`;

async function fetchAnimeFromAniList(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
        console.error("Invalid AniList ID:", id);
        return null;
    }

    try {
        const res = await fetch(ANILIST_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: ANIME_QUERY,
                variables: { id: numericId }
            })
        });

        if (!res.ok) throw new Error(`AniList HTTP error: ${res.status}`);
        const result = await res.json();
        return result.data?.Media || null;
    } catch (err) {
        console.error("Failed to fetch anime data from AniList:", err);
        return null;
    }
}

function populateAnimeUI(media) {
    const title = media.title.english || media.title.romaji || "Unknown Anime";
    document.title = `AniTox: ${title}`;

    const titleEl = document.querySelector('.anime-title');
    if (titleEl) {
        const words = title.split(' ');
        if (words.length > 1) {
            const lastWord = words.pop();
            titleEl.innerHTML = `${words.join(' ')} <span class="red-text">${lastWord}</span>`;
        } else {
            titleEl.innerHTML = `<span class="red-text">${title}</span>`;
        }
    }

    const backdropImg = document.querySelector('.backdrop-img');
    if (backdropImg) {
        backdropImg.src = media.bannerImage || media.coverImage.extraLarge;
        backdropImg.alt = `${title} Backdrop`;
    }

    const posterImg = document.querySelector('.poster-img');
    if (posterImg) {
        posterImg.src = media.coverImage.extraLarge || media.coverImage.large;
        posterImg.alt = `${title} Poster`;
    }

    const ratingEl = document.querySelector('.rating-badge');
    if (ratingEl) {
        const score = media.averageScore ? (media.averageScore / 10).toFixed(1) : 'N/A';
        ratingEl.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            ${score}
        `;
    }

    const badgeRow = document.querySelector('.badge-row');
    if (badgeRow) {
        const scoreHtml = ratingEl ? ratingEl.outerHTML : '';
        const format = media.format || 'TV';
        const season = media.season && media.seasonYear ? `${capitalize(media.season)} ${media.seasonYear}` : (media.seasonYear || '');
        const status = media.status === 'RELEASING' ? 'Ongoing' : 'Completed';

        badgeRow.innerHTML = `
            ${scoreHtml}
            <span class="meta-pill">${format}</span>
            ${season ? `<span class="meta-pill">${season}</span>` : ''}
            <span class="meta-pill">${status}</span>
            <span class="meta-pill">Sub | Dub</span>
        `;
    }

    const genresEl = document.querySelector('.genres-row');
    if (genresEl && Array.isArray(media.genres) && media.genres.length > 0) {
        genresEl.innerHTML = media.genres.map(g => `<span>${g}</span>`).join(' • ');
    }

    const descEl = document.querySelector('.anime-description');
    if (descEl) {
        const cleanDesc = media.description 
            ? media.description.replace(/<[^>]*>?/gm, '') 
            : 'No synopsis available for this anime.';
        descEl.textContent = cleanDesc;
    }

    if (media.status === 'NOT_YET_RELEASED') {
        totalEpisodes = 0;
    } else if (media.nextAiringEpisode && media.nextAiringEpisode.episode > 1) {
        totalEpisodes = media.nextAiringEpisode.episode - 1;
    } else if (media.nextAiringEpisode && media.nextAiringEpisode.episode === 1) {
        totalEpisodes = 0;
    } else if (media.episodes) {
        totalEpisodes = media.episodes;
    } else {
        totalEpisodes = 1;
    }

    const playBtn = document.getElementById('btn-watch-now');
    if (playBtn) {
        if (totalEpisodes > 0) {
            playBtn.href = `../watch/?id=${media.id}&ep=1`;
            playBtn.style.pointerEvents = 'auto';
            playBtn.style.opacity = '1';
        } else {
            playBtn.removeAttribute('href');
            playBtn.style.pointerEvents = 'none';
            playBtn.style.opacity = '0.5';
            playBtn.querySelector('span').textContent = 'Not Yet Aired';
        }
    }

    if (totalEpisodes > 0) {
        setupRangeDropdown(totalEpisodes);
        renderEpisodeBatch(0, totalEpisodes, media.duration || 24);
    } else {
        const select = document.getElementById('range-select');
        const list = document.getElementById('episode-list');
        if (select) select.innerHTML = '<option>No Episodes</option>';
        if (list) list.innerHTML = '<p style="color: var(--text-dim); padding: 20px 10px;">No episodes have aired yet.</p>';
    }
}

function setupRangeDropdown(total) {
    const select = document.getElementById('range-select');
    if (!select) return;

    select.innerHTML = '';
    const totalBatches = Math.ceil(total / EPS_PER_BATCH);

    for (let i = 0; i < totalBatches; i++) {
        const start = i * EPS_PER_BATCH + 1;
        const end = Math.min((i + 1) * EPS_PER_BATCH, total);
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `EPS ${formatNum(start)} - ${formatNum(end)}`;
        select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
        const batchIndex = parseInt(e.target.value, 10);
        renderEpisodeBatch(batchIndex, total);
    });
}

function renderEpisodeBatch(batchIndex, total, duration = 24) {
    const list = document.getElementById('episode-list');
    if (!list) return;

    if (total === 0) {
        list.innerHTML = '<p style="color: var(--text-dim); padding: 20px 10px;">No episodes available yet.</p>';
        return;
    }

    const start = batchIndex * EPS_PER_BATCH + 1;
    const end = Math.min((batchIndex + 1) * EPS_PER_BATCH, total);

    let html = '';
    for (let ep = start; ep <= end; ep++) {
        html += `
            <a href="../watch/?id=${animeId}&ep=${ep}" class="episode-card ${ep === 1 ? 'active' : ''}">
                <span class="ep-num">EP ${formatNum(ep)}</span>
                <span class="ep-title">Episode ${ep}</span>
                <span class="ep-duration">${duration}m</span>
            </a>
        `;
    }
    list.innerHTML = html;
}

function formatNum(num) {
    return num < 10 ? `0${num}` : num;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

document.addEventListener('DOMContentLoaded', async () => {
    animeId = getAnimeId();
    const media = await fetchAnimeFromAniList(animeId);

    if (media) {
        populateAnimeUI(media);
    } else {
        const titleEl = document.querySelector('.anime-title');
        if (titleEl) titleEl.textContent = 'Anime Not Found';
    }
});