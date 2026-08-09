// ═══════════════════════════════════════════════════════════════
// YUKI ANIME v2.0 — Full UI Premium
// Semua HTML di-render via JavaScript
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
    BASE_URL: 'https://s13.nontonanimeid.boats',
    PROXY_URL: '../api/proxy.php?url=',
    DEFAULT_POSTER: 'https://yuki-regal.vercel.app//Yuki1785994239187.jpg',
    LOGO: 'https://yuki-regal.vercel.app//Yuki1785746271503.jpg',
    ITEMS_PER_PAGE: 24
};

// ═══════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const AppState = {
    currentPage: 'home',
    currentAnime: null,
    currentEpisode: null,
    searchQuery: '',
    animeList: [],
    latestEpisodes: [],
    popularAnime: [],
    isLoading: false,
    isMenuOpen: false,
    toastId: 0
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const id = ++AppState.toastId;
    
    const colors = {
        info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        error: 'border-red-500/30 bg-red-500/10 text-red-400',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    };
    
    const icons = {
        info: 'info',
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast pointer-events-auto glass px-4 py-3 rounded-xl border ${colors[type]} flex items-center gap-3 min-w-[280px] max-w-[400px]`;
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="w-5 h-5 flex-shrink-0"></i>
        <span class="text-sm font-medium text-slate-200">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ═══════════════════════════════════════════════════════════════
// SCRAPER ENGINE
// ═══════════════════════════════════════════════════════════════

async function fetchWithProxy(url) {
    try {
        const proxyUrl = CONFIG.PROXY_URL + encodeURIComponent(url);
        const res = await fetch(proxyUrl, { 
            headers: { 'Accept': 'text/html' },
            signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (err) {
        // Fallback: direct fetch (might fail due to CORS)
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            return await res.text();
        } catch {
            throw new Error('Gagal mengambil data. Pastikan proxy PHP aktif.');
        }
    }
}

function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
}

// Multiple selector strategies for robust scraping
function scrapeAnimeList(doc) {
    const results = [];
    
    // Strategy 1: Common anime card selectors
    const selectors = [
        '.anime-item', '.episode', '.thumb', '.item', 
        'article.post', '.bsx', '.animposx', '.bs'
    ];
    
    for (const sel of selectors) {
        const items = doc.querySelectorAll(sel);
        if (items.length > 0) {
            items.forEach(item => {
                const link = item.querySelector('a');
                const img = item.querySelector('img');
                const title = item.querySelector('.title, h2, h3, h4, .entry-title, .name, .tt');
                const epEl = item.querySelector('.episode, .ep, .latest-episode, .sb, .epx');
                const typeEl = item.querySelector('.type, .status, .sb');
                
                if (title) {
                    results.push({
                        title: title.textContent.trim(),
                        poster: img?.dataset?.src || img?.src || '',
                        slug: link?.getAttribute('href') || '',
                        episode: epEl?.textContent?.trim()?.replace(/[^0-9]/g, '') || '',
                        type: typeEl?.textContent?.trim() || 'TV',
                        raw: item
                    });
                }
            });
            if (results.length > 0) break;
        }
    }
    
    // Strategy 2: Fallback - any link with anime/episode
    if (results.length === 0) {
        const links = doc.querySelectorAll('a[href*="/anime/"], a[href*="/episode/"]');
        const seen = new Set();
        links.forEach(link => {
            const img = link.querySelector('img');
            const text = link.textContent.trim().split('\n')[0];
            if (text && text.length > 2 && !seen.has(text)) {
                seen.add(text);
                results.push({
                    title: text,
                    poster: img?.dataset?.src || img?.src || '',
                    slug: link.getAttribute('href') || '',
                    episode: '',
                    type: 'TV'
                });
            }
        });
    }
    
    return results;
}

function scrapeAnimeDetail(doc) {
    const title = doc.querySelector('h1, .entry-title, .title')?.textContent?.trim() || 'Unknown Anime';
    const poster = doc.querySelector('.poster img, .thumb img, .cover img, .wp-post-image')?.dataset?.src 
        || doc.querySelector('.poster img, .thumb img, .cover img, .wp-post-image')?.src 
        || '';
    const synopsis = doc.querySelector('.synopsis, .desc, .description, .entry-content, [class*="sinopsis"]')?.textContent?.trim() || '';
    
    const genres = [];
    doc.querySelectorAll('.genre a, .genres a, [class*="genre"] a, .mgen a').forEach(el => {
        const g = el.textContent.trim();
        if (g && !genres.includes(g)) genres.push(g);
    });
    
    const episodes = [];
    doc.querySelectorAll('.episode-list a, .episodes a, [class*="episode"] a, .eplister a, .eps a').forEach((el, i) => {
        const epNum = el.textContent.match(/\d+/)?.[0] || (i + 1).toString();
        episodes.push({
            number: epNum,
            title: `Episode ${epNum}`,
            link: el.getAttribute('href') || '',
            date: ''
        });
    });
    
    // Fallback
    if (episodes.length === 0) {
        doc.querySelectorAll('a[href*="/episode/"]').forEach((el, i) => {
            const epNum = el.textContent.match(/\d+/)?.[0] || (i + 1).toString();
            episodes.push({
                number: epNum,
                title: el.textContent.trim() || `Episode ${epNum}`,
                link: el.getAttribute('href') || '',
                date: ''
            });
        });
    }
    
    // Sort episodes
    episodes.sort((a, b) => parseInt(b.number) - parseInt(a.number));
    
    const statusEl = doc.querySelector('.status, [class*="status"]');
    const ratingEl = doc.querySelector('.rating, [class*="rating"], .score');
    
    return {
        title,
        poster,
        synopsis,
        genres,
        episodes,
        status: statusEl?.textContent?.trim() || 'Ongoing',
        rating: ratingEl?.textContent?.trim()?.match(/[\d.]+/)?.[0] || '-',
        type: 'TV'
    };
}

function scrapeVideoUrl(doc) {
    // Try iframe
    const iframe = doc.querySelector('iframe');
    if (iframe) return iframe.src;
    
    // Try video source
    const videoSrc = doc.querySelector('video source')?.src;
    if (videoSrc) return videoSrc;
    
    // Try embed
    const embed = doc.querySelector('[class*="player"] iframe, [id*="player"] iframe');
    if (embed) return embed.src;
    
    // Try data attributes
    const dataSrc = doc.querySelector('[data-video], [data-src]');
    if (dataSrc) return dataSrc.dataset.video || dataSrc.dataset.src;
    
    return null;
}

// ═══════════════════════════════════════════════════════════════
// DATA FETCHERS
// ═══════════════════════════════════════════════════════════════

async function fetchHomeData() {
    try {
        const html = await fetchWithProxy(CONFIG.BASE_URL);
        const doc = parseHTML(html);
        const animeList = scrapeAnimeList(doc);
        
        AppState.latestEpisodes = animeList.slice(0, 12);
        AppState.popularAnime = animeList.slice(0, 10);
        
        return animeList;
    } catch (err) {
        showToast(err.message, 'error');
        return [];
    }
}

async function fetchAnimeList(page = 1) {
    try {
        const url = `${CONFIG.BASE_URL}/anime-list/page/${page}`;
        const html = await fetchWithProxy(url);
        const doc = parseHTML(html);
        return scrapeAnimeList(doc);
    } catch (err) {
        showToast(err.message, 'error');
        return [];
    }
}

async function fetchSearchResults(query) {
    try {
        const url = `${CONFIG.BASE_URL}/?s=${encodeURIComponent(query)}`;
        const html = await fetchWithProxy(url);
        const doc = parseHTML(html);
        return scrapeAnimeList(doc);
    } catch (err) {
        showToast(err.message, 'error');
        return [];
    }
}

async function fetchAnimeDetail(slug) {
    const url = slug.startsWith('http') ? slug : CONFIG.BASE_URL + slug;
    const html = await fetchWithProxy(url);
    const doc = parseHTML(html);
    return scrapeAnimeDetail(doc);
}

async function fetchEpisodeVideo(link) {
    const url = link.startsWith('http') ? link : CONFIG.BASE_URL + link;
    const html = await fetchWithProxy(url);
    const doc = parseHTML(html);
    return scrapeVideoUrl(doc);
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildHeader() {
    return `
    <header class="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/[0.06]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16 lg:h-18">
                <!-- Logo -->
                <div class="flex items-center gap-3 cursor-pointer group" onclick="navigate('home')">
                    <div class="relative">
                        <img src="${CONFIG.LOGO}" alt="Yuki" class="w-10 h-10 rounded-xl object-cover border border-white/10 group-hover:border-indigo-500/50 transition">
                        <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#12121a]"></div>
                    </div>
                    <div class="hidden sm:block">
                        <h1 class="text-lg font-bold text-white tracking-tight font-['Space_Grotesk']">Yuki <span class="gradient-text">Anime</span></h1>
                        <p class="text-[10px] text-slate-500 -mt-1 tracking-widest uppercase">Gratis & No Ads</p>
                    </div>
                </div>
                
                <!-- Desktop Nav -->
                <nav class="hidden lg:flex items-center gap-1">
                    ${[
                        { id: 'home', label: 'Beranda', icon: 'home' },
                        { id: 'latest', label: 'Terbaru', icon: 'sparkles' },
                        { id: 'list', label: 'Daftar Anime', icon: 'layout-grid' }
                    ].map(item => `
                        <button onclick="navigate('${item.id}')" 
                            class="nav-btn px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${AppState.currentPage === item.id ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}">
                            <i data-lucide="${item.icon}" class="w-4 h-4"></i>
                            ${item.label}
                        </button>
                    `).join('')}
                </nav>

                <!-- Search + Mobile Menu -->
                <div class="flex items-center gap-3">
                    <div class="relative hidden md:block">
                        <input type="text" id="searchInput" placeholder="Cari anime..." 
                            class="search-input w-56 lg:w-72 pl-10 pr-4 py-2.5 rounded-xl text-sm"
                            onkeypress="if(event.key==='Enter') handleSearch()">
                        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                    </div>
                    <button onclick="toggleMobileMenu()" class="lg:hidden p-2 rounded-lg hover:bg-white/5 transition">
                        <i data-lucide="menu" class="w-5 h-5 text-slate-300"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Mobile Menu -->
        <div id="mobileMenu" class="mobile-menu fixed inset-y-0 right-0 w-72 glass-strong border-l border-white/[0.06] z-50 p-6 lg:hidden">
            <div class="flex justify-between items-center mb-8">
                <span class="font-bold text-white font-['Space_Grotesk']">Menu</span>
                <button onclick="toggleMobileMenu()" class="p-2 rounded-lg hover:bg-white/5">
                    <i data-lucide="x" class="w-5 h-5 text-slate-400"></i>
                </button>
            </div>
            <div class="flex flex-col gap-2">
                ${[
                    { id: 'home', label: 'Beranda', icon: 'home' },
                    { id: 'latest', label: 'Episode Terbaru', icon: 'sparkles' },
                    { id: 'list', label: 'Daftar Anime', icon: 'layout-grid' }
                ].map(item => `
                    <button onclick="navigate('${item.id}'); toggleMobileMenu()" 
                        class="px-4 py-3 rounded-xl text-left text-sm font-medium transition flex items-center gap-3 ${AppState.currentPage === item.id ? 'text-white bg-indigo-500/10 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}">
                        <i data-lucide="${item.icon}" class="w-4 h-4"></i>
                        ${item.label}
                    </button>
                `).join('')}
            </div>
            <div class="mt-8 pt-6 border-t border-white/[0.06]">
                <div class="relative">
                    <input type="text" placeholder="Cari anime..." 
                        class="search-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                        onkeypress="if(event.key==='Enter') { handleSearch(); toggleMobileMenu(); }">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                </div>
            </div>
        </div>
        <div id="mobileOverlay" onclick="toggleMobileMenu()" class="fixed inset-0 bg-black/60 z-40 hidden lg:hidden backdrop-blur-sm"></div>
    </header>
    `;
}

function buildFooter() {
    return `
    <footer class="border-t border-white/[0.06] mt-20 bg-[#0a0a0f]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="grid md:grid-cols-3 gap-8 mb-8">
                <div>
                    <div class="flex items-center gap-3 mb-4">
                        <img src="${CONFIG.LOGO}" class="w-10 h-10 rounded-xl object-cover border border-white/10">
                        <div>
                            <h3 class="font-bold text-white font-['Space_Grotesk']">Yuki Anime</h3>
                            <p class="text-[10px] text-slate-500 tracking-widest uppercase">Nonton Gratis</p>
                        </div>
                    </div>
                    <p class="text-slate-500 text-sm leading-relaxed">
                        Platform nonton anime subtitle Indonesia gratis tanpa iklan dan pop up. Update episode terbaru setiap hari.
                    </p>
                </div>
                <div>
                    <h4 class="text-white font-semibold mb-4 text-sm">Navigasi</h4>
                    <div class="flex flex-col gap-2">
                        ${['Beranda', 'Episode Terbaru', 'Daftar Anime', 'Cari Anime'].map(t => 
                            `<span class="text-slate-500 text-sm hover:text-indigo-400 transition cursor-pointer">${t}</span>`
                        ).join('')}
                    </div>
                </div>
                <div>
                    <h4 class="text-white font-semibold mb-4 text-sm">Disclaimer</h4>
                    <p class="text-slate-500 text-sm leading-relaxed">
                        Semua konten diambil dari sumber publik. Kami tidak menyimpan file video di server kami. Hak cipta milik pemilik masing-masing.
                    </p>
                </div>
            </div>
            <div class="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p class="text-slate-600 text-xs"> Yuki Anime. All rights reserved.</p>
                <div class="flex items-center gap-2 text-slate-600 text-xs">
                    <span>Made with</span>
                    <i data-lucide="heart" class="w-3 h-3 text-red-500 fill-red-500"></i>
                    <span>in Indonesia</span>
                </div>
            </div>
        </div>
    </footer>
    `;
}

function buildSkeletonCard() {
    return `
    <div class="rounded-2xl overflow-hidden border border-white/[0.06] bg-[#16161f]">
        <div class="aspect-[3/4] skeleton"></div>
        <div class="p-3 space-y-2">
            <div class="h-4 skeleton w-3/4"></div>
            <div class="h-3 skeleton w-1/2"></div>
        </div>
    </div>
    `;
}

function buildSkeletonGrid(count = 10) {
    return Array(count).fill(0).map(() => buildSkeletonCard()).join('');
}

function buildAnimeCard(anime, index = 0) {
    const title = escapeHtml(anime.title || 'Unknown');
    const poster = anime.poster || CONFIG.DEFAULT_POSTER;
    const ep = anime.episode || '';
    const type = anime.type || 'TV';
    const slug = anime.slug || '#';
    const delay = index * 50;
    
    return `
    <div class="group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-[#16161f] card-hover cursor-pointer fade-in-up"
         style="animation-delay: ${delay}ms"
         onclick="openAnime('${escapeHtml(slug)}')">
        <div class="aspect-[3/4] overflow-hidden relative">
            <img src="${poster}" alt="${title}" loading="lazy"
                class="w-full h-full object-cover img-zoom"
                onerror="this.src='${CONFIG.DEFAULT_POSTER}'">
            <div class="absolute inset-0 overlay-gradient"></div>
            
            ${ep ? `
            <div class="absolute top-3 right-3 bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-lg shadow-indigo-600/20">
                EP ${ep}
            </div>` : ''}
            
            <div class="absolute top-3 left-3">
                <span class="tag text-[10px]">${type}</span>
            </div>
            
            <!-- Play Button Overlay -->
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div class="w-14 h-14 rounded-full bg-indigo-600/90 backdrop-blur-sm flex items-center justify-center shadow-xl shadow-indigo-600/30 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <i data-lucide="play" class="w-6 h-6 text-white fill-white ml-1"></i>
                </div>
            </div>
            
            <div class="absolute bottom-0 left-0 right-0 p-4">
                <h3 class="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-indigo-300 transition-colors">${title}</h3>
            </div>
        </div>
    </div>
    `;
}

function buildEpisodeRow(ep, isActive = false) {
    return `
    <div class="episode-item flex items-center gap-4 p-4 rounded-xl border ${isActive ? 'border-indigo-500/30 bg-indigo-500/[0.08]' : 'border-white/[0.06] bg-[#16161f]/50'} fade-in-up"
         onclick="playEpisode('${escapeHtml(ep.link)}', '${ep.number}')">
        <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <span class="text-indigo-400 font-bold text-sm">${ep.number}</span>
        </div>
        <div class="flex-1 min-w-0">
            <h4 class="text-white text-sm font-medium truncate">${escapeHtml(ep.title)}</h4>
            ${ep.date ? `<p class="text-slate-500 text-xs mt-0.5">${ep.date}</p>` : ''}
        </div>
        <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <i data-lucide="play" class="w-4 h-4 text-indigo-400 fill-indigo-400"></i>
        </div>
    </div>
    `;
}

function buildSectionHeader(title, icon, action = null) {
    return `
    <div class="flex items-center justify-between mb-6">
        <h2 class="section-title">
            <i data-lucide="${icon}" class="w-6 h-6 text-indigo-400"></i>
            ${title}
        </h2>
        ${action ? `
        <button onclick="${action.onClick}" class="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition flex items-center gap-1 group">
            ${action.label}
            <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
        </button>` : ''}
    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// PAGE RENDERERS
// ═══════════════════════════════════════════════════════════════

function renderHome() {
    return `
    <div class="min-h-screen">
        <!-- Hero Section -->
        <section class="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden noise">
            <!-- Gradient Orbs -->
            <div class="hero-orb w-[500px] h-[500px] bg-indigo-600 top-[-200px] left-[-100px]"></div>
            <div class="hero-orb w-[400px] h-[400px] bg-purple-600 top-[100px] right-[-100px] opacity-20"></div>
            <div class="hero-orb w-[300px] h-[300px] bg-pink-600 bottom-[-100px] left-[30%] opacity-15"></div>
            
            <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6 fade-in-up">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Update Episode Terbaru Setiap Hari
                </div>
                
                <h1 class="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 tracking-tight fade-in-up" style="animation-delay: 100ms">
                    Nonton Anime <br>
                    <span class="gradient-text glow-text">Tanpa Batas</span>
                </h1>
                
                <p class="text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up" style="animation-delay: 200ms">
                    Ribuan anime subtitle Indonesia gratis. Tanpa iklan, tanpa pop up, tanpa ribet. 
                    Streaming HD langsung dari browser.
                </p>
                
                <div class="flex flex-wrap justify-center gap-4 fade-in-up" style="animation-delay: 300ms">
                    <button onclick="navigate('latest')" class="btn-primary flex items-center gap-2">
                        <i data-lucide="play" class="w-4 h-4 fill-white"></i>
                        Mulai Nonton
                    </button>
                    <button onclick="focusSearch()" class="btn-secondary flex items-center gap-2">
                        <i data-lucide="search" class="w-4 h-4"></i>
                        Cari Anime
                    </button>
                </div>
                
                <!-- Stats -->
                <div class="flex flex-wrap justify-center gap-8 md:gap-16 mt-16 fade-in-up" style="animation-delay: 400ms">
                    ${[
                        { value: '10K+', label: 'Anime' },
                        { value: '50K+', label: 'Episode' },
                        { value: '0', label: 'Iklan' }
                    ].map(stat => `
                        <div class="text-center">
                            <div class="text-2xl md:text-3xl font-bold text-white font-['Space_Grotesk']">${stat.value}</div>
                            <div class="text-xs text-slate-500 uppercase tracking-widest mt-1">${stat.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <!-- Latest Episodes -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            ${buildSectionHeader('Episode Terbaru', 'sparkles', { label: 'Lihat Semua', onClick: "navigate('latest')" })}
            <div id="latestGrid" class="anime-grid">
                ${buildSkeletonGrid(10)}
            </div>
        </section>

        <!-- Popular Anime -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-white/[0.06]">
            ${buildSectionHeader('Anime Populer', 'trending-up')}
            <div id="popularGrid" class="anime-grid">
                ${buildSkeletonGrid(10)}
            </div>
        </section>

        <!-- Features -->
        <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/[0.06]">
            <div class="grid md:grid-cols-3 gap-6">
                ${[
                    { icon: 'shield-check', title: '100% Gratis', desc: 'Tidak ada biaya langganan. Nonton sepuasnya tanpa khawatir.' },
                    { icon: 'ban', title: 'Tanpa Iklan', desc: 'Pengalaman nonton yang bersih tanpa gangguan iklan atau pop up.' },
                    { icon: 'zap', title: 'Update Cepat', desc: 'Episode terbaru tersedia dalam waktu singkat setelah rilis.' }
                ].map((f, i) => `
                    <div class="glass rounded-2xl p-6 border border-white/[0.06] hover:border-indigo-500/20 transition group fade-in-up" style="animation-delay: ${i * 100}ms">
                        <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <i data-lucide="${f.icon}" class="w-6 h-6 text-indigo-400"></i>
                        </div>
                        <h3 class="text-white font-semibold mb-2">${f.title}</h3>
                        <p class="text-slate-500 text-sm leading-relaxed">${f.desc}</p>
                    </div>
                `).join('')}
            </div>
        </section>
    </div>
    `;
}

function renderLatest() {
    return `
    <div class="min-h-screen pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="mb-8">
            <h1 class="text-3xl md:text-4xl font-bold text-white mb-2 font-['Space_Grotesk']">Episode Terbaru</h1>
            <p class="text-slate-500">Update episode anime terbaru yang baru saja rilis</p>
        </div>
        <div id="animeListGrid" class="anime-grid">
            ${buildSkeletonGrid(12)}
        </div>
    </div>
    `;
}

function renderList() {
    return `
    <div class="min-h-screen pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="mb-8">
            <h1 class="text-3xl md:text-4xl font-bold text-white mb-2 font-['Space_Grotesk']">Daftar Anime</h1>
            <p class="text-slate-500">Jelajahi koleksi anime lengkap kami</p>
        </div>
        <div id="animeListGrid" class="anime-grid">
            ${buildSkeletonGrid(24)}
        </div>
    </div>
    `;
}

function renderSearch(query) {
    return `
    <div class="min-h-screen pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="mb-8">
            <h1 class="text-3xl md:text-4xl font-bold text-white mb-2 font-['Space_Grotesk']">Hasil Pencarian</h1>
            <p class="text-slate-500 flex items-center gap-2">
                <i data-lucide="search" class="w-4 h-4"></i>
                "${escapeHtml(query)}"
            </p>
        </div>
        <div id="searchGrid" class="anime-grid">
            ${buildSkeletonGrid(12)}
        </div>
    </div>
    `;
}

function renderDetail(anime) {
    const poster = anime.poster || CONFIG.DEFAULT_POSTER;
    const genreTags = anime.genres.map(g => `<span class="tag">${escapeHtml(g)}</span>`).join('');
    const statusClass = anime.status.toLowerCase().includes('complete') ? 'status-completed' : 'status-ongoing';
    
    return `
    <div class="min-h-screen pt-20 pb-12">
        <!-- Hero Banner -->
        <div class="relative h-[400px] md:h-[500px] overflow-hidden">
            <div class="absolute inset-0">
                <img src="${poster}" class="w-full h-full object-cover blur-xl opacity-30 scale-110" onerror="this.style.display='none'">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent"></div>
                <div class="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-transparent to-[#0a0a0f]/50"></div>
            </div>
        </div>
        
        <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-48 md:-mt-64">
            <div class="grid lg:grid-cols-[300px_1fr] gap-8">
                <!-- Poster -->
                <div class="flex-shrink-0">
                    <div class="rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-indigo-500/10">
                        <img src="${poster}" alt="${escapeHtml(anime.title)}" class="w-full aspect-[3/4] object-cover"
                            onerror="this.src='${CONFIG.DEFAULT_POSTER}'">
                    </div>
                </div>
                
                <!-- Info -->
                <div class="pt-4">
                    <div class="flex flex-wrap gap-2 mb-4">
                        <span class="status-badge ${statusClass} flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full ${anime.status.toLowerCase().includes('complete') ? 'bg-indigo-400' : 'bg-emerald-400'}"></span>
                            ${escapeHtml(anime.status)}
                        </span>
                        <span class="tag">${escapeHtml(anime.type)}</span>
                        ${anime.rating !== '-' ? `<span class="rating-badge"><i data-lucide="star" class="w-3 h-3 fill-black"></i> ${anime.rating}</span>` : ''}
                    </div>
                    
                    <h1 class="text-3xl md:text-5xl font-bold text-white mb-4 font-['Space_Grotesk'] leading-tight">${escapeHtml(anime.title)}</h1>
                    
                    <div class="flex flex-wrap gap-2 mb-6">
                        ${genreTags || '<span class="tag">Anime</span>'}
                    </div>
                    
                    <div class="glass rounded-2xl p-6 border border-white/[0.06] mb-8">
                        <h3 class="text-white font-semibold mb-3 flex items-center gap-2">
                            <i data-lucide="book-open" class="w-4 h-4 text-indigo-400"></i>
                            Sinopsis
                        </h3>
                        <p class="text-slate-400 text-sm leading-relaxed">${escapeHtml(anime.synopsis) || 'Tidak ada sinopsis tersedia.'}</p>
                    </div>
                </div>
            </div>
            
            <!-- Episodes -->
            <div class="mt-12">
                <h2 class="section-title mb-6">
                    <i data-lucide="film" class="w-6 h-6 text-indigo-400"></i>
                    Daftar Episode <span class="text-slate-500 text-base font-normal ml-2">(${anime.episodes.length} episode)</span>
                </h2>
                
                ${anime.episodes.length > 0 ? `
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar" id="episodeList">
                    ${anime.episodes.map((ep, i) => buildEpisodeRow(ep, i === 0)).join('')}
                </div>
                ` : `
                <div class="glass rounded-2xl p-12 text-center border border-white/[0.06]">
                    <i data-lucide="film" class="w-12 h-12 text-slate-600 mx-auto mb-4"></i>
                    <p class="text-slate-500">Belum ada episode tersedia</p>
                </div>
                `}
            </div>
        </div>
    </div>
    `;
}

function renderWatch(animeTitle, episodeNum, videoUrl) {
    return `
    <div class="min-h-screen pt-20 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-sm text-slate-500 mb-4">
            <button onclick="history.back()" class="hover:text-white transition flex items-center gap-1">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                Kembali
            </button>
            <span>/</span>
            <span class="text-slate-400 truncate max-w-[200px]">${escapeHtml(animeTitle)}</span>
            <span>/</span>
            <span class="text-indigo-400">Episode ${episodeNum}</span>
        </div>
        
        <div class="mb-6">
            <h1 class="text-xl md:text-2xl font-bold text-white mb-1">${escapeHtml(animeTitle)}</h1>
            <p class="text-slate-500">Episode ${episodeNum} — Subtitle Indonesia</p>
        </div>
        
        <!-- Video Player -->
        <div class="video-container aspect-video mb-6 glow-accent">
            ${videoUrl ? `
                <iframe src="${videoUrl}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture" 
                    class="w-full h-full" sandbox="allow-same-origin allow-scripts allow-presentation"></iframe>
            ` : `
                <div class="flex items-center justify-center h-full bg-[#0a0a0f]">
                    <div class="text-center">
                        <div class="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 pulse-glow">
                            <i data-lucide="play-circle" class="w-10 h-10 text-indigo-400"></i>
                        </div>
                        <p class="text-slate-500 mb-2">Memuat video player...</p>
                        <p class="text-slate-600 text-sm">Jika video tidak muncul, coba refresh halaman</p>
                    </div>
                </div>
            `}
        </div>
        
        <!-- Controls -->
        <div class="flex flex-wrap gap-3 mb-8">
            <button onclick="alert('Fitur download akan segera hadir')" class="btn-secondary flex items-center gap-2 text-sm">
                <i data-lucide="download" class="w-4 h-4"></i>
                Download
            </button>
            <button onclick="alert('Fitur laporkan akan segera hadir')" class="btn-secondary flex items-center gap-2 text-sm">
                <i data-lucide="flag" class="w-4 h-4"></i>
                Laporkan
            </button>
            <button onclick="toggleFullscreen()" class="btn-secondary flex items-center gap-2 text-sm">
                <i data-lucide="maximize" class="w-4 h-4"></i>
                Fullscreen
            </button>
        </div>
        
        <!-- Episode Navigation -->
        ${AppState.currentAnime?.episodes ? `
        <div class="glass rounded-2xl p-6 border border-white/[0.06]">
            <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
                <i data-lucide="list" class="w-4 h-4 text-indigo-400"></i>
                Episode Lainnya
            </h3>
            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                ${AppState.currentAnime.episodes.map(ep => `
                    <button onclick="playEpisode('${escapeHtml(ep.link)}', '${ep.number}')" 
                        class="text-left px-4 py-3 rounded-xl text-sm transition ${ep.number === episodeNum ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/[0.03] hover:text-white border border-transparent'}">
                        EP ${ep.number}
                    </button>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// NAVIGATION & ROUTING
// ═══════════════════════════════════════════════════════════════

function navigate(page, data = null) {
    AppState.currentPage = page;
    if (data) AppState.currentAnime = data;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    render();
}

async function openAnime(slug) {
    AppState.isLoading = true;
    navigate('loading');
    
    try {
        const anime = await fetchAnimeDetail(slug);
        AppState.currentAnime = anime;
        AppState.isLoading = false;
        navigate('detail', anime);
    } catch (err) {
        AppState.isLoading = false;
        showToast('Gagal memuat detail anime', 'error');
        navigate('home');
    }
}

async function playEpisode(link, number) {
    AppState.currentEpisode = number;
    navigate('watch');
    
    try {
        const videoUrl = await fetchEpisodeVideo(link);
        const app = $('#app');
        app.innerHTML = buildHeader() + renderWatch(AppState.currentAnime?.title || 'Anime', number, videoUrl) + buildFooter();
        lucide.createIcons();
    } catch (err) {
        const app = $('#app');
        app.innerHTML = buildHeader() + renderWatch(AppState.currentAnime?.title || 'Anime', number, null) + buildFooter();
        lucide.createIcons();
        showToast('Gagal memuat video', 'error');
    }
}

function toggleMobileMenu() {
    AppState.isMenuOpen = !AppState.isMenuOpen;
    $('#mobileMenu')?.classList.toggle('open', AppState.isMenuOpen);
    $('#mobileOverlay')?.classList.toggle('hidden', !AppState.isMenuOpen);
    document.body.style.overflow = AppState.isMenuOpen ? 'hidden' : '';
}

function focusSearch() {
    const input = $('#searchInput');
    if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function handleSearch() {
    const input = $('#searchInput') || document.querySelector('.search-input');
    const query = input?.value?.trim();
    if (!query) return;
    
    AppState.searchQuery = query;
    navigate('search');
    
    fetchSearchResults(query).then(results => {
        const grid = $('#searchGrid');
        if (grid) {
            grid.innerHTML = results.length > 0 
                ? results.map((a, i) => buildAnimeCard(a, i)).join('')
                : `<div class="col-span-full text-center py-16">
                     <i data-lucide="search-x" class="w-16 h-16 text-slate-700 mx-auto mb-4"></i>
                     <p class="text-slate-500 text-lg">Tidak ditemukan hasil untuk "${escapeHtml(query)}"</p>
                   </div>`;
            lucide.createIcons();
        }
    });
}

function toggleFullscreen() {
    const container = document.querySelector('.video-container');
    if (!container) return;
    
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        container.requestFullscreen();
    }
}

// ═══════════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════════

function render() {
    const app = $('#app');
    if (!app) return;
    
    let content = buildHeader();
    
    switch (AppState.currentPage) {
        case 'home':
            content += renderHome();
            break;
        case 'latest':
            content += renderLatest();
            break;
        case 'list':
            content += renderList();
            break;
        case 'search':
            content += renderSearch(AppState.searchQuery);
            break;
        case 'detail':
            content += AppState.currentAnime ? renderDetail(AppState.currentAnime) : renderHome();
            break;
        case 'watch':
            content += renderWatch(
                AppState.currentAnime?.title || 'Anime',
                AppState.currentEpisode || '1',
                null
            );
            break;
        case 'loading':
            content += `
            <div class="min-h-screen flex items-center justify-center pt-20">
                <div class="text-center">
                    <div class="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 spinner mx-auto mb-4"></div>
                    <p class="text-slate-500">Memuat konten...</p>
                </div>
            </div>`;
            break;
        default:
            content += renderHome();
    }
    
    content += buildFooter();
    app.innerHTML = content;
    
    // Init Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Load data after render
    loadPageData();
}

async function loadPageData() {
    switch (AppState.currentPage) {
        case 'home':
            const homeData = await fetchHomeData();
            const latestGrid = $('#latestGrid');
            const popularGrid = $('#popularGrid');
            if (latestGrid) {
                latestGrid.innerHTML = AppState.latestEpisodes.length > 0
                    ? AppState.latestEpisodes.map((a, i) => buildAnimeCard(a, i)).join('')
                    : `<div class="col-span-full text-center py-12 text-slate-500">Tidak ada data. Periksa koneksi proxy.</div>`;
            }
            if (popularGrid) {
                popularGrid.innerHTML = AppState.popularAnime.length > 0
                    ? AppState.popularAnime.map((a, i) => buildAnimeCard(a, i)).join('')
                    : `<div class="col-span-full text-center py-12 text-slate-500">Tidak ada data. Periksa koneksi proxy.</div>`;
            }
            lucide.createIcons();
            break;
            
        case 'latest':
            const latestData = await fetchAnimeList(1);
            const latestListGrid = $('#animeListGrid');
            if (latestListGrid) {
                latestListGrid.innerHTML = latestData.length > 0
                    ? latestData.map((a, i) => buildAnimeCard(a, i)).join('')
                    : `<div class="col-span-full text-center py-12 text-slate-500">Tidak ada data. Periksa koneksi proxy.</div>`;
            }
            lucide.createIcons();
            break;
            
        case 'list':
            const listData = await fetchAnimeList(1);
            const listGrid = $('#animeListGrid');
            if (listGrid) {
                listGrid.innerHTML = listData.length > 0
                    ? listData.map((a, i) => buildAnimeCard(a, i)).join('')
                    : `<div class="col-span-full text-center py-12 text-slate-500">Tidak ada data. Periksa koneksi proxy.</div>`;
            }
            lucide.createIcons();
            break;
    }
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    render();
});
