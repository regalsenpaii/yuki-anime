/**
 * KONFIGURASI SCRAPING - Ganti URL sumber di sini saja
 * Untuk ganti website scraping, cukup ubah BASE_URL dan sesuaikan SELECTORS jika perlu
 */

const CONFIG = {
  // ===== GANTI URL SUMBER SCRAPING DI SINI =====
  BASE_URL: 'https://v2.samehadaku.how',

  // ===== PROXY (Opsional - jika website memblokir request) =====
  // Contoh: 'https://corsproxy.io/?'
  PROXY_URL: '', 

  // ===== TIMEOUT =====
  TIMEOUT: 15000,

  // ===== SELECTORS - Bisa disesuaikan jika ganti website =====
  SELECTORS: {
    // Home page
    home: {
      latestContainer: '.listupd, .postbody, .latest-releases, .content, main',
      latestItems: '.bs, .bsx, .animepost, .item, article.post, .animposx, [class*="anime"]',
      ongoingContainer: '.ongoing, .status-ongoing, [class*="ongoing"], [class*="tayang"]',
      ongoingItems: '.bs, .bsx, .animepost, .item, article.post, .animposx',
      popularContainer: '.trending, .popular, .featured, .recommendation, [class*="popular"], [class*="trending"], [class*="featured"]',
      popularItems: '.bs, .bsx, .animepost, .item, article.post, .animposx',
      genreContainer: '.genre-list, .genres, .list-genre, [class*="genre"]',
      genreItems: 'a',
      featuredContainer: '.hero, .banner, .featured-slider, .owl-carousel, .carousel, [class*="hero"], [class*="banner"]',
      featuredItems: '.item, .slide, article, .bs, .bsx',
    },

    // Search page
    search: {
      container: '.listupd, .search-results, .postbody, .content, main',
      items: '.bs, .bsx, .animepost, .item, article.post, .animposx',
      pagination: '.pagination a, .page-numbers, [class*="pagination"] a, [class*="page-numbers"]',
    },

    // Detail page
    detail: {
      title: '.entry-title, h1.title, .anime-title, .title, h1',
      image: '.thumb img, .poster img, .anime-image img, .entry-content img, .wp-post-image, img[src*="wp-content"]',
      synopsis: '.synopsis, .desc, .summary, .entry-content p, .description, [class*="sinopsis"], [class*="desc"]',
      genre: '.genre a, .genres a, [class*="genre"] a, .info-content a[href*="genre"]',
      rating: '.rating, .score, .vote, [class*="rating"], [class*="score"]',
      status: '.status, .ongoing, .completed, .info-status, [class*="status"]',
      type: '.type, .ttype, .info-type, [class*="type"]',
      totalEpisodes: '.totalep, .total-episode, .episodes, [class*="episode-count"]',
      duration: '.duration, .info-duration, [class*="duration"]',
      aired: '.aired, .info-aired, .release-date, [class*="aired"], [class*="date"]',
      studio: '.studio a, .studios a, .producer a, [class*="studio"] a',
      episodeList: '.eplister li, .episode-list li, .eps li, [class*="episode"] li, [class*="eplister"] li',
      episodeLink: 'a',
      episodeTitle: '.epl-title, .title, a',
      episodeDate: '.epl-date, .date',
      relatedContainer: '.related-posts, .recommendations, .similar-anime, [class*="related"], [class*="similar"]',
      relatedItems: '.bs, .bsx, .animepost, .item, article.post',
    },

    // Episode page
    episode: {
      title: '.entry-title, h1',
      videoIframe: '.player-embed iframe, .videoplayer iframe, .video iframe, iframe[src*="embed"], iframe[src*="player"], iframe[src*="stream"], iframe',
      videoSource: 'video source, video',
      serverContainer: '.server-item, .server, .mirror, [class*="server"], [class*="mirror"], .source, .player-source',
      serverName: '.server-name, .name, h3, h4, span, [class*="name"]',
      downloadContainer: '.download, .dl, [class*="download"], [class*="ddl"]',
      downloadLinks: 'a',
      episodeList: '.eplister li, .episode-list li, .eps li, [class*="episode"] li',
    },

    // Genre list page
    genreList: {
      container: '.genre-list, .genres, .list-genre, [class*="genre"]',
      items: 'a',
    },

    // Genre page
    genre: {
      container: '.listupd, .postbody, .content, main',
      items: '.bs, .bsx, .animepost, .item, article.post, .animposx',
      pagination: '.pagination a, .page-numbers',
    },
  },
};

module.exports = CONFIG;
