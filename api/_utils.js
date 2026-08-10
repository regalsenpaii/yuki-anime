const axios = require('axios');
const cheerio = require('cheerio');
const CONFIG = require('./config');

const axiosInstance = axios.create({
  timeout: CONFIG.TIMEOUT,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': CONFIG.BASE_URL,
  },
  maxRedirects: 5,
});

function getUrl(path) {
  const base = CONFIG.PROXY_URL ? CONFIG.PROXY_URL + encodeURIComponent(CONFIG.BASE_URL + path) : CONFIG.BASE_URL + path;
  return base;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

function handleError(res, error, statusCode = 500) {
  console.error('API Error:', error.message);
  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error',
    data: null,
  });
}

async function fetchHTML(url) {
  try {
    const response = await axiosInstance.get(url);
    return cheerio.load(response.data);
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
}

function extractText($, selectors) {
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text) return text;
  }
  return '';
}

function extractAttr($, selectors, attr) {
  for (const sel of selectors) {
    const val = $(sel).first().attr(attr);
    if (val) return val;
  }
  return '';
}

function extractAnimeCard($, element) {
  const el = $(element);

  // Find link
  let link = '';
  const linkEl = el.find('a').first();
  if (linkEl.length) link = linkEl.attr('href') || '';
  if (!link) link = el.attr('href') || '';

  const linkId = link.replace(/\/$/, '').split('/').pop() || '';

  // Find image
  let image = '';
  const imgEl = el.find('img').first();
  if (imgEl.length) {
    image = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('srcset')?.split(' ')[0] || '';
  }

  // Find title
  let title = '';
  if (imgEl.length) title = imgEl.attr('title') || imgEl.attr('alt') || '';
  if (!title) title = el.find('.tt, .entry-title, .title, h2, h3, h4, [class*="title"]').first().text().trim();
  if (!title) title = el.find('a').first().attr('title') || '';
  if (!title) title = linkId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  // Type
  let type = 'TV';
  const typeText = el.find('.type, .ttype, .post-type, [class*="type"]').first().text().trim().toUpperCase();
  if (typeText.includes('MOVIE')) type = 'Movie';
  else if (typeText.includes('ONA')) type = 'ONA';
  else if (typeText.includes('OVA')) type = 'OVA';
  else if (typeText.includes('SPECIAL')) type = 'Special';

  // Episode
  let episode = null;
  const epSelectors = ['.ep', '.episode', '.eps', '.latest-episode', '.epx', '[class*="ep"]'];
  for (const sel of epSelectors) {
    const epText = el.find(sel).first().text().trim();
    const match = epText.match(/Ep\s*(\d+)/i) || epText.match(/(\d+)/);
    if (match) { episode = parseInt(match[1]); break; }
  }

  // Status
  let status = 'Ongoing';
  const statusText = el.find('.status, .ongoing, .completed, [class*="status"]').first().text().trim().toLowerCase();
  if (statusText.includes('completed') || statusText.includes('selesai')) status = 'Completed';
  else if (statusText.includes('upcoming') || statusText.includes('akan datang')) status = 'Upcoming';

  // Rating
  let rating = null;
  const ratingText = el.find('.rating, .score, [class*="rating"]').first().text().trim();
  if (ratingText) {
    const r = parseFloat(ratingText);
    if (!isNaN(r)) rating = r;
  }

  return { title, link, linkId, image, type, episode, status, rating };
}

function extractAnimeList($, containerSelectors, itemSelectors) {
  const animeList = [];
  const seen = new Set();

  for (const containerSel of containerSelectors) {
    const container = $(containerSel);
    if (container.length === 0) continue;

    for (const itemSel of itemSelectors) {
      container.find(itemSel).each((_, el) => {
        const anime = extractAnimeCard($, el);
        if (anime.title && anime.title !== 'Unknown' && anime.linkId && !seen.has(anime.linkId)) {
          seen.add(anime.linkId);
          animeList.push(anime);
        }
      });
    }
  }

  // Fallback: search entire document if container not found
  if (animeList.length === 0) {
    for (const itemSel of itemSelectors) {
      $(itemSel).each((_, el) => {
        const anime = extractAnimeCard($, el);
        if (anime.title && anime.title !== 'Unknown' && anime.linkId && !seen.has(anime.linkId)) {
          seen.add(anime.linkId);
          animeList.push(anime);
        }
      });
    }
  }

  return animeList;
}

module.exports = {
  CONFIG,
  axiosInstance,
  getUrl,
  setCorsHeaders,
  handleError,
  fetchHTML,
  extractText,
  extractAttr,
  extractAnimeCard,
  extractAnimeList,
};
