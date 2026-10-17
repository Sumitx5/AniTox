const ANILIST_API = 'https://graphql.anilist.co';
const EPS_PER_PAGE = 50;

let animeId = null;
let currentEp = 1;
let currentAudio = 'sub';
let currentServer = null;
let currentHindiServer = null;
let streamingApis = {};
let totalEpisodes = 1;
let hindiData = null;

function parseQueryParams() {
    const params = new URLSearchParams(window.location.search);
    animeId = params.get('id') || '21';
    currentEp = parseInt(params.get('ep') || '1', 10);
    currentAudio = params.get('audio') || 'sub';
}

const ANIME_QUERY = `
query ($id: Int) {
  Media (id: $id, type: ANIME) {
    id
    title {
      romaji
      english
    }
    episodes
    nextAiringEpisode {
      episode
    }
    status
  }
}
`;

async function fetchAnimeFromAniList(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;

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

        if (!res.ok) throw new Error(`AniList error: ${res.status}`);
        const result = await res.json();
        return result.data?.Media || null;
    } catch (err) {
        console.error("Failed to fetch episode info from AniList:", err);
        return null;
    }
}

async function fetchHindiData() {
    try {
        const repoName = window.location.pathname.split('/')[1];
        const basePath = window.location.origin.includes('github.io') ? `/${repoName}/` : '../';

        const res = await fetch(`${basePath}assets/data/hindi_available.json`);
        if (!res.ok) return null;

        const data = await res.json();
        const list = data.anime_list || [];
        
        return list.find(item => String(item.ani_id) === String(animeId)) || null;
    } catch (err) {
        console.warn('Hindi data file not found or failed to load:', err);
        return null;
    }
}

function renderAudioButtons() {
    const audioContainer = document.querySelector('.audio-switch-tabs');
    if (!audioContainer) return;

    let html = `
        <span class="ctrl-label">Audio:</span>
        <button class="audio-btn ${currentAudio === 'sub' ? 'active' : ''}" data-audio="sub">SUB</button>
        <button class="audio-btn ${currentAudio === 'dub' ? 'active' : ''}" data-audio="dub">DUB</button>
    `;

    if (hindiData) {
        html += `<button class="audio-btn ${currentAudio === 'hindi' ? 'active' : ''}" data-audio="hindi">HINDI</button>`;
    } else if (currentAudio === 'hindi') {
        currentAudio = 'sub';
    }

    audioContainer.innerHTML = html;

    audioContainer.querySelectorAll('.audio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAudio = btn.dataset.audio;
            audioContainer.querySelectorAll('.audio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateServerTabs();
            updatePlayer();
        });
    });
}

async function fetchApis() {
    try {
        const repoName = window.location.pathname.split('/')[1];
        const basePath = window.location.origin.includes('github.io') ? `/${repoName}/` : '../';

        const res = await fetch(`${basePath}assets/api/apis.json`);
        if (!res.ok) throw new Error(`Could not load apis.json (${res.status})`);

        streamingApis = await res.json();
        
        const apiKeys = Object.keys(streamingApis);
        if (apiKeys.length > 0) {
            currentServer = apiKeys[0];
        }
    } catch (err) {
        console.error('Failed to load streaming APIs:', err);
        streamingApis = {
            "Server 1": "https://example.com/embed/{id}/{ep}/{sub}/"
        };
        currentServer = "Server 1";
    }
}

function getHindiServersForCurrentEp() {
    if (!hindiData || !hindiData.episodes) return {};
    const epObj = hindiData.episodes.find(e => Number(e.ep) === Number(currentEp));
    if (!epObj) return {};

    if (epObj.servers && typeof epObj.servers === 'object') {
        return epObj.servers;
    }
    if (epObj.ep_id) {
        return { "Server 1": epObj.ep_id };
    }
    return {};
}

function updateServerTabs() {
    const serverTabs = document.querySelector('.server-tabs');
    if (!serverTabs) return;

    let serverKeys = [];
    let activeKey = null;

    if (currentAudio === 'hindi') {
        const hindiServers = getHindiServersForCurrentEp();
        serverKeys = Object.keys(hindiServers);

        if (serverKeys.length === 0) {
            serverTabs.innerHTML = '<span class="ctrl-label" style="color:var(--text-dim);">No Hindi Server</span>';
            return;
        }

        if (!currentHindiServer || !hindiServers[currentHindiServer]) {
            currentHindiServer = serverKeys[0];
        }
        activeKey = currentHindiServer;
    } else {
        serverKeys = Object.keys(streamingApis);
        if (!currentServer && serverKeys.length > 0) {
            currentServer = serverKeys[0];
        }
        activeKey = currentServer;
    }

    let html = '<span class="ctrl-label">Server:</span>';
    serverKeys.forEach(key => {
        html += `
            <button class="server-btn ${key === activeKey ? 'active' : ''}" data-server="${key}">
                ${key}
            </button>
        `;
    });
    serverTabs.innerHTML = html;

    serverTabs.querySelectorAll('.server-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            serverTabs.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (currentAudio === 'hindi') {
                currentHindiServer = btn.dataset.server;
            } else {
                currentServer = btn.dataset.server;
            }
            updatePlayer();
        });
    });
}

function getEmbedUrl() {
    if (currentAudio === 'hindi') {
        const hindiServers = getHindiServersForCurrentEp();
        if (currentHindiServer && hindiServers[currentHindiServer]) {
            return hindiServers[currentHindiServer];
        }
        const first = Object.values(hindiServers)[0];
        return first || '';
    }

    const baseLink = streamingApis[currentServer];
    if (!baseLink) return '';

    return baseLink
        .replace('{id}', encodeURIComponent(animeId))
        .replace('{ep}', currentEp)
        .replace('{sub}', currentAudio);
}

function updatePlayer() {
    const iframe = document.getElementById('anime-iframe');
    const badge = document.getElementById('current-ep-badge');
    const prevBtn = document.getElementById('btn-prev-ep');
    const nextBtn = document.getElementById('btn-next-ep');

    if (iframe) {
        iframe.removeAttribute('sandbox');
        iframe.removeAttribute('referrerpolicy');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen');

        const streamUrl = getEmbedUrl();
        if (iframe.src !== streamUrl) {
            iframe.src = streamUrl;
        }
    }

    if (badge) {
        badge.textContent = `EP ${currentEp} • ${currentAudio.toUpperCase()}`;
    }

    if (prevBtn) prevBtn.disabled = currentEp <= 1;
    if (nextBtn) nextBtn.disabled = currentEp >= totalEpisodes;

    syncRangeDropdown();
    highlightActiveChip();

    document.querySelectorAll('.audio-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.audio === currentAudio);
    });

    const newUrl = `${window.location.pathname}?id=${encodeURIComponent(animeId)}&ep=${currentEp}&audio=${currentAudio}`;
    window.history.replaceState(null, '', newUrl);
}

function setupRangeDropdown(total) {
    const select = document.getElementById('ep-range-select');
    if (!select) return;

    select.innerHTML = '';
    const totalBatches = Math.ceil(total / EPS_PER_PAGE);

    if (totalBatches === 0) {
        select.innerHTML = '<option>No Episodes</option>';
        return;
    }

    for (let i = 0; i < totalBatches; i++) {
        const start = i * EPS_PER_PAGE + 1;
        const end = Math.min((i + 1) * EPS_PER_PAGE, total);
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `EPS ${start} - ${end}`;
        select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
        const batchIndex = parseInt(e.target.value, 10);
        renderEpisodeBatch(batchIndex, total);
    });
}

function syncRangeDropdown() {
    const select = document.getElementById('ep-range-select');
    if (!select || totalEpisodes === 0) return;

    const targetBatch = Math.floor((currentEp - 1) / EPS_PER_PAGE);
    if (parseInt(select.value, 10) !== targetBatch) {
        select.value = targetBatch;
        renderEpisodeBatch(targetBatch, totalEpisodes);
    }
}

function renderEpisodeBatch(batchIndex, total) {
    const container = document.getElementById('quick-episode-list');
    if (!container) return;

    if (total === 0) {
        container.innerHTML = '<p style="color: var(--text-dim); padding: 10px;">No episodes have aired yet.</p>';
        return;
    }

    const start = batchIndex * EPS_PER_PAGE + 1;
    const end = Math.min((batchIndex + 1) * EPS_PER_PAGE, total);

    let html = '';
    for (let i = start; i <= end; i++) {
        html += `
            <button class="ep-chip ${i === currentEp ? 'active' : ''}" data-ep="${i}">
                ${i}
            </button>
        `;
    }
    container.innerHTML = html;

    container.querySelectorAll('.ep-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            currentEp = parseInt(chip.dataset.ep, 10);
            updateServerTabs();
            updatePlayer();
        });
    });
}

function highlightActiveChip() {
    document.querySelectorAll('.ep-chip').forEach(chip => {
        const epVal = parseInt(chip.dataset.ep, 10);
        chip.classList.toggle('active', epVal === currentEp);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    parseQueryParams();

    const backBtn = document.getElementById('back-to-anime');
    if (backBtn) {
        backBtn.href = `../anime/?id=${encodeURIComponent(animeId)}`;
    }

    hindiData = await fetchHindiData();
    renderAudioButtons();
    await fetchApis();

    const media = await fetchAnimeFromAniList(animeId);
    if (media) {
        const title = media.title.english || media.title.romaji || "Anime";
        document.title = `AniTox Watching: ${title} (Ep ${currentEp})`;

        const titleLabel = document.getElementById('anime-title-label');
        if (titleLabel) titleLabel.textContent = title;

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
    }

    if (totalEpisodes > 0 && currentEp > totalEpisodes) {
        currentEp = totalEpisodes;
    }

    setupRangeDropdown(totalEpisodes);
    renderEpisodeBatch(Math.floor((currentEp - 1) / EPS_PER_PAGE), totalEpisodes);

    updateServerTabs();
    updatePlayer();

    document.getElementById('btn-prev-ep')?.addEventListener('click', () => {
        if (currentEp > 1) {
            currentEp--;
            updateServerTabs();
            updatePlayer();
        }
    });

    document.getElementById('btn-next-ep')?.addEventListener('click', () => {
        if (currentEp < totalEpisodes) {
            currentEp++;
            updateServerTabs();
            updatePlayer();
        }
    });
});