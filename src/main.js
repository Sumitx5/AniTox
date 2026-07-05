function hideAll() {
    const sections = ["home", "search", "help", "details", "player-view"];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
    });
}

window.home = () => { hideAll(); document.getElementById("home").hidden = false; };
window.searchAnim = () => { hideAll(); document.getElementById("search").hidden = false; };
window.help = () => { hideAll(); document.getElementById("help").hidden = false; };

function loadVideo(videoId) {
    const player = document.getElementById("anime-player");
    if (player) player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
}

async function fetchAnimeDetails(id, animeTitle) {
    const epListContainer = document.getElementById("episode-list");
    if (!epListContainer) return;
    epListContainer.innerHTML = "<p style='color:white;'>Loading Episodes...</p>";

    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${id}/episodes`);
        const result = await response.json(); 
        renderEpisodes(result.data, animeTitle); 
    } catch (e) {
        console.error("Episode Load Error:", e);
        epListContainer.innerHTML = "<p style='color:red;'>Episodes not available.</p>";
    }
}

async function playRealEpisode(animeTitle, episodeNum = 1) {
    if (!window.currentAnime) return;

    const player = document.getElementById("anime-player");
    const titleHeader = document.getElementById("now-watching-title");
    if (!player) return;

    const isTv = window.currentAnime.type ? (window.currentAnime.type.toLowerCase() !== "movie") : true;
    let streamId = null;

    const cleanTitle = (str) => {
        if (!str) return "";
        return str.toLowerCase()
                  .replace(/[\s\-\:]the\smovie$/i, "")
                  .replace(/[^a-z0-9]/g, "")
                  .trim();
    };

    if (window.currentAnime.imdb_id) {
        streamId = window.currentAnime.imdb_id;
    } else {
        const apiTitleEng = cleanTitle(window.currentAnime.title_english);
        const apiTitleRom = cleanTitle(window.currentAnime.title);
        
        const activeDatabase = isTv ? animeDatabase : movieDatabase;

        for (const key in activeDatabase) {
            const localName = cleanTitle(activeDatabase[key].name);
        
            if ((apiTitleEng && localName === apiTitleEng) || (apiTitleRom && localName === apiTitleRom)) {
                streamId = activeDatabase[key].imdb_id || key;
                break;
            }
        }
    }

    if (!streamId) {
        console.warn(`No normalized match found for: ${animeTitle}`);
        const trailerId = window.currentAnime.trailer ? window.currentAnime.trailer.youtube_id : null;
        if (trailerId) {
            player.src = `https://www.youtube.com/embed/${trailerId}?autoplay=1&rel=0`;
            if (titleHeader) titleHeader.innerText = `Watching Trailer: ${animeTitle}`;
        } else {
            player.src = "";
            if (titleHeader) titleHeader.innerText = `No Stream Found for ${animeTitle}`;
            alert(`Could not match "${animeTitle}" to database.`);
        }
        return;
    }

    if (!isTv) {
        player.src = `https://vaplayer.ru/embed/movie/${streamId}`;
        if (titleHeader) titleHeader.innerText = `Streaming Movie: ${animeTitle}`;
    } else {
        const season = 1; 
        player.src = `https://vaplayer.ru/embed/tv/${streamId}/${season}/${episodeNum}`;
        if (titleHeader) titleHeader.innerText = `Streaming: ${animeTitle} - Episode ${episodeNum}`;
    }

    console.log(`🎬 Stream Mounted Successfully: ${player.src}`);
}

function renderEpisodes(episodesArray, animeTitle) {
    const list = document.getElementById("episode-list");
    if (!list) return;
    list.innerHTML = ""; 

    if (!episodesArray || episodesArray.length === 0) {
        list.innerHTML = "<p style='color:white; padding:10px;'>No structured episode links found.</p>";
        return;
    }

    episodesArray.forEach(ep => {
        const item = document.createElement("div");
        item.className = "episode-item";
        item.id = `ep-${ep.mal_id}`; 
        item.innerHTML = `<span>Ep ${ep.mal_id}: ${ep.title || 'Episode ' + ep.mal_id}</span>`;
        
        item.onclick = async () => {
            const prev = document.querySelector(".episode-item.active");
            if (prev) prev.classList.remove("active");
            
            item.classList.add("active");
            await playRealEpisode(animeTitle, ep.mal_id);
        };
        
        list.appendChild(item);
    });
}

let movieDatabase = {};
let animeDatabase = {};

async function loadAnimeIdBridge() {
    try {
        const movieResponse = await fetch('./movies_list_imdb.json');
        movieDatabase = await movieResponse.json();
        console.log("🎬 Movies Loaded Successfully. Size:", Object.keys(movieDatabase).length);
    } catch (err) {
        console.error("Critical parse block crash tracking structural initialization parameters on Movies JSON file:", err);
    }

    try {
        const animeResponse = await fetch('./tv_list_imdb.json');
        animeDatabase = await animeResponse.json();
        console.log("📺 Anime Series Loaded Successfully. Size:", Object.keys(animeDatabase).length);
    } catch (err) {
        console.error("Critical parse block crash tracking structural initialization parameters on Anime JSON file:", err);
    }
}

window.showDetails = (anime) => {
    hideAll();
    window.currentAnime = anime;
    const content = document.getElementById("details-content");
    if (!content) return;

    const title = anime.title_english || anime.title || anime.name;
    const bannerImg = anime.images?.jpg?.large_image_url || anime.poster_url || anime.poster;
    const score = anime.score || anime.rating || 'N/A';
    
    let genresText = 'Anime';
    if (Array.isArray(anime.genres)) {
        genresText = anime.genres.map(g => g.name).slice(0, 3).join(', ');
    } else if (typeof anime.genre === 'string' || typeof anime.genres === 'string') {
        genresText = anime.genre || anime.genres;
    }

    content.innerHTML = `
        <div class="crunchy-details">
            <div class="hero-banner" style="background-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 100%), url('${bannerImg}');">
                <div class="hero-overlay">
                    <h1 class="hero-title">${title}</h1>
                    <p class="hero-meta">
                        <span class="rating-pill">U/A 16+</span> • Sub | Dub • ${genresText}
                    </p>
                    <div class="hero-stars">
                        ★ ★ ★ ★ ★ <span class="score-num">${score}</span>
                    </div>
                </div>
            </div>

            <div class="action-bar">
                <button class="start-btn" onclick="watchNow(window.currentAnime)">
                    <i class="play-icon">▶</i> START WATCHING
                </button>
            </div>

            <div class="interaction-row">
                <div class="inter-item"><span class="plus">+</span><p>MY LIST</p></div>
                <div class="inter-item"><span class="share">🔗</span><p>SHARE</p></div>
            </div>
        </div>
    `;
    
    const synopsisEl = document.getElementById("anime-synopsis");
    if (synopsisEl) {
        synopsisEl.innerText = anime.synopsis || anime.description || anime.overview || "No description available.";
    }
    
    document.getElementById("details").hidden = false;
    window.scrollTo(0, 0);
};

window.watchNow = (anime) => {
    window.currentAnime = anime;

    hideAll();
    document.getElementById("player-view").hidden = false;
    
    const titleHeader = document.getElementById("now-watching-title");
    const title = anime.title_english || anime.title;

    if (titleHeader) {
        titleHeader.innerText = `Streaming: ${title}`;
    }

    playRealEpisode(title, 1);
    
    const isTv = anime.type ? (anime.type.toLowerCase() !== "movie") : true;
    if (isTv) {
        fetchAnimeDetails(anime.mal_id, title);
    } else {
        const epListContainer = document.getElementById("episode-list");
        if (epListContainer) epListContainer.innerHTML = ""; 
    }
};

document.addEventListener("DOMContentLoaded", () => {
    loadAnimeIdBridge();

    const moviesGrid = document.getElementById("movies-anime-grid");
    const showsGrid = document.getElementById("shows-anime-grid");
    const searchGrid = document.getElementById("search-anime-grid");
    const searchBtn = document.getElementById("done");
    const searchInput = document.getElementById("query_search");

    async function fetchAndRender(url, target) {
        if (!target || !url) return; 
        target.innerHTML = "<p style='color:white;'>Loading archive entries...</p>";
        try {
            const response = await fetch(url);
            const result = await response.json();
            renderGrid(target, result.data || []); 
        } catch (e) {
            console.error("Jikan Endpoint Fetch Failure:", e);
            target.innerHTML = "<p style='color:var(--red);'>API is OFFLINE (Rate Limited)</p>";
        }
    }

    function renderGrid(target, list) {
        target.innerHTML = "";
        if (!list || list.length === 0) {
            target.innerHTML = "<p style='color:white;'>No results found.</p>";
            return;
        }

        list.forEach(anime => {
            const cardImg = anime.images?.jpg?.image_url || anime.poster_url;
            const cardTitle = anime.title_english || anime.title;

            if (!cardImg) return; 

            const card = document.createElement("div");
            card.className = "anime-card";
            card.innerHTML = `
                <img src="${cardImg}" alt="${cardTitle}" onerror="this.src='https://placehold.co/300x450/111/fff?text=No+Poster';">
                <div class="card-info">
                    <h3>${cardTitle}</h3>
                </div>
            `;
            card.onclick = () => typeof showDetails === 'function' && showDetails(anime); 
            target.appendChild(card);
        });
    }

    if (searchBtn && searchInput) {
        searchBtn.onclick = async () => {
            const query = encodeURIComponent(searchInput.value.trim());
            if (!query) return;

            if (searchGrid) {
                searchGrid.innerHTML = "<p style='color:white;'>Querying live indices...</p>";
            }

            try {
                const response = await fetch(`https://api.jikan.moe/v4/anime?q=${query}&limit=20`);
                const result = await response.json();
                renderGrid(searchGrid, result.data); 
            } catch (e) {
                console.error("Search Error:", e);
                if (searchGrid) {
                    searchGrid.innerHTML = "<p style='color:var(--red);'>Gateway connection timeout.</p>";
                }
            }
        };
    }
    
    async function initHome() {
        await fetchAndRender("https://api.jikan.moe/v4/top/anime?type=tv&filter=airing&limit=15", showsGrid);
        await fetchAndRender("https://api.jikan.moe/v4/top/anime?type=movie&limit=15", moviesGrid);
    }

    initHome();
});

window.help = () => {
    hideAll();
    const helpEl = document.getElementById("help");
    if (helpEl) helpEl.hidden = false;
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()]; 
    
    loadSchedule(today);
};

async function loadSchedule(day) {
    const tableBody = document.getElementById("schedule-body");
    if (!tableBody) return;

    tableBody.innerHTML = "<tr><td colspan='2' style='color:white; padding:20px;'>Loading...</td></tr>";

    document.querySelectorAll('.schedule-tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase().includes(day.substring(0, 3)));
    });

    try {
        const res = await fetch(`https://api.jikan.moe/v4/schedules?filter=${day}`);
        const result = await res.json();
        renderScheduleTable(result.data); 
    } catch (err) {
        tableBody.innerHTML = "<tr><td colspan='2' class='red-text'>Failed to load. Try again!</td></tr>";
    }
}

function renderScheduleTable(list) {
    const tableBody = document.getElementById("schedule-body");
    if (!tableBody) return;
    tableBody.innerHTML = ""; 

    if (!list || list.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='2' style='color:white;'>No anime found today.</td></tr>";
        return;
    }

    list.forEach(anime => {
        const row = document.createElement("tr");
        row.className = "schedule-row";
        row.onclick = () => showDetails(anime);

        row.innerHTML = `
            <td class="anime-img-cell">
                <img src="${anime.images.jpg.small_image_url}" alt="thumb">
            </td>
            <td class="anime-info-cell">
                <div class="anime-name">${anime.title_english || anime.title}</div>
                <div class="anime-ep">EP: ${anime.episodes || '??'}</div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}