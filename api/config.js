/**
 * KONFIGURASI SCRAPING - Ganti URL sumber di sini saja
 * Default: https://v2.samehadaku.how
 */

const CONFIG = {
  // ===== GANTI URL SUMBER SCRAPING DI SINI =====
  BASE_URL: 'https://v2.samehadaku.how',

  // ===== PROXY (Opsional - jika website memblokir request) =====
  // Contoh: 'https://corsproxy.io/?'
  PROXY_URL: '', 

  // ===== TIMEOUT =====
  TIMEOUT: 20000,

  // ===== SELECTORS - Disetel untuk v2.samehadaku.how =====
  SELECTORS: {
    // Home page
    home: {
      latestContainer: '.listupd, .postbody, .latest-releases, .content, main, #content, .site-content',
      latestItems: '.bs, .bsx, .animepost, .item, article.post, .animposx, .bsitem, [class*="anime"], .post-item',
      ongoingContainer: '.ongoing, .status-ongoing, [class*="ongoing"], [class*="tayang"], .section-ongoing',
      ongoingItems: '.bs, .bsx, .animepost, .item, article.post, .animposx, .bsitem',
      popularContainer: '.trending, .popular, .featured, .recommendation, [class*="popular"], [class*="trending"], [class*="featured"], .section-popular',
      popularItems: '.bs, .bsx, .animepost, .item, article.post, .animposx, .bsitem',
      genreContainer: '.genre-list, .genres, .list-genre, [class*="genre"], .widget_genre, .menu-genre',
      genreItems: 'a',
      featuredContainer: '.hero, .banner, .featured-slider, .owl-carousel, .carousel, [class*="hero"], [class*="banner"], .highlight',
      featuredItems: '.item, .slide, article, .bs, .bsx, .highlight-item',
    },

    // Search page
    search: {
      container: '.listupd, .search-results, .postbody, .content, main, #content, .site-content, .search-list',
      items: '.bs, .bsx, .animepost, .item, article.post, .animposx, .bsitem, .search-item',
      pagination: '.pagination a, .page-numbers, [class*="pagination"] a, [class*="page-numbers"], .nav-links a',
    },

    // Detail page (/anime/{slug}/)
    detail: {
      title: '.entry-title, h1.title, .anime-title, .title, h1, .post-title',
      image: '.thumb img, .poster img, .anime-image img, .entry-content img, .wp-post-image, img[src*="wp-content"], .anime-thumb img, .cover img',
      synopsis: '.synopsis, .desc, .summary, .entry-content p, .description, [class*="sinopsis"], [class*="desc"], .post-content p',
      genre: '.genre a, .genres a, [class*="genre"] a, .info-content a[href*="genre"], .post-genre a',
      rating: '.rating, .score, .vote, [class*="rating"], [class*="score"], .anime-rating',
      status: '.status, .ongoing, .completed, .info-status, [class*="status"], .anime-status',
      type: '.type, .ttype, .info-type, [class*="type"], .anime-type',
      totalEpisodes: '.totalep, .total-episode, .episodes, [class*="episode-count"], .episode-total',
      duration: '.duration, .info-duration, [class*="duration"], .anime-duration',
      aired: '.aired, .info-aired, .release-date, [class*="aired"], [class*="date"], .anime-aired',
      studio: '.studio a, .studios a, .producer a, [class*="studio"] a, .anime-studio a',
      // Episode list in detail page - v2.samehadaku.how format
      episodeList: '.eplister li, .episode-list li, .eps li, [class*="episode"] li, .ep-list li, .lsteps li, .list-episode li',
      episodeLink: 'a',
      episodeTitle: '.epl-title, .title, a, .eptitle',
      episodeDate: '.epl-date, .date, .epdate, [class*="date"]',
      relatedContainer: '.related-posts, .recommendations, .similar-anime, [class*="related"], [class*="similar"], .section-related',
      relatedItems: '.bs, .bsx, .animepost, .item, article.post, .animposx, .bsitem',
    },

    // Episode page (/{slug}-episode-{number}/)
    episode: {
      title: '.entry-title, h1, .post-title, .episode-title',
      // Video iframe - try many selectors
      videoIframe: '.player-embed iframe, .videoplayer iframe, .video iframe, .player iframe, .embed-responsive iframe, [class*="player"] iframe, [class*="video"] iframe, iframe[src*="embed"], iframe[src*="player"], iframe[src*="stream"], iframe[src*="video"], iframe[src*="watch"], iframe',
      videoSource: 'video source, video',
      // Server containers
      serverContainer: '.server-item, .server, .mirror, [class*="server"], [class*="mirror"], .source, .player-source, .tab-server, .server-list, .video-source, .source-box, .srv',
      serverName: '.server-name, .name, h3, h4, span, [class*="name"], .srv-name',
      // Download section
      downloadContainer: '.download, .dl, [class*="download"], [class*="ddl"], .link-download, .download-box',
      downloadLinks: 'a',
      // Episode list for navigation
      episodeList: '.eplister li, .episode-list li, .eps li, [class*="episode"] li, .ep-list li, .lsteps li',
    },

    // Genre list page
    genreList: {
      container: '.genre-list, .genres, .list-genre, [class*="genre"], .widget_genre, .menu-genre, .daftar-genre',
      items: 'a',
    },

    // Genre page
    genre: {
      container: '.listupd, .postbody, .content, main, #content, .site-content, .genre-listing',
      items: '.bs, .bsx, .animepost, .item, article.post, .animposx, .bsitem',
      pagination: '.pagination a, .page-numbers, .nav-links a',
    },
  },
};

module.exports = CONFIG;
