const ANILIST_API = 'https://graphql.anilist.co';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let activeDayTimestamp = null; // Target Unix day start
let scheduleCache = {}; // Cache results by date timestamp

// 1. Airing Schedule GraphQL Query
const SCHEDULE_QUERY = `
query ($airingAt_greater: Int, $airingAt_lesser: Int) {
  Page (page: 1, perPage: 50) {
    airingSchedules (airingAt_greater: $airingAt_greater, airingAt_lesser: $airingAt_lesser, sort: TIME) {
      id
      airingAt
      episode
      timeUntilAiring
      media {
        id
        title {
          english
          romaji
        }
        coverImage {
          medium
          large
        }
        genres
        format
      }
    }
  }
}
`;

// 2. Build 7-Day Tabs (Today + next 6 days)
function renderDayTabs() {
    const daysBar = document.getElementById('days-bar');
    if (!daysBar) return;

    const now = new Date();
    let html = '';

    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);

        // Normalize to midnight local time
        d.setHours(0, 0, 0, 0);
        const dayStartUnix = Math.floor(d.getTime() / 1000);

        if (i === 0) activeDayTimestamp = dayStartUnix;

        const dayName = DAYS[d.getDay()];
        const dateStr = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;

        html += `
            <div class="day-tab ${i === 0 ? 'active' : ''}" data-timestamp="${dayStartUnix}">
                <span class="day-name">${i === 0 ? 'Today' : dayName}</span>
                <span class="day-date">${dateStr}</span>
            </div>
        `;
    }

    daysBar.innerHTML = html;

    // Click handlers for day tabs
    daysBar.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            daysBar.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            activeDayTimestamp = parseInt(tab.dataset.timestamp, 10);
            fetchScheduleForDay(activeDayTimestamp);
        });
    });
}

// 3. Fetch Airing Schedules for a 24-Hour window
async function fetchScheduleForDay(dayStartUnix) {
    const timeline = document.getElementById('schedule-timeline');
    if (!timeline) return;

    // Use cached data if available
    if (scheduleCache[dayStartUnix]) {
        renderTimeline(scheduleCache[dayStartUnix]);
        return;
    }

    timeline.innerHTML = '<div class="schedule-msg">Loading anime schedule...</div>';

    const dayEndUnix = dayStartUnix + 86400; // 24 hours later

    try {
        const res = await fetch(ANILIST_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: SCHEDULE_QUERY,
                variables: {
                    airingAt_greater: dayStartUnix,
                    airingAt_lesser: dayEndUnix
                }
            })
        });

        if (!res.ok) throw new Error(`AniList error: ${res.status}`);
        const json = await res.json();
        const schedules = json.data?.Page?.airingSchedules || [];

        scheduleCache[dayStartUnix] = schedules;
        renderTimeline(schedules);
    } catch (err) {
        console.error('Schedule fetch error:', err);
        timeline.innerHTML = '<div class="schedule-msg">Failed to load schedule for this day.</div>';
    }
}

// 4. Render Schedule Cards into the Timeline
function renderTimeline(schedules) {
    const timeline = document.getElementById('schedule-timeline');
    if (!timeline) return;

    if (!schedules || schedules.length === 0) {
        timeline.innerHTML = '<div class="schedule-msg">No scheduled anime found for this date.</div>';
        return;
    }

    timeline.innerHTML = schedules.map(item => {
        const media = item.media;
        if (!media) return '';

        const title = media.title.english || media.title.romaji || 'Unknown Anime';
        const cover = media.coverImage?.medium || media.coverImage?.large || 'https://placehold.co/55x75/111/fff?text=No+Cover';
        const genre = media.genres?.[0] || media.format || 'TV';

        // Localized Airing Time (e.g., 06:30 PM)
        const dateObj = new Date(item.airingAt * 1000);
        const airTime = dateObj.toLocaleTimeString('en-IN', {
                                                                timeZone: 'Asia/Kolkata',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: true
                                                            });

        // Relative countdown / Airing status
        const isAired = item.timeUntilAiring <= 0;
        const statusText = isAired ? 'Aired' : `In ${formatTimeUntil(item.timeUntilAiring)}`;

        return `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-connector"></div>
                <a href="../anime/?id=${media.id}" class="schedule-card" title="${title}">
                    <img src="${cover}" alt="${title}" class="schedule-thumb" loading="lazy" />
                    <div class="schedule-info">
                        <h3 class="schedule-anime-title">${title}</h3>
                        <div class="schedule-meta">
                            <span class="ep-badge">EP ${item.episode}</span>
                            <span class="genre-tag">• ${genre}</span>
                        </div>
                    </div>
                    <div class="schedule-time-block">
                        <span class="air-time">${airTime} <small style="font-size:0.65rem; color:var(--text-dim);">IST</small></span>
                        <span class="air-status">${statusText}</span>
                    </div>
                </a>
            </div>
        `;
    }).join('');
}

// Helper: Format remaining seconds into "Xh Ym"
function formatTimeUntil(seconds) {
    if (seconds <= 0) return 'now';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
}

// 5. Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderDayTabs();
    if (activeDayTimestamp) {
        fetchScheduleForDay(activeDayTimestamp);
    }
});