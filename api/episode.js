const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://samehadaku.ac';

const axiosConfig = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Referer': BASE_URL
  },
  timeout: 20000
};

function extractSlug(url) {
  if (!url) return '';
  const clean = url.replace(/\/$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1] || '';
}

function extractEpisodeNumber(text) {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function cleanEmbedUrl(url) {
  if (!url) return null;
  let clean = url;
  const adPatterns = [/[?&]ref=[^&]+/gi, /[?&]source=[^&]+/gi, /[?&]pop=[^&]+/gi];
  adPatterns.forEach(p => clean = clean.replace(p, ''));
  return clean.replace(/[?&]$/, '');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ success: false, error: 'Slug required' });
  
  try {
    const episodeUrl = `${BASE_URL}/episode/${slug}/`;
    const { data: html } = await axios.get(episodeUrl, axiosConfig);
    const $ = cheerio.load(html);
    
    const title = $('h1.entry-title, h1').first().text().trim();
    const episodeNumber = extractEpisodeNumber(title) || extractEpisodeNumber(slug) || 1;
    
    let animeTitle = '';
    let animeSlug = '';
    
    const breadcrumbAnime = $('.breadcrumb a, .breadcrumbs a').eq(1).attr('href') || '';
    if (breadcrumbAnime.includes('/anime/')) {
      animeSlug = extractSlug(breadcrumbAnime);
      animeTitle = $('.breadcrumb a, .breadcrumbs a').eq(1).text().trim();
    }
    
    if (!animeTitle) {
      const parts = title.split(/[-–]/);
      if (parts.length > 1) animeTitle = parts[0].replace(/episode\s*\d+/i, '').trim();
    }
    
    let embedUrl = null;
    let videoUrl = null;
    let poster = null;
    
    const iframe = $('iframe').first();
    if (iframe.length) embedUrl = cleanEmbedUrl(iframe.attr('src'));
    
    const video = $('video').first();
    if (video.length) {
      videoUrl = video.attr('src') || video.find('source').first().attr('src');
      poster = video.attr('poster');
    }
    
    if (!embedUrl && !videoUrl) {
      const dataSrc = $('[data-src*="embed"], [data-url*="embed"], [data-video]').first();
      embedUrl = cleanEmbedUrl(dataSrc.attr('data-src') || dataSrc.attr('data-url') || dataSrc.attr('data-video'));
    }
    
    if (!embedUrl && !videoUrl) {
      $('script').each((i, el) => {
        const script = $(el).html() || '';
        const match = script.match(/src["']?\s*:\s*["']([^"']+(?:embed|stream|video)[^"']*)["']/i) ||
                      script.match(/url["']?\s*:\s*["']([^"']+)["']/i);
        if (match && !embedUrl) embedUrl = cleanEmbedUrl(match[1]);
      });
    }
    
    const playerLinks = [];
    $('.server-item, .mirror option, .player-option, .source-item').each((i, el) => {
      const $el = $(el);
      const src = $el.attr('data-src') || $el.attr('value') || $el.attr('data-video');
      const label = $el.text().trim() || $el.attr('data-name') || `Server ${i + 1}`;
      if (src) playerLinks.push({ label, url: cleanEmbedUrl(src) });
    });
    
    if (!embedUrl && playerLinks.length > 0) embedUrl = playerLinks[0].url;
    
    let episodes = [];
    let prevSlug = null;
    let nextSlug = null;
    
    if (animeSlug) {
      try {
        const animeUrl = `${BASE_URL}/anime/${animeSlug}/`;
        const { data: animeHtml } = await axios.get(animeUrl, { ...axiosConfig, timeout: 10000 });
        const $anime = cheerio.load(animeHtml);
        
        $anime('.episodelist li a, .eplister li a, .episode-list li a').each((i, el) => {
          const $a = $anime(el);
          const link = $a.attr('href') || '';
          const epSlug = extractSlug(link);
          const epTitle = $a.text().trim();
          const epNum = extractEpisodeNumber(epTitle) || (i + 1);
          if (epSlug) episodes.push({ slug: epSlug, title: epTitle, number: epNum });
        });
        
        episodes.sort((a, b) => (a.number || 0) - (b.number || 0));
        const idx = episodes.findIndex(e => e.slug === slug);
        if (idx > 0) prevSlug = episodes[idx - 1].slug;
        if (idx >= 0 && idx < episodes.length - 1) nextSlug = episodes[idx + 1].slug;
      } catch (e) {}
    }
    
    if (episodes.length === 0) {
      $('.episodelist li a, .eplister li a, .episode-list li a').each((i, el) => {
        const $a = $(el);
        const link = $a.attr('href') || '';
        const epSlug = extractSlug(link);
        const epTitle = $a.text().trim();
        const epNum = extractEpisodeNumber(epTitle) || (i + 1);
        if (epSlug && !episodes.find(e => e.slug === epSlug)) {
          episodes.push({ slug: epSlug, title: epTitle, number: epNum });
        }
      });
      episodes.sort((a, b) => (a.number || 0) - (b.number || 0));
      const idx = episodes.findIndex(e => e.slug === slug);
      if (idx > 0) prevSlug = episodes[idx - 1].slug;
      if (idx >= 0 && idx < episodes.length - 1) nextSlug = episodes[idx + 1].slug;
    }
    
    res.status(200).json({
      success: true,
      episode: {
        slug,
        title,
        number: episodeNumber,
        animeTitle,
        animeSlug,
        poster: poster || $('.thumb img').attr('src') || '',
        embedUrl,
        videoUrl,
        sources: playerLinks,
        prevSlug,
        nextSlug,
        episodes,
        url: episodeUrl
      }
    });
    
  } catch (error) {
    console.error('Episode error:', error.message);
    res.status(200).json({
      success: false,
      error: error.message,
      episode: null
    });
  }
};
