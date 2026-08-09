/**
 * Nonton Anime App - Frontend SPA
 * Modular, dynamic UI injection with hash-based routing
 */

const CONFIG = {
  API_BASE: 'https://yuki-anime-eosin.vercel.app', // Same origin for Vercel, or set your API URL
  ITEMS_PER_PAGE: 24,
  DEBOUNCE_DELAY: 300
};

// ==================== STATE MANAGEMENT ====================

const Store = {
  state: {
    currentPage: 'home',
    animeData: null,
    searchQuery: '',
    isLoading: false,
    featuredIndex: 0
  },
  
  listeners: [],
  
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },
  
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach(l => l(this.state));
  },
  
  getState() {
    return this.state;
  }
};

// ==================== API CLIENT ====================

const API = {
  async fetchHome() {
    const res = await fetch(`${CONFIG.API_BASE}/api/home`);
    if (!res.ok) throw new Error('Failed to fetch home data');
    return res.json();
  },
  
  async search(query) {
    const res = await fetch(`${CONFIG.API_BASE}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },
  
  async getDetail(slug) {
    const res = await fetch(`${CONFIG.API_BASE}/api/detail?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Failed to fetch detail');
    return res.json();
  },
  
  async getEpisode(slug) {
    const res = await fetch(`${CONFIG.API_BASE}/api/episode?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('Failed to fetch episode');
    return res.json();
  }
};

// ==================== UTILITIES ====================

const Utils = {
  debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  
  truncate(text, maxLength = 120) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },
  
  slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
};

// ==================== COMPONENT BUILDERS ====================

const Components = {
  // Skeleton loaders
  skeletonCard() {
    return `
      <div class="glass-card rounded-xl overflow-hidden">
        <div class="skeleton anime-poster w-full"></div>
        <div class="p-3 space-y-2">
          <div class="skeleton h-4 w-3/4"></div>
          <div class="skeleton h-3 w-1/2"></div>
        </div>
      </div>
    `;
  },
  
  skeletonGrid(count = 12) {
    return `<div class="anime-grid">${Array(count).fill(0).map(() => this.skeletonCard()).join('')}</div>`;
  },
  
  skeletonHero() {
    return `
      <div class="relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden mb-8">
        <div class="skeleton w-full h-full absolute inset-0"></div>
      </div>
    `;
  },
  
  // Anime Card
  animeCard(anime) {
    const statusClass = anime.status?.toLowerCase().includes('ongoing') ? 'badge-ongoing' : 'badge-completed';
    const statusText = anime.status || 'Unknown';
    const episodeText = anime.latestEpisode || anime.episode || '-';
    
    return `
      <a href="#/anime/${anime.slug}" class="anime-card glass-card rounded-xl overflow-hidden block group fade-in" data-slug="${anime.slug}">
        <div class="relative overflow-hidden">
          <img 
            src="${anime.poster || anime.thumbnail || '/api/placeholder/300/400'}" 
            alt="${Utils.escapeHtml(anime.title)}"
            class="anime-poster w-full"
            loading="lazy"
            onerror="this.src='https://via.placeholder.com/300x400/1e293b/475569?text=No+Image'"
          >
          <div class="absolute top-2 right-2">
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          <div class="absolute inset-0 bg-gradient-to-t from-dark-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
            <span class="text-sm font-medium text-white flex items-center gap-1">
              <i data-lucide="play-circle" class="w-4 h-4"></i> Lihat Detail
            </span>
          </div>
        </div>
        <div class="p-3">
          <h3 class="font-semibold text-sm text-dark-100 line-clamp-2 group-hover:text-primary-400 transition-colors" title="${Utils.escapeHtml(anime.title)}">
            ${Utils.escapeHtml(anime.title)}
          </h3>
          <div class="flex items-center justify-between mt-2 text-xs text-dark-400">
            <span class="flex items-center gap-1">
              <i data-lucide="tv" class="w-3 h-3"></i> Ep ${episodeText}
            </span>
            <span class="flex items-center gap-1">
              <i data-lucide="star" class="w-3 h-3 text-yellow-500"></i> ${anime.rating || '-'}
            </span>
          </div>
        </div>
      </a>
    `;
  },
  
  // Section Header
  sectionHeader(title, icon = 'flame') {
    return `
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-title">
          <i data-lucide="${icon}" class="w-5 h-5 text-primary-400"></i>
          ${title}
        </h2>
      </div>
    `;
  },
  
  // Anime Grid Section
  animeGridSection(title, animes, icon = 'tv') {
    if (!animes || animes.length === 0) return '';
    return `
      <section class="mb-10 fade-in">
        ${this.sectionHeader(title, icon)}
        <div class="anime-grid">
          ${animes.map(a => this.animeCard(a)).join('')}
        </div>
      </section>
    `;
  },
  
  // Hero / Featured Carousel
  heroSection(featured) {
    if (!featured || featured.length === 0) return '';
    
    const current = featured[Store.state.featuredIndex % featured.length];
    
    return `
      <section class="relative h-[400px] md:h-[520px] rounded-2xl overflow-hidden mb-10 group fade-in">
        <div class="absolute inset-0">
          <img 
            src="${current.poster || current.thumbnail}" 
            alt="${Utils.escapeHtml(current.title)}"
            class="w-full h-full object-cover"
            onerror="this.style.display='none'"
          >
          <div class="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/80 to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent"></div>
        </div>
        
        <div class="relative h-full flex flex-col justify-end p-6 md:p-10 max-w-3xl">
          <span class="badge badge-ongoing w-fit mb-3">${current.status || 'On-going'}</span>
          <h1 class="text-3xl md:text-5xl font-bold mb-3 text-gradient leading-tight">
            ${Utils.escapeHtml(current.title)}
          </h1>
          <p class="text-dark-300 text-sm md:text-base mb-4 line-clamp-2 max-w-xl">
            ${Utils.truncate(current.synopsis || current.description, 180)}
          </p>
          <div class="flex items-center gap-4 mb-6 text-sm text-dark-400">
            <span class="flex items-center gap-1"><i data-lucide="star" class="w-4 h-4 text-yellow-500"></i> ${current.rating || 'N/A'}</span>
            <span class="flex items-center gap-1"><i data-lucide="tv" class="w-4 h-4"></i> Ep ${current.latestEpisode || '-'}</span>
            <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-4 h-4"></i> ${current.year || '-'}</span>
          </div>
          <div class="flex gap-3">
            <a href="#/anime/${current.slug}" class="btn-primary px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 text-white">
              <i data-lucide="play" class="w-4 h-4"></i> Tonton Sekarang
            </a>
            <a href="#/anime/${current.slug}" class="glass px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 text-dark-200 hover:bg-dark-800 transition-colors">
              <i data-lucide="info" class="w-4 h-4"></i> Detail
            </a>
          </div>
        </div>
        
        ${featured.length > 1 ? `
          <div class="absolute bottom-6 right-6 md:right-10 flex gap-2">
            ${featured.map((_, i) => `
              <button 
                onclick="window.updateFeatured(${i})"
                class="w-2 h-2 rounded-full transition-all ${i === Store.state.featuredIndex % featured.length ? 'bg-primary-400 w-6' : 'bg-dark-600 hover:bg-dark-400'}"
              ></button>
            `).join('')}
          </div>
        ` : ''}
      </section>
    `;
  },
  
  // Navbar
  navbar() {
    return `
      <nav class="fixed top-0 left-0 right-0 z-50 glass border-b border-dark-800/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6">
          <div class="flex items-center justify-between h-16">
            <!-- Logo -->
            <a href="#/" class="flex items-center gap-2 group">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <i data-lucide="play" class="w-4 h-4 text-white"></i>
              </div>
              <span class="font-bold text-lg text-white group-hover:text-primary-400 transition-colors">YukiStream</span>
            </a>
            
            <!-- Desktop Nav -->
            <div class="hidden md:flex items-center gap-6">
              <a href="#/" class="nav-link active text-sm font-medium">Beranda</a>
              <a href="#/ongoing" class="nav-link text-sm font-medium">On-going</a>
              <a href="#/popular" class="nav-link text-sm font-medium">Populer</a>
            </div>
            
            <!-- Search -->
            <div class="hidden md:flex items-center gap-3">
              <div class="relative">
                <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400"></i>
                <input 
                  type="text" 
                  id="searchInput"
                  placeholder="Cari anime..."
                  class="search-input pl-10 pr-4 py-2 rounded-lg text-sm w-64 text-dark-100 placeholder-dark-500 outline-none"
                >
              </div>
            </div>
            
            <!-- Mobile Menu Button -->
            <button id="mobileMenuBtn" class="md:hidden p-2 text-dark-300 hover:text-white">
              <i data-lucide="menu" class="w-6 h-6"></i>
            </button>
          </div>
        </div>
        
        <!-- Mobile Search -->
        <div class="md:hidden px-4 pb-3">
          <div class="relative">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400"></i>
            <input 
              type="text" 
              id="mobileSearchInput"
              placeholder="Cari anime..."
              class="search-input pl-10 pr-4 py-2 rounded-lg text-sm w-full text-dark-100 placeholder-dark-500 outline-none"
            >
          </div>
        </div>
      </nav>
      
      <!-- Mobile Menu Overlay -->
      <div id="mobileMenuOverlay" class="fixed inset-0 bg-black/60 z-40 hidden backdrop-blur-sm"></div>
      <div id="mobileMenu" class="mobile-menu fixed top-0 left-0 bottom-0 w-72 bg-dark-900 z-50 border-r border-dark-800 p-6">
        <div class="flex items-center justify-between mb-8">
          <span class="font-bold text-lg text-white">Menu</span>
          <button id="closeMobileMenu" class="text-dark-400 hover:text-white">
            <i data-lucide="x" class="w-6 h-6"></i>
          </button>
        </div>
        <div class="flex flex-col gap-4">
          <a href="#/" class="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-800 text-dark-300 hover:text-white transition-colors">
            <i data-lucide="home" class="w-5 h-5"></i> Beranda
          </a>
          <a href="#/ongoing" class="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-800 text-dark-300 hover:text-white transition-colors">
            <i data-lucide="refresh-cw" class="w-5 h-5"></i> On-going
          </a>
          <a href="#/popular" class="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-800 text-dark-300 hover:text-white transition-colors">
            <i data-lucide="trending-up" class="w-5 h-5"></i> Populer
          </a>
        </div>
      </div>
    `;
  },
  
  // Footer
  footer() {
    return `
      <footer class="mt-16 border-t border-dark-800/50 py-8">
        <div class="max-w-7xl mx-auto px-4 text-center">
          <div class="flex items-center justify-center gap-2 mb-4">
            <div class="w-6 h-6 rounded bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <i data-lucide="play" class="w-3 h-3 text-white"></i>
            </div>
            <span class="font-bold text-white">YukiStream</span>
          </div>
          <p class="text-dark-500 text-sm">
            Streaming anime sub Indo gratis tanpa iklan. Dibuat untuk penggemar anime Indonesia.
          </p>
          <p class="text-dark-600 text-xs mt-4">
            © 2024 YukiStream. All rights reserved.
          </p>
        </div>
      </footer>
    `;
  },
  
  // Loading State
  loadingSpinner() {
    return `
      <div class="flex flex-col items-center justify-center py-20">
        <div class="spinner mb-4"></div>
        <p class="text-dark-400 text-sm">Memuat data...</p>
      </div>
    `;
  },
  
  // Error State
  errorMessage(message, retryFn = '') {
    return `
      <div class="flex flex-col items-center justify-center py-20 text-center px-4">
        <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <i data-lucide="alert-circle" class="w-8 h-8 text-red-400"></i>
        </div>
        <h3 class="text-lg font-semibold text-white mb-2">Oops, terjadi kesalahan</h3>
        <p class="text-dark-400 text-sm max-w-md mb-6">${message}</p>
        ${retryFn ? `<button onclick="${retryFn}" class="btn-primary px-6 py-2 rounded-lg text-sm text-white">Coba Lagi</button>` : ''}
      </div>
    `;
  },
  
  // Empty State
  emptyState(message = 'Tidak ada data ditemukan') {
    return `
      <div class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mb-4">
          <i data-lucide="inbox" class="w-8 h-8 text-dark-500"></i>
        </div>
        <p class="text-dark-400 text-sm">${message}</p>
      </div>
    `;
  }
};

// ==================== PAGE RENDERERS ====================

const Pages = {
  // Home Page
  async home() {
    const app = document.getElementById('app');
    app.innerHTML = Components.navbar() + `
      <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        ${Components.skeletonHero()}
        ${Components.skeletonGrid(12)}
      </main>
    ` + Components.footer();
    lucide.createIcons();
    
    try {
      const data = await API.fetchHome();
      Store.setState({ animeData: data });
      
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
          ${Components.heroSection(data.featured || data.ongoing?.slice(0, 5))}
          ${Components.animeGridSection('Sedang Tayang', data.ongoing, 'refresh-cw')}
          ${Components.animeGridSection('Episode Terbaru', data.latest, 'clock')}
          ${Components.animeGridSection('Anime Populer', data.popular, 'trending-up')}
        </main>
      ` + Components.footer();
      
      lucide.createIcons();
      initEventListeners();
      startHeroCarousel(data.featured || data.ongoing?.slice(0, 5));
      
    } catch (err) {
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
          ${Components.errorMessage(err.message, 'window.location.reload()')}
        </main>
      ` + Components.footer();
      lucide.createIcons();
    }
  },
  
  // Search Results
  async search(query) {
    const app = document.getElementById('app');
    app.innerHTML = Components.navbar() + `
      <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-white mb-2">Hasil Pencarian</h1>
          <p class="text-dark-400 text-sm">Mencari: "${Utils.escapeHtml(query)}"</p>
        </div>
        ${Components.skeletonGrid(12)}
      </main>
    ` + Components.footer();
    lucide.createIcons();
    
    try {
      const data = await API.search(query);
      
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-white mb-2">Hasil Pencarian</h1>
            <p class="text-dark-400 text-sm">Mencari: "${Utils.escapeHtml(query)}" — ${data.results?.length || 0} hasil</p>
          </div>
          ${data.results?.length > 0 
            ? Components.animeGridSection('', data.results) 
            : Components.emptyState('Tidak ada anime yang cocok dengan pencarian Anda')}
        </main>
      ` + Components.footer();
      
      lucide.createIcons();
      initEventListeners();
      
    } catch (err) {
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
          ${Components.errorMessage(err.message)}
        </main>
      ` + Components.footer();
      lucide.createIcons();
    }
  },
  
  // Anime Detail Page
  async detail(slug) {
    const app = document.getElementById('app');
    app.innerHTML = Components.navbar() + `
      <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        <div class="flex flex-col lg:flex-row gap-8">
          <div class="lg:w-1/3">
            <div class="skeleton rounded-xl aspect-[3/4] w-full max-w-sm mx-auto"></div>
          </div>
          <div class="lg:w-2/3 space-y-4">
            <div class="skeleton h-8 w-3/4"></div>
            <div class="skeleton h-4 w-1/2"></div>
            <div class="skeleton h-32 w-full"></div>
          </div>
        </div>
      </main>
    ` + Components.footer();
    lucide.createIcons();
    
    try {
      const data = await API.getDetail(slug);
      const anime = data.anime;
      
      if (!anime) throw new Error('Anime tidak ditemukan');
      
      const genres = anime.genres || [];
      const episodes = anime.episodes || [];
      
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8 fade-in">
          <!-- Breadcrumb -->
          <div class="flex items-center gap-2 text-sm text-dark-400 mb-6">
            <a href="#/" class="hover:text-white transition-colors">Beranda</a>
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
            <span class="text-dark-300 truncate max-w-[200px]">${Utils.escapeHtml(anime.title)}</span>
          </div>
          
          <div class="flex flex-col lg:flex-row gap-8">
            <!-- Poster -->
            <div class="lg:w-1/3 xl:w-1/4 shrink-0">
              <div class="glass-card rounded-xl overflow-hidden sticky top-24">
                <img 
                  src="${anime.poster || anime.thumbnail}" 
                  alt="${Utils.escapeHtml(anime.title)}"
                  class="w-full aspect-[3/4] object-cover"
                  onerror="this.src='https://via.placeholder.com/400x600/1e293b/475569?text=No+Image'"
                >
                <div class="p-4 space-y-3">
                  <a href="${episodes.length > 0 ? `#/watch/${episodes[episodes.length - 1].slug}` : '#'}" 
                     class="btn-primary w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 text-white ${episodes.length === 0 ? 'opacity-50 pointer-events-none' : ''}">
                    <i data-lucide="play" class="w-4 h-4"></i> Tonton Episode 1
                  </a>
                  <div class="grid grid-cols-2 gap-2 text-xs text-dark-400">
                    <div class="bg-dark-800/50 p-2 rounded-lg text-center">
                      <div class="text-white font-semibold">${anime.rating || '-'}</div>
                      <div>Rating</div>
                    </div>
                    <div class="bg-dark-800/50 p-2 rounded-lg text-center">
                      <div class="text-white font-semibold">${anime.status || '-'}</div>
                      <div>Status</div>
                    </div>
                    <div class="bg-dark-800/50 p-2 rounded-lg text-center">
                      <div class="text-white font-semibold">${anime.type || '-'}</div>
                      <div>Tipe</div>
                    </div>
                    <div class="bg-dark-800/50 p-2 rounded-lg text-center">
                      <div class="text-white font-semibold">${anime.duration || '-'}</div>
                      <div>Durasi</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Info -->
            <div class="lg:w-2/3 xl:w-3/4">
              <div class="mb-6">
                <h1 class="text-3xl md:text-4xl font-bold text-white mb-3">${Utils.escapeHtml(anime.title)}</h1>
                ${anime.alternativeTitle ? `<p class="text-dark-400 text-sm mb-3">${Utils.escapeHtml(anime.alternativeTitle)}</p>` : ''}
                <div class="flex flex-wrap gap-2 mb-4">
                  ${genres.map(g => `<span class="text-xs px-3 py-1 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">${Utils.escapeHtml(g)}</span>`).join('')}
                </div>
                <div class="flex items-center gap-4 text-sm text-dark-400 mb-6">
                  <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-4 h-4"></i> ${anime.year || '-'}</span>
                  <span class="flex items-center gap-1"><i data-lucide="tv" class="w-4 h-4"></i> ${anime.totalEpisodes || episodes.length || '-'} Episode</span>
                  <span class="flex items-center gap-1"><i data-lucide="clock" class="w-4 h-4"></i> ${anime.duration || '-'}</span>
                </div>
              </div>
              
              <!-- Synopsis -->
              <div class="glass-card rounded-xl p-6 mb-8">
                <h2 class="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <i data-lucide="align-left" class="w-5 h-5 text-primary-400"></i> Sinopsis
                </h2>
                <p class="text-dark-300 leading-relaxed text-sm md:text-base">
                  ${anime.synopsis || 'Tidak ada sinopsis tersedia.'}
                </p>
              </div>
              
              <!-- Episodes -->
              <div class="glass-card rounded-xl p-6">
                <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <i data-lucide="list" class="w-5 h-5 text-primary-400"></i> Daftar Episode
                </h2>
                ${episodes.length > 0 ? `
                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    ${episodes.map((ep, i) => `
                      <a href="#/watch/${ep.slug}" class="episode-item p-3 rounded-lg bg-dark-800/30 hover:bg-dark-800/60 text-sm flex items-center justify-between group">
                        <span class="text-dark-300 group-hover:text-white transition-colors">
                          <span class="text-primary-400 font-semibold">EP ${ep.number || i + 1}</span>
                          ${ep.title ? `<span class="hidden sm:inline ml-1">- ${Utils.truncate(ep.title, 20)}</span>` : ''}
                        </span>
                        <i data-lucide="play" class="w-3 h-3 text-dark-600 group-hover:text-primary-400 transition-colors"></i>
                      </a>
                    `).join('')}
                  </div>
                ` : Components.emptyState('Belum ada episode tersedia')}
              </div>
            </div>
          </div>
        </main>
      ` + Components.footer();
      
      lucide.createIcons();
      initEventListeners();
      
    } catch (err) {
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
          ${Components.errorMessage(err.message, 'window.history.back()')}
        </main>
      ` + Components.footer();
      lucide.createIcons();
    }
  },
  
  // Watch Episode Page
  async watch(slug) {
    const app = document.getElementById('app');
    app.innerHTML = Components.navbar() + `
      <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
        <div class="video-container mb-6">
          <div class="skeleton w-full h-full absolute inset-0"></div>
        </div>
        <div class="skeleton h-8 w-1/2 mb-4"></div>
        <div class="skeleton h-4 w-1/4"></div>
      </main>
    ` + Components.footer();
    lucide.createIcons();
    
    try {
      const data = await API.getEpisode(slug);
      const episode = data.episode;
      
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8 fade-in">
          <!-- Breadcrumb -->
          <div class="flex items-center gap-2 text-sm text-dark-400 mb-4">
            <a href="#/" class="hover:text-white transition-colors">Beranda</a>
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
            ${episode.animeSlug ? `<a href="#/anime/${episode.animeSlug}" class="hover:text-white transition-colors truncate max-w-[150px]">${Utils.escapeHtml(episode.animeTitle || 'Detail')}</a>` : '<span>Episode</span>'}
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
            <span class="text-dark-300">EP ${episode.number || '-'}</span>
          </div>
          
          <!-- Video Player -->
          <div class="video-container mb-6 shadow-2xl shadow-primary-500/5">
            ${episode.embedUrl ? `
              <iframe 
                src="${episode.embedUrl}" 
                allowfullscreen 
                allow="autoplay; fullscreen; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-presentation"
              ></iframe>
            ` : episode.videoUrl ? `
              <video controls poster="${episode.poster || ''}">
                <source src="${episode.videoUrl}" type="video/mp4">
                Browser Anda tidak mendukung pemutaran video.
              </video>
            ` : `
              <div class="absolute inset-0 flex items-center justify-center bg-dark-900">
                <div class="text-center">
                  <i data-lucide="video-off" class="w-12 h-12 text-dark-600 mx-auto mb-3"></i>
                  <p class="text-dark-400">Video tidak tersedia</p>
                </div>
              </div>
            `}
          </div>
          
          <!-- Episode Info -->
          <div class="flex flex-col lg:flex-row gap-6">
            <div class="flex-1">
              <h1 class="text-xl md:text-2xl font-bold text-white mb-2">
                ${Utils.escapeHtml(episode.animeTitle || 'Anime')} 
                <span class="text-primary-400">- Episode ${episode.number || '-'}</span>
              </h1>
              ${episode.title ? `<p class="text-dark-400 text-sm mb-4">${Utils.escapeHtml(episode.title)}</p>` : ''}
              
              <!-- Navigation -->
              <div class="flex gap-3 mt-6">
                ${episode.prevSlug ? `
                  <a href="#/watch/${episode.prevSlug}" class="glass px-4 py-2 rounded-lg text-sm flex items-center gap-2 text-dark-200 hover:bg-dark-800 transition-colors">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i> Prev
                  </a>
                ` : ''}
                <a href="${episode.animeSlug ? `#/anime/${episode.animeSlug}` : '#/'}" class="glass px-4 py-2 rounded-lg text-sm flex items-center gap-2 text-dark-200 hover:bg-dark-800 transition-colors">
                  <i data-lucide="list" class="w-4 h-4"></i> Semua Episode
                </a>
                ${episode.nextSlug ? `
                  <a href="#/watch/${episode.nextSlug}" class="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 text-white">
                    Next <i data-lucide="chevron-right" class="w-4 h-4"></i>
                  </a>
                ` : ''}
              </div>
            </div>
            
            <!-- Episode List Sidebar -->
            ${episode.episodes?.length > 0 ? `
              <div class="lg:w-80 shrink-0">
                <div class="glass-card rounded-xl p-4 max-h-[500px] overflow-y-auto">
                  <h3 class="font-semibold text-white mb-3 text-sm">Daftar Episode</h3>
                  <div class="space-y-1">
                    ${episode.episodes.map(ep => `
                      <a href="#/watch/${ep.slug}" 
                         class="episode-item p-2.5 rounded-lg text-sm flex items-center justify-between ${ep.slug === slug ? 'active' : 'bg-dark-800/30 hover:bg-dark-800/60'}">
                        <span class="${ep.slug === slug ? 'text-primary-400' : 'text-dark-300'}">
                          EP ${ep.number || '-'} ${ep.title ? `- ${Utils.truncate(ep.title, 25)}` : ''}
                        </span>
                        ${ep.slug === slug ? '<i data-lucide="play" class="w-3 h-3 text-primary-400"></i>' : ''}
                      </a>
                    `).join('')}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </main>
      ` + Components.footer();
      
      lucide.createIcons();
      initEventListeners();
      
    } catch (err) {
      app.innerHTML = Components.navbar() + `
        <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8">
          ${Components.errorMessage(err.message)}
        </main>
      ` + Components.footer();
      lucide.createIcons();
    }
  }
};

// ==================== EVENT LISTENERS ====================

function initEventListeners() {
  // Search inputs
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  
  const handleSearch = (query) => {
    if (query.trim().length > 0) {
      window.location.hash = `#/search/${encodeURIComponent(query.trim())}`;
    }
  };
  
  if (searchInput) {
    searchInput.addEventListener('input', Utils.debounce((e) => {
      if (e.target.value.trim().length > 2) handleSearch(e.target.value);
    }, CONFIG.DEBOUNCE_DELAY));
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch(e.target.value);
    });
  }
  
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', Utils.debounce((e) => {
      if (e.target.value.trim().length > 2) handleSearch(e.target.value);
    }, CONFIG.DEBOUNCE_DELAY));
    mobileSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch(e.target.value);
    });
  }
  
  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeMobileMenu = document.getElementById('closeMobileMenu');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
  
  function openMobileMenu() {
    mobileMenu?.classList.add('open');
    mobileMenuOverlay?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  
  function closeMobileMenuFn() {
    mobileMenu?.classList.remove('open');
    mobileMenuOverlay?.classList.add('hidden');
    document.body.style.overflow = '';
  }
  
  mobileMenuBtn?.addEventListener('click', openMobileMenu);
  closeMobileMenu?.addEventListener('click', closeMobileMenuFn);
  mobileMenuOverlay?.addEventListener('click', closeMobileMenuFn);
}

// ==================== HERO CAROUSEL ====================

let carouselInterval;

function startHeroCarousel(featured) {
  if (!featured || featured.length <= 1) return;
  
  clearInterval(carouselInterval);
  carouselInterval = setInterval(() => {
    Store.setState({ featuredIndex: Store.state.featuredIndex + 1 });
    // Re-render just the hero section would be ideal, but for simplicity we rely on hash navigation
    // In a real app, we'd use a more granular update
  }, 6000);
}

window.updateFeatured = (index) => {
  Store.setState({ featuredIndex: index });
  // Trigger re-render of current page
  Router.handle();
};

// ==================== ROUTER ====================

const Router = {
  routes: {
    '': () => Pages.home(),
    'home': () => Pages.home(),
    'search': (params) => Pages.search(decodeURIComponent(params[0] || '')),
    'anime': (params) => Pages.detail(params[0]),
    'watch': (params) => Pages.watch(params[0]),
    'ongoing': () => Pages.home(), // Filtered view - simplified to home for now
    'popular': () => Pages.home()  // Filtered view - simplified to home for now
  },
  
  parse() {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    const parts = hash.split('/').filter(Boolean);
    const route = parts[0] || '';
    const params = parts.slice(1);
    return { route, params };
  },
  
  handle() {
    const { route, params } = this.parse();
    const handler = this.routes[route] || this.routes[''];
    
    // Update active nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#/${route}`) {
        link.classList.add('active');
      }
    });
    
    handler(params);
  },
  
  init() {
    window.addEventListener('hashchange', () => this.handle());
    window.addEventListener('load', () => this.handle());
  }
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  Router.init();
});
