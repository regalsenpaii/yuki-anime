/**
 * YUKI ANIME STREAM - Frontend SPA
 * Full-featured anime streaming web application
 */

// ===== CONFIG =====
const CONFIG = {
  API_BASE: window.location.origin.includes('localhost') 
    ? 'http://localhost:3000/api' 
    : '/api',
  ITEMS_PER_PAGE: 24,
  DEBOUNCE_DELAY: 400,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// ===== STATE =====
const state = {
  currentRoute: 'home',
  routeParams: {},
  cache: new Map(),
  genres: [],
  isLoading: false,
  searchQuery: '',
  currentPage: 1,
  mobileMenuOpen: false,
  heroIndex: 0,
  heroInterval: null,
};

// ===== UTILITIES =====
function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function formatNumber(num) {
  if (!num) return 'N/A';
  return num.toFixed(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getCached(key) {
  const cached = state.cache.get(key);
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
    return cached.data;
  }
  state.cache.delete(key);
  return null;
}

function setCached(key, data) {
  state.cache.set(key, { data, timestamp: Date.now() });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 z-50 px-6 py-3 rounded-xl glass text-sm font-medium transform transition-all duration-300 translate-y-10 opacity-0 ${
    type === 'error' ? 'border-red-500/30 text-red-400' : 
    type === 'success' ? 'border-green-500/30 text-green-400' : 
    'border-accent-500/30 text-accent-400'
  }`;
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i data-lucide="${type === 'error' ? 'alert-circle' : type === 'success' ? 'check-circle' : 'info'}" class="w-4 h-4"></i>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-10', 'opacity-0');
  });
  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
  lucide.createIcons();
}

// ===== API SERVICE =====
const API = {
  async request(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${CONFIG.API_BASE}/${endpoint}${queryString ? '?' + queryString : ''}`;

    const cached = getCached(url);
    if (cached) return cached;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setCached(url, data);
        return data;
      }
      throw new Error(data.message || 'API request failed');
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  home() { return this.request('home'); },
  search(query, page = 1) { return this.request('search', { q: query, page }); },
  detail(slug) { return this.request('detail', { id: slug }); },
  episode(url) { return this.request('episode', { url }); },
  genreList() { return this.request('genre-list'); },
  genre(slug, page = 1) { return this.request('genre', { id: slug, page }); },
};

// ===== COMPONENT BUILDERS =====

function SkeletonCard() {
  return `
    <div class="anime-card rounded-xl overflow-hidden bg-dark-800 border border-dark-600/50">
      <div class="poster-aspect skeleton"></div>
      <div class="p-3 space-y-2">
        <div class="h-4 skeleton w-3/4"></div>
        <div class="h-3 skeleton w-1/2"></div>
      </div>
    </div>
  `;
}

function SkeletonGrid(count = 10) {
  return Array(count).fill(0).map((_, i) => 
    `<div class="fade-in-up" style="animation-delay: ${i * 0.05}s">${SkeletonCard()}</div>`
  ).join('');
}

function SkeletonHero() {
  return `
    <div class="relative rounded-2xl overflow-hidden banner-aspect skeleton">
      <div class="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 md:p-10 space-y-4">
        <div class="h-8 skeleton w-2/3 max-w-md rounded-lg"></div>
        <div class="h-4 skeleton w-1/2 max-w-sm rounded-lg"></div>
        <div class="h-10 skeleton w-32 rounded-lg"></div>
      </div>
    </div>
  `;
}

function AnimeCard(anime, index = 0) {
  const statusClass = anime.status === 'Ongoing' ? 'badge-ongoing' : 
                      anime.status === 'Completed' ? 'badge-completed' : 
                      'badge-upcoming';

  return `
    <a href="#/anime/${anime.linkId}" 
       class="anime-card group block rounded-xl overflow-hidden bg-dark-800 border border-dark-600/30 hover:border-accent-500/30 fade-in-up stagger-${Math.min(index + 1, 8)}"
       data-link-id="${anime.linkId}">
      <div class="relative poster-aspect overflow-hidden">
        <img 
          src="${anime.image || 'https://via.placeholder.com/300x400/1a1a2e/7c3aed?text=No+Image'}" 
          alt="${escapeHtml(anime.title)}" 
          class="card-image w-full h-full object-cover"
          loading="lazy"
          onerror="this.src='https://via.placeholder.com/300x400/1a1a2e/7c3aed?text=No+Image'"
        >
        <div class="card-overlay absolute inset-0 bg-gradient-to-t from-dark-900/90 via-dark-900/20 to-transparent flex items-end justify-center pb-4">
          <div class="flex items-center gap-2 text-white font-medium text-sm">
            <i data-lucide="play-circle" class="w-5 h-5"></i>
            <span>Tonton</span>
          </div>
        </div>
        ${anime.episode ? `
          <div class="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold bg-accent-500/90 text-white backdrop-blur-sm">
            EP ${anime.episode}
          </div>
        ` : ''}
        <div class="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold ${statusClass} text-white backdrop-blur-sm">
          ${anime.status || 'Ongoing'}
        </div>
      </div>
      <div class="p-3">
        <h3 class="text-sm font-semibold text-gray-100 line-clamp-2 group-hover:text-accent-400 transition-colors">
          ${escapeHtml(anime.title)}
        </h3>
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs text-gray-500">${anime.type || 'TV'}</span>
          ${anime.rating ? `
            <div class="flex items-center gap-1">
              <i data-lucide="star" class="w-3 h-3 star-filled fill-current"></i>
              <span class="text-xs text-gray-400">${formatNumber(anime.rating)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    </a>
  `;
}

function AnimeGrid(animeList, title, icon = 'tv', showViewAll = false, link = '') {
  if (!animeList || animeList.length === 0) {
    return `
      <div class="mb-10">
        <div class="flex items-center gap-3 mb-6">
          <div class="p-2 rounded-lg bg-accent-500/10">
            <i data-lucide="${icon}" class="w-5 h-5 text-accent-400"></i>
          </div>
          <h2 class="text-xl font-bold text-gray-100">${title}</h2>
        </div>
        <div class="text-center py-12 text-gray-500">
          <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
          <p>Tidak ada anime ditemukan</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="mb-10">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-accent-500/10">
            <i data-lucide="${icon}" class="w-5 h-5 text-accent-400"></i>
          </div>
          <h2 class="text-xl font-bold text-gray-100">${title}</h2>
        </div>
        ${showViewAll && link ? `
          <a href="${link}" class="text-sm text-accent-400 hover:text-accent-300 flex items-center gap-1 transition-colors">
            Lihat Semua
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </a>
        ` : ''}
      </div>
      <div class="anime-grid grid gap-4">
        ${animeList.map((anime, i) => AnimeCard(anime, i)).join('')}
      </div>
    </div>
  `;
}

function HeroCarousel(featured) {
  if (!featured || featured.length === 0) return '';

  const current = featured[state.heroIndex] || featured[0];

  return `
    <div class="relative mb-10 rounded-2xl overflow-hidden hero-gradient">
      <div class="relative banner-aspect md:aspect-[21/9]">
        <img 
          src="${current.image || 'https://via.placeholder.com/1200x500/1a1a2e/7c3aed?text=Featured'}" 
          alt="${escapeHtml(current.title)}" 
          class="w-full h-full object-cover"
          onerror="this.src='https://via.placeholder.com/1200x500/1a1a2e/7c3aed?text=Featured'"
        >
        <div class="absolute inset-0 bg-gradient-to-r from-dark-900 via-dark-900/70 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent"></div>

        <div class="absolute bottom-0 left-0 right-0 p-6 md:p-10 lg:p-12">
          <div class="max-w-2xl">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/20 border border-accent-500/30 text-accent-400 text-xs font-semibold mb-4">
              <i data-lucide="flame" class="w-3 h-3"></i>
              <span>Featured</span>
            </div>
            <h1 class="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
              ${escapeHtml(current.title)}
            </h1>
            <p class="text-gray-400 text-sm md:text-base mb-6 line-clamp-2 max-w-lg">
              ${escapeHtml(current.synopsis || 'Streaming anime subtitle Indonesia terbaik tanpa iklan.')}
            </p>
            <a href="#/anime/${current.linkId}" 
               class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-semibold transition-all hover:scale-105 glow-accent">
              <i data-lucide="play" class="w-5 h-5"></i>
              <span>Tonton Sekarang</span>
            </a>
          </div>
        </div>
      </div>

      ${featured.length > 1 ? `
        <div class="absolute bottom-4 right-4 md:bottom-8 md:right-10 flex items-center gap-2">
          ${featured.map((_, i) => `
            <button 
              onclick="window.setHeroIndex(${i})"
              class="w-2 h-2 md:w-3 md:h-3 rounded-full transition-all ${i === state.heroIndex ? 'bg-accent-500 w-6 md:w-8' : 'bg-white/30 hover:bg-white/50'}"
              aria-label="Slide ${i + 1}"
            ></button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function Navbar() {
  return `
    <nav class="navbar fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/5">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <a href="#/" class="flex items-center gap-2 group">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <i data-lucide="tv" class="w-5 h-5 text-white"></i>
            </div>
            <span class="text-lg font-bold gradient-text hidden sm:block">YUKI<span class="text-white">ANIME</span></span>
          </a>

          <!-- Desktop Nav -->
          <div class="hidden md:flex items-center gap-1">
            <a href="#/" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all ${state.currentRoute === 'home' ? 'text-white bg-white/10' : ''}">
              Beranda
            </a>
            <a href="#/genre" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all ${state.currentRoute === 'genre' ? 'text-white bg-white/10' : ''}">
              Genre
            </a>
            <a href="#/ongoing" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all ${state.currentRoute === 'ongoing' ? 'text-white bg-white/10' : ''}">
              On-going
            </a>
          </div>

          <!-- Search & Mobile Menu -->
          <div class="flex items-center gap-3">
            <!-- Search Bar -->
            <div class="relative hidden sm:block">
              <input 
                type="text" 
                id="searchInput"
                placeholder="Cari anime..." 
                value="${state.searchQuery}"
                class="search-input w-48 lg:w-64 pl-10 pr-4 py-2 rounded-xl bg-dark-700/80 border border-dark-600/50 text-sm text-gray-100 placeholder-gray-500 focus:border-accent-500/50 focus:bg-dark-700 transition-all"
              >
              <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"></i>
            </div>

            <!-- Mobile Search Button -->
            <button id="mobileSearchBtn" class="sm:hidden p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
              <i data-lucide="search" class="w-5 h-5"></i>
            </button>

            <!-- Mobile Menu Button -->
            <button id="mobileMenuBtn" class="md:hidden p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
              <i data-lucide="menu" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <!-- Mobile Search Bar -->
        <div id="mobileSearchBar" class="hidden sm:hidden pb-3">
          <div class="relative">
            <input 
              type="text" 
              id="mobileSearchInput"
              placeholder="Cari anime..." 
              value="${state.searchQuery}"
              class="search-input w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-700/80 border border-dark-600/50 text-sm text-gray-100 placeholder-gray-500 focus:border-accent-500/50 focus:bg-dark-700 transition-all"
            >
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"></i>
          </div>
        </div>
      </div>
    </nav>

    <!-- Mobile Menu -->
    <div id="menuBackdrop" class="menu-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onclick="window.toggleMobileMenu()"></div>
    <div id="mobileMenu" class="mobile-menu fixed top-0 left-0 bottom-0 w-72 z-50 bg-dark-800 border-r border-dark-600/50 md:hidden">
      <div class="p-4 border-b border-dark-600/50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
            <i data-lucide="tv" class="w-4 h-4 text-white"></i>
          </div>
          <span class="font-bold gradient-text">YUKI<span class="text-white">ANIME</span></span>
        </div>
        <button onclick="window.toggleMobileMenu()" class="p-2 rounded-lg hover:bg-white/5 text-gray-400">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="p-4 space-y-1">
        <a href="#/" onclick="window.toggleMobileMenu()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all ${state.currentRoute === 'home' ? 'bg-white/10 text-white' : ''}">
          <i data-lucide="home" class="w-5 h-5"></i>
          <span class="font-medium">Beranda</span>
        </a>
        <a href="#/genre" onclick="window.toggleMobileMenu()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all ${state.currentRoute === 'genre' ? 'bg-white/10 text-white' : ''}">
          <i data-lucide="tags" class="w-5 h-5"></i>
          <span class="font-medium">Genre</span>
        </a>
        <a href="#/ongoing" onclick="window.toggleMobileMenu()" class="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all ${state.currentRoute === 'ongoing' ? 'bg-white/10 text-white' : ''}">
          <i data-lucide="play-circle" class="w-5 h-5"></i>
          <span class="font-medium">On-going</span>
        </a>
      </div>
    </div>
  `;
}

function Footer() {
  return `
    <footer class="mt-16 border-t border-dark-600/30 bg-dark-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div class="flex items-center gap-2 mb-4">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
                <i data-lucide="tv" class="w-4 h-4 text-white"></i>
              </div>
              <span class="font-bold gradient-text">YUKI<span class="text-white">ANIME</span></span>
            </div>
            <p class="text-sm text-gray-500 leading-relaxed">
              Platform streaming anime subtitle Indonesia terbaik. Nonton anime favoritmu tanpa iklan mengganggu dan pop-up.
            </p>
          </div>
          <div>
            <h3 class="font-semibold text-gray-200 mb-4">Navigasi</h3>
            <div class="space-y-2">
              <a href="#/" class="block text-sm text-gray-500 hover:text-accent-400 transition-colors">Beranda</a>
              <a href="#/genre" class="block text-sm text-gray-500 hover:text-accent-400 transition-colors">Genre</a>
              <a href="#/ongoing" class="block text-sm text-gray-500 hover:text-accent-400 transition-colors">On-going</a>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-gray-200 mb-4">Tentang</h3>
            <p class="text-sm text-gray-500 leading-relaxed">
              Semua konten diambil dari Samehadaku. Aplikasi ini dibuat untuk tujuan edukasi dan pengembangan.
            </p>
          </div>
        </div>
        <div class="mt-8 pt-6 border-t border-dark-600/30 text-center">
          <p class="text-xs text-gray-600">
            &copy; 2026 Yuki Anime Stream. Dibuat dengan <i data-lucide="heart" class="w-3 h-3 inline text-red-500 fill-current"></i> untuk para wibu.
          </p>
        </div>
      </div>
    </footer>
  `;
}

function LoadingSpinner(size = 'w-8 h-8') {
  return `
    <div class="flex items-center justify-center py-12">
      <div class="spinner ${size}"></div>
    </div>
  `;
}


// ===== PAGE RENDERERS =====

async function renderHome() {
  state.currentRoute = 'home';
  state.routeParams = {};

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div id="heroSection">${SkeletonHero()}</div>
      <div id="latestSection">${SkeletonGrid(8)}</div>
      <div id="ongoingSection">${SkeletonGrid(6)}</div>
      <div id="popularSection">${SkeletonGrid(6)}</div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();

  try {
    const { data } = await API.home();

    // Render Hero
    $('#heroSection').innerHTML = HeroCarousel(data.featured);
    startHeroCarousel(data.featured.length);

    // Render Latest
    $('#latestSection').innerHTML = AnimeGrid(data.latest, 'Rilisan Terbaru', 'clock', true, '#/latest');

    // Render Ongoing
    $('#ongoingSection').innerHTML = AnimeGrid(data.ongoing, 'Anime On-going', 'play-circle', true, '#/ongoing');

    // Render Popular
    $('#popularSection').innerHTML = AnimeGrid(data.popular, 'Populer & Trending', 'trending-up', false);

    // Store genres
    if (data.genres && data.genres.length > 0) {
      state.genres = data.genres;
    }

    lucide.createIcons();
    attachEventListeners();
  } catch (error) {
    showToast('Gagal memuat data beranda', 'error');
    console.error(error);
  }
}

async function renderSearch(query) {
  state.currentRoute = 'search';
  state.routeParams = { query };
  state.searchQuery = query;

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 rounded-lg bg-accent-500/10">
            <i data-lucide="search" class="w-5 h-5 text-accent-400"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-100">Hasil Pencarian</h1>
        </div>
        <p class="text-gray-500 text-sm ml-12">Menampilkan hasil untuk "<span class="text-accent-400 font-medium">${escapeHtml(query)}</span>"</p>
      </div>
      <div id="searchResults">${SkeletonGrid(12)}</div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();

  try {
    const { data } = await API.search(query);

    if (data.results.length === 0) {
      $('#searchResults').innerHTML = `
        <div class="text-center py-16">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
            <i data-lucide="search-x" class="w-10 h-10 text-gray-600"></i>
          </div>
          <h3 class="text-lg font-semibold text-gray-400 mb-2">Tidak ditemukan</h3>
          <p class="text-gray-600 text-sm">Coba kata kunci lain atau periksa ejaanmu.</p>
        </div>
      `;
    } else {
      $('#searchResults').innerHTML = AnimeGrid(data.results, `${data.results.length} Hasil`, 'search');
    }

    lucide.createIcons();
    attachEventListeners();
  } catch (error) {
    showToast('Gagal melakukan pencarian', 'error');
    console.error(error);
  }
}

async function renderAnimeDetail(slug) {
  state.currentRoute = 'detail';
  state.routeParams = { slug };

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div id="detailContent">
        <div class="flex flex-col lg:flex-row gap-8">
          <!-- Skeleton Poster -->
          <div class="lg:w-80 flex-shrink-0">
            <div class="poster-aspect rounded-2xl skeleton"></div>
          </div>
          <!-- Skeleton Info -->
          <div class="flex-1 space-y-4">
            <div class="h-8 skeleton w-3/4 rounded-lg"></div>
            <div class="h-4 skeleton w-1/2 rounded-lg"></div>
            <div class="h-4 skeleton w-full rounded-lg"></div>
            <div class="h-4 skeleton w-full rounded-lg"></div>
            <div class="h-4 skeleton w-2/3 rounded-lg"></div>
            <div class="flex gap-2 mt-4">
              <div class="h-8 skeleton w-24 rounded-lg"></div>
              <div class="h-8 skeleton w-24 rounded-lg"></div>
              <div class="h-8 skeleton w-24 rounded-lg"></div>
            </div>
          </div>
        </div>
        <div class="mt-8">
          <div class="h-6 skeleton w-48 rounded-lg mb-4"></div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            ${Array(12).fill(0).map(() => `<div class="h-12 skeleton rounded-lg"></div>`).join('')}
          </div>
        </div>
      </div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();

  try {
    const { data } = await API.detail(slug);

    const statusClass = data.status === 'Ongoing' ? 'badge-ongoing' : 
                        data.status === 'Completed' ? 'badge-completed' : 
                        'badge-upcoming';

    $('#detailContent').innerHTML = `
      <div class="fade-in">
        <!-- Anime Info Header -->
        <div class="flex flex-col lg:flex-row gap-8 mb-10">
          <!-- Poster -->
          <div class="lg:w-80 flex-shrink-0">
            <div class="relative rounded-2xl overflow-hidden border border-dark-600/30 shadow-2xl">
              <img 
                src="${data.image || 'https://via.placeholder.com/300x400/1a1a2e/7c3aed?text=No+Image'}" 
                alt="${escapeHtml(data.title)}" 
                class="w-full poster-aspect object-cover"
                onerror="this.src='https://via.placeholder.com/300x400/1a1a2e/7c3aed?text=No+Image'"
              >
              <div class="absolute top-3 left-3">
                <span class="px-3 py-1 rounded-lg text-xs font-bold ${statusClass} text-white backdrop-blur-sm">
                  ${data.status || 'Ongoing'}
                </span>
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1">
            <h1 class="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
              ${escapeHtml(data.title)}
            </h1>

            <div class="flex flex-wrap items-center gap-3 mb-6">
              ${data.rating ? `
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-current"></i>
                  <span class="text-sm font-semibold text-yellow-400">${formatNumber(data.rating)}</span>
                </div>
              ` : ''}
              <div class="px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600/50 text-sm text-gray-400">
                ${data.type || 'TV'}
              </div>
              ${data.duration ? `
                <div class="px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600/50 text-sm text-gray-400 flex items-center gap-1.5">
                  <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                  <span>${data.duration}</span>
                </div>
              ` : ''}
              ${data.aired ? `
                <div class="px-3 py-1.5 rounded-lg bg-dark-700 border border-dark-600/50 text-sm text-gray-400 flex items-center gap-1.5">
                  <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                  <span>${data.aired}</span>
                </div>
              ` : ''}
            </div>

            <!-- Genres -->
            ${data.genres && data.genres.length > 0 ? `
              <div class="flex flex-wrap gap-2 mb-6">
                ${data.genres.map(genre => `
                  <a href="#/genre/${genre.id}" class="genre-badge px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-500/10 border border-accent-500/20 text-accent-400 hover:bg-accent-500/20 transition-all">
                    ${escapeHtml(genre.name)}
                  </a>
                `).join('')}
              </div>
            ` : ''}

            <!-- Synopsis -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                <i data-lucide="book-open" class="w-4 h-4 text-accent-400"></i>
                Sinopsis
              </h3>
              <p class="text-sm text-gray-400 leading-relaxed">
                ${escapeHtml(data.synopsis) || 'Sinopsis tidak tersedia.'}
              </p>
            </div>

            <!-- Meta Info -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              ${data.totalEpisodes ? `
                <div class="p-3 rounded-xl bg-dark-800 border border-dark-600/30">
                  <div class="text-xs text-gray-500 mb-1">Total Episode</div>
                  <div class="text-sm font-semibold text-gray-200">${data.totalEpisodes}</div>
                </div>
              ` : ''}
              ${data.studios && data.studios.length > 0 ? `
                <div class="p-3 rounded-xl bg-dark-800 border border-dark-600/30">
                  <div class="text-xs text-gray-500 mb-1">Studio</div>
                  <div class="text-sm font-semibold text-gray-200">${escapeHtml(data.studios.join(', '))}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Episode List -->
        <div class="mb-10">
          <div class="flex items-center gap-3 mb-6">
            <div class="p-2 rounded-lg bg-accent-500/10">
              <i data-lucide="list" class="w-5 h-5 text-accent-400"></i>
            </div>
            <h2 class="text-xl font-bold text-gray-100">Daftar Episode</h2>
            <span class="text-sm text-gray-500">(${data.episodes?.length || 0} episode)</span>
          </div>

          ${data.episodes && data.episodes.length > 0 ? `
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              ${data.episodes.map((ep, i) => `
                <a href="#/watch/${encodeURIComponent(ep.link)}" 
                   class="episode-item p-3 rounded-xl bg-dark-800 border border-dark-600/30 hover:border-accent-500/30 transition-all fade-in-up stagger-${Math.min(i + 1, 8)}">
                  <div class="flex items-center gap-2 mb-1">
                    <div class="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center flex-shrink-0">
                      <i data-lucide="play" class="w-4 h-4 text-accent-400"></i>
                    </div>
                    <span class="text-sm font-bold text-gray-200">EP ${ep.number}</span>
                  </div>
                  ${ep.date ? `<div class="text-xs text-gray-600 ml-10">${ep.date}</div>` : ''}
                </a>
              `).join('')}
            </div>
          ` : `
            <div class="text-center py-12 bg-dark-800/50 rounded-2xl border border-dark-600/30">
              <i data-lucide="film" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
              <p class="text-gray-500">Belum ada episode tersedia</p>
            </div>
          `}
        </div>

        <!-- Related Anime -->
        ${data.relatedAnime && data.relatedAnime.length > 0 ? `
          <div>
            ${AnimeGrid(data.relatedAnime, 'Anime Terkait', 'link')}
          </div>
        ` : ''}
      </div>
    `;

    lucide.createIcons();
    attachEventListeners();
  } catch (error) {
    showToast('Gagal memuat detail anime', 'error');
    console.error(error);
    $('#detailContent').innerHTML = `
      <div class="text-center py-16">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <i data-lucide="alert-triangle" class="w-10 h-10 text-red-500"></i>
        </div>
        <h3 class="text-lg font-semibold text-gray-400 mb-2">Gagal Memuat Data</h3>
        <p class="text-gray-600 text-sm mb-4">${escapeHtml(error.message)}</p>
        <button onclick="window.router.navigate('home')" class="px-4 py-2 rounded-lg bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 transition-colors">
          Kembali ke Beranda
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

async function renderEpisode(url) {
  state.currentRoute = 'episode';
  state.routeParams = { url };

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div id="episodeContent">
        <div class="mb-6">
          <div class="h-6 skeleton w-64 rounded-lg mb-4"></div>
          <div class="video-container skeleton"></div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          ${Array(4).fill(0).map(() => `<div class="h-10 skeleton rounded-lg"></div>`).join('')}
        </div>
      </div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();

  try {
    const { data } = await API.episode(url);

    // Default to first server
    const defaultServer = data.servers && data.servers.length > 0 ? data.servers[0] : null;
    const defaultLink = defaultServer ? defaultServer.links[0] : null;

    $('#episodeContent').innerHTML = `
      <div class="fade-in">
        <!-- Title -->
        <div class="mb-6">
          <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <a href="#/anime/${data.animeSlug}" class="hover:text-accent-400 transition-colors">${escapeHtml(data.title.replace(/Episode\s*\d+/i, '').trim())}</a>
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
            <span class="text-accent-400 font-medium">Episode ${data.episodeNumber || '?'}</span>
          </div>
          <h1 class="text-xl md:text-2xl font-bold text-white">
            ${escapeHtml(data.title)}
          </h1>
        </div>

        <!-- Video Player -->
        <div class="mb-6">
          <div id="videoPlayerContainer" class="video-container">
            ${defaultLink ? `
              <iframe 
                id="videoFrame"
                src="${defaultLink.url}" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
              ></iframe>
            ` : `
              <div class="absolute inset-0 flex items-center justify-center bg-dark-800">
                <div class="text-center">
                  <i data-lucide="video-off" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
                  <p class="text-gray-500">Video tidak tersedia</p>
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- Server Selection -->
        ${data.servers && data.servers.length > 0 ? `
          <div class="mb-8">
            <h3 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <i data-lucide="server" class="w-4 h-4 text-accent-400"></i>
              Pilih Server
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              ${data.servers.map((server, sIdx) => `
                <div class="space-y-2">
                  ${server.links.map((link, lIdx) => `
                    <button 
                      onclick="window.changeServer('${encodeURIComponent(link.url)}', '${escapeHtml(server.name)}', ${sIdx}, ${lIdx})"
                      class="server-btn w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-600/50 text-sm font-medium text-gray-300 hover:border-accent-500/50 hover:text-white transition-all text-left flex items-center justify-between ${sIdx === 0 && lIdx === 0 ? 'active' : ''}"
                      data-server="${sIdx}-${lIdx}"
                    >
                      <span class="truncate">${escapeHtml(server.name)}</span>
                      <span class="text-xs text-gray-600 ml-2 flex-shrink-0">${link.quality}</span>
                    </button>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Episode Navigation -->
        <div class="flex items-center justify-between mb-8 p-4 rounded-xl bg-dark-800 border border-dark-600/30">
          ${data.prevEpisode ? `
            <a href="#/watch/${encodeURIComponent(data.prevEpisode.link)}" 
               class="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white transition-all text-sm font-medium">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
              <span class="hidden sm:inline">EP Sebelumnya</span>
              <span class="sm:hidden">Prev</span>
            </a>
          ` : `<div></div>`}

          <div class="text-center">
            <span class="text-sm text-gray-500">Episode ${data.episodeNumber || '?'}</span>
          </div>

          ${data.nextEpisode ? `
            <a href="#/watch/${encodeURIComponent(data.nextEpisode.link)}" 
               class="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white transition-all text-sm font-medium">
              <span class="hidden sm:inline">EP Selanjutnya</span>
              <span class="sm:hidden">Next</span>
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </a>
          ` : `<div></div>`}
        </div>

        <!-- Episode List -->
        ${data.episodeList && data.episodeList.length > 0 ? `
          <div>
            <h3 class="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <i data-lucide="list-video" class="w-4 h-4 text-accent-400"></i>
              Semua Episode
            </h3>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              ${data.episodeList.map(ep => `
                <a href="#/watch/${encodeURIComponent(ep.link)}" 
                   class="episode-item p-2.5 rounded-lg bg-dark-800 border border-dark-600/30 text-center text-sm font-medium transition-all ${ep.isCurrent ? 'active text-accent-400 border-accent-500/50' : 'text-gray-400 hover:text-white hover:border-accent-500/30'}">
                  EP ${ep.number}
                </a>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    lucide.createIcons();
    attachEventListeners();
  } catch (error) {
    showToast('Gagal memuat episode', 'error');
    console.error(error);
    $('#episodeContent').innerHTML = `
      <div class="text-center py-16">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <i data-lucide="alert-triangle" class="w-10 h-10 text-red-500"></i>
        </div>
        <h3 class="text-lg font-semibold text-gray-400 mb-2">Gagal Memuat Episode</h3>
        <p class="text-gray-600 text-sm mb-4">${escapeHtml(error.message)}</p>
        <button onclick="window.history.back()" class="px-4 py-2 rounded-lg bg-accent-500 text-white text-sm font-medium hover:bg-accent-600 transition-colors">
          Kembali
        </button>
      </div>
    `;
    lucide.createIcons();
  }
}

async function renderGenreList() {
  state.currentRoute = 'genre';
  state.routeParams = {};

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 rounded-lg bg-accent-500/10">
            <i data-lucide="tags" class="w-5 h-5 text-accent-400"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-100">Daftar Genre</h1>
        </div>
        <p class="text-gray-500 text-sm ml-12">Pilih genre favoritmu untuk menemukan anime yang cocok.</p>
      </div>
      <div id="genreList">${LoadingSpinner('w-10 h-10')}</div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();

  try {
    const { data } = await API.genreList();

    if (data.genres.length === 0) {
      $('#genreList').innerHTML = `
        <div class="text-center py-16">
          <i data-lucide="tags" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
          <p class="text-gray-500">Tidak ada genre ditemukan</p>
        </div>
      `;
    } else {
      $('#genreList').innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          ${data.genres.map((genre, i) => `
            <a href="#/genre/${genre.id}" 
               class="genre-badge group p-4 rounded-xl bg-dark-800 border border-dark-600/30 hover:border-accent-500/30 hover:bg-accent-500/5 transition-all text-center fade-in-up stagger-${Math.min(i + 1, 8)}">
              <div class="w-10 h-10 mx-auto mb-3 rounded-lg bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 transition-colors">
                <i data-lucide="tag" class="w-5 h-5 text-accent-400"></i>
              </div>
              <h3 class="text-sm font-semibold text-gray-200 group-hover:text-accent-400 transition-colors">${escapeHtml(genre.name)}</h3>
            </a>
          `).join('')}
        </div>
      `;
    }

    lucide.createIcons();
    attachEventListeners();
  } catch (error) {
    showToast('Gagal memuat daftar genre', 'error');
    console.error(error);
  }
}

async function renderGenrePage(slug, page = 1) {
  state.currentRoute = 'genre-page';
  state.routeParams = { slug, page };

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 rounded-lg bg-accent-500/10">
            <i data-lucide="tag" class="w-5 h-5 text-accent-400"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-100 capitalize">Genre: ${escapeHtml(slug.replace(/-/g, ' '))}</h1>
        </div>
        <p class="text-gray-500 text-sm ml-12">Halaman ${page}</p>
      </div>
      <div id="genreResults">${SkeletonGrid(12)}</div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();

  try {
    const { data } = await API.genre(slug, page);

    if (data.results.length === 0) {
      $('#genreResults').innerHTML = `
        <div class="text-center py-16">
          <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
          <p class="text-gray-500">Tidak ada anime dalam genre ini</p>
        </div>
      `;
    } else {
      let html = AnimeGrid(data.results, `${data.results.length} Anime`, 'tv');

      // Pagination
      if (data.hasNext || page > 1) {
        html += `
          <div class="flex items-center justify-center gap-3 mt-8">
            ${page > 1 ? `
              <a href="#/genre/${slug}?page=${page - 1}" class="px-4 py-2 rounded-lg bg-dark-800 border border-dark-600/50 text-gray-300 hover:text-white hover:border-accent-500/30 transition-all text-sm font-medium flex items-center gap-2">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
                Sebelumnya
              </a>
            ` : ''}
            <span class="px-4 py-2 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-400 text-sm font-medium">
              Halaman ${page}
            </span>
            ${data.hasNext ? `
              <a href="#/genre/${slug}?page=${page + 1}" class="px-4 py-2 rounded-lg bg-dark-800 border border-dark-600/50 text-gray-300 hover:text-white hover:border-accent-500/30 transition-all text-sm font-medium flex items-center gap-2">
                Selanjutnya
                <i data-lucide="chevron-right" class="w-4 h-4"></i>
              </a>
            ` : ''}
          </div>
        `;
      }

      $('#genreResults').innerHTML = html;
    }

    lucide.createIcons();
    attachEventListeners();
  } catch (error) {
    showToast('Gagal memuat anime genre', 'error');
    console.error(error);
  }
}

async function renderOngoing() {
  state.currentRoute = 'ongoing';
  state.routeParams = {};

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 rounded-lg bg-accent-500/10">
            <i data-lucide="play-circle" class="w-5 h-5 text-accent-400"></i>
          </div>
          <h1 class="text-2xl font-bold text-gray-100">Anime On-going</h1>
        </div>
        <p class="text-gray-500 text-sm ml-12">Anime yang sedang tayang saat ini.</p>
      </div>
      <div id="ongoingResults">${SkeletonGrid(12)}</div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();

  try {
    const { data } = await API.home();
    const ongoing = data.ongoing || [];

    if (ongoing.length === 0) {
      $('#ongoingResults').innerHTML = `
        <div class="text-center py-16">
          <i data-lucide="play-circle" class="w-12 h-12 mx-auto mb-3 text-gray-600"></i>
          <p class="text-gray-500">Tidak ada anime on-going saat ini</p>
        </div>
      `;
    } else {
      $('#ongoingResults').innerHTML = AnimeGrid(ongoing, `${ongoing.length} Anime On-going`, 'play-circle');
    }

    lucide.createIcons();
    attachEventListeners();
  } catch (error) {
    showToast('Gagal memuat anime on-going', 'error');
    console.error(error);
  }
}

function renderNotFound() {
  state.currentRoute = '404';
  state.routeParams = {};

  const app = $('#app');
  app.innerHTML = `
    ${Navbar()}
    <main class="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="w-24 h-24 mx-auto mb-6 rounded-2xl bg-dark-800 flex items-center justify-center border border-dark-600/30">
          <i data-lucide="ghost" class="w-12 h-12 text-gray-600"></i>
        </div>
        <h1 class="text-4xl font-bold text-gray-300 mb-2">404</h1>
        <p class="text-gray-500 mb-6">Halaman tidak ditemukan</p>
        <a href="#/" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-medium transition-all">
          <i data-lucide="home" class="w-5 h-5"></i>
          Kembali ke Beranda
        </a>
      </div>
    </main>
    ${Footer()}
  `;

  lucide.createIcons();
  attachEventListeners();
}


// ===== ROUTER =====
const router = {
  routes: {
    'home': () => renderHome(),
    'search': (query) => renderSearch(query),
    'detail': (slug) => renderAnimeDetail(slug),
    'episode': (url) => renderEpisode(url),
    'genre': () => renderGenreList(),
    'genre-page': (slug, page) => renderGenrePage(slug, page),
    'ongoing': () => renderOngoing(),
    '404': () => renderNotFound(),
  },

  navigate(route, params = {}) {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (this.routes[route]) {
      this.routes[route](...Object.values(params));
    } else {
      this.routes['404']();
    }
  },

  handleHashChange() {
    const hash = window.location.hash.slice(1) || '/';

    if (hash === '/' || hash === '') {
      this.navigate('home');
    } else if (hash.startsWith('/search/')) {
      const query = decodeURIComponent(hash.slice(8));
      this.navigate('search', { query });
    } else if (hash.startsWith('/anime/')) {
      const slug = hash.slice(7);
      this.navigate('detail', { slug });
    } else if (hash.startsWith('/watch/')) {
      const url = decodeURIComponent(hash.slice(7));
      this.navigate('episode', { url });
    } else if (hash.startsWith('/genre/')) {
      const parts = hash.slice(7).split('?');
      const slug = parts[0];
      const page = parts[1] ? parseInt(new URLSearchParams(parts[1]).get('page')) || 1 : 1;
      this.navigate('genre-page', { slug, page });
    } else if (hash === '/genre') {
      this.navigate('genre');
    } else if (hash === '/ongoing') {
      this.navigate('ongoing');
    } else {
      this.navigate('404');
    }
  },
};

// ===== EVENT HANDLERS =====
function attachEventListeners() {
  // Search input desktop
  const searchInput = $('#searchInput');
  if (searchInput) {
    searchInput.oninput = debounce((e) => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        window.location.hash = `#/search/${encodeURIComponent(query)}`;
      }
    }, CONFIG.DEBOUNCE_DELAY);

    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query.length >= 2) {
          window.location.hash = `#/search/${encodeURIComponent(query)}`;
        }
      }
    };
  }

  // Mobile search
  const mobileSearchInput = $('#mobileSearchInput');
  if (mobileSearchInput) {
    mobileSearchInput.oninput = debounce((e) => {
      const query = e.target.value.trim();
      if (query.length >= 2) {
        window.location.hash = `#/search/${encodeURIComponent(query)}`;
      }
    }, CONFIG.DEBOUNCE_DELAY);

    mobileSearchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query.length >= 2) {
          window.location.hash = `#/search/${encodeURIComponent(query)}`;
        }
      }
    };
  }

  // Mobile search toggle
  const mobileSearchBtn = $('#mobileSearchBtn');
  if (mobileSearchBtn) {
    mobileSearchBtn.onclick = () => {
      const bar = $('#mobileSearchBar');
      bar.classList.toggle('hidden');
      if (!bar.classList.contains('hidden')) {
        setTimeout(() => $('#mobileSearchInput')?.focus(), 100);
      }
    };
  }

  // Mobile menu toggle
  const mobileMenuBtn = $('#mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.onclick = () => window.toggleMobileMenu();
  }

  // Navbar scroll effect
  const navbar = $('.navbar');
  if (navbar) {
    window.onscroll = () => {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
  }
}

// ===== GLOBAL FUNCTIONS =====
window.toggleMobileMenu = function() {
  state.mobileMenuOpen = !state.mobileMenuOpen;
  const menu = $('#mobileMenu');
  const backdrop = $('#menuBackdrop');

  if (state.mobileMenuOpen) {
    menu.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    menu.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
};

window.setHeroIndex = function(index) {
  state.heroIndex = index;
  const featured = state.cache.get('heroData');
  if (featured) {
    $('#heroSection').innerHTML = HeroCarousel(featured);
    lucide.createIcons();
  }
};

window.changeServer = function(url, serverName, serverIdx, linkIdx) {
  const decodedUrl = decodeURIComponent(url);

  // Update active button
  $$('.server-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = $(`[data-server="${serverIdx}-${linkIdx}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update iframe
  const container = $('#videoPlayerContainer');
  if (container) {
    container.innerHTML = `
      <iframe 
        id="videoFrame"
        src="${decodedUrl}" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
      ></iframe>
    `;
  }

  showToast(`Beralih ke ${serverName}`, 'success');
};

function startHeroCarousel(count) {
  if (state.heroInterval) {
    clearInterval(state.heroInterval);
  }

  if (count <= 1) return;

  state.heroInterval = setInterval(() => {
    state.heroIndex = (state.heroIndex + 1) % count;
    const heroSection = $('#heroSection');
    if (heroSection) {
      // Get cached home data to rebuild hero
      const cached = getCached(`${CONFIG.API_BASE}/home`);
      if (cached && cached.data && cached.data.featured) {
        heroSection.innerHTML = HeroCarousel(cached.data.featured);
        lucide.createIcons();
      }
    }
  }, 6000);
}

// ===== INITIALIZATION =====
function init() {
  // Handle hash changes
  window.addEventListener('hashchange', () => router.handleHashChange());

  // Initial route
  router.handleHashChange();

  // Preload genres
  API.genreList().then(({ data }) => {
    if (data.genres) state.genres = data.genres;
  }).catch(() => {});
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
