let spotlightInterval = null;
let currentSlideIndex = 0;

function renderSpotlight(spotlightList) {
    const container = document.getElementById('spotlight-carousel');
    if (!container || !spotlightList || spotlightList.length === 0) return;

    const slidesHTML = spotlightList.map((item, index) => {
        const bgImg = item.image_horizontal || item.image;
       
        const logoUrl = item.image_title || item.iamge_title;
        const titleContent = logoUrl 
            ? `<img src="${logoUrl}" alt="${item.title}" class="spotlight-title-img" />`
            : `<h1 class="spotlight-title-text">${item.title}</h1>`;

        return `
            <div class="spotlight-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                <img src="${bgImg}" alt="${item.title}" class="spotlight-bg" loading="lazy" />
                <div class="spotlight-overlay"></div>
                <div class="spotlight-content">
                    ${titleContent}
                    <div class="spotlight-actions">
                        <a href="watch/?id=${encodeURIComponent(item.id)}" class="spotlight-btn-watch">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            <span>Watch Now</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const dotsHTML = `
        <div class="spotlight-dots">
            ${spotlightList.map((_, i) => `
                <button class="spotlight-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})" aria-label="Slide ${i + 1}"></button>
            `).join('')}
        </div>
    `;

    container.innerHTML = slidesHTML + dotsHTML;
    startSpotlightTimer(spotlightList.length);
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.spotlight-slide');
    const dots = document.querySelectorAll('.spotlight-dot');
    if (!slides.length) return;

    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    currentSlideIndex = (index + slides.length) % slides.length;

    slides[currentSlideIndex].classList.add('active');
    if (dots[currentSlideIndex]) {
        dots[currentSlideIndex].classList.add('active');
    }
}

function startSpotlightTimer(totalSlides) {
    if (spotlightInterval) clearInterval(spotlightInterval);
    spotlightInterval = setInterval(() => {
        goToSlide(currentSlideIndex + 1);
    }, 3000);
}

function createCardHTML(anime) {
    const rating = anime.rating || '0.0';
    const type = anime.type || 'TV';

    return `
        <a href="anime/?id=${encodeURIComponent(anime.id)}" class="anime-card" data-id="${anime.id}">
            <img 
                src="${anime.image}" 
                alt="${anime.title}" 
                loading="lazy" 
                onerror="this.src='https://placehold.co/165x240/111/fff?text=No+Cover'"
            />
            <h3 title="${anime.title}">${anime.title}</h3>
            <div class="card-meta">
                <span class="card-rating">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    ${rating}
                </span>
                <span class="card-type">${type}</span>
            </div>
        </a>
    `;
}

async function loadAnimeCatalog() {
    try {
        const repoName = window.location.pathname.split('/')[1];
        const basePath = window.location.origin.includes('github.io') ? `/${repoName}/` : './';

        const res = await fetch(`${basePath}assets/data/anime_data.json`);
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const data = await res.json();

        if (data.spotlight) {
            renderSpotlight(data.spotlight);
        }

        const categories = [
            'trending_this_week',
            'top_anime',
            'new_season_arrivals',
            'top_anime_movies',
            'action_zone',
            'romance_drama',
            'high_rated_gems',
            'shows',          
            'movies'         
        ];

        categories.forEach(category => {
            const el = document.getElementById(category);
            if (el && Array.isArray(data[category])) {
                el.innerHTML = data[category].map(createCardHTML).join('');
            }
        });

    } catch (err) {
        console.error('Failed to load anime data:', err);
    }
}

document.addEventListener('DOMContentLoaded', loadAnimeCatalog);