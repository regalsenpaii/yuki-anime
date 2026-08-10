const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://samehadaku.ac';

const axiosInstance = axios.create({
  timeout: 15000,
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
  },
  maxRedirects: 5,
});

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

function extractAnimeCard($, element) {
  const el = $(element);

  const linkEl = el.find('a').first();
  const link = linkEl.attr('href') || '';
  const linkId = link.replace(/\/$/, '').split('/').pop() || '';

  const imgEl = el.find('img').first();
  const image = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || '';
  const title = imgEl.attr('title') || imgEl.attr('alt') || el.find('.title, .entry-title, h2, h3').first().text().trim() || 'Unknown';

  const typeText = el.find('.type, .ttype, .post-type').first().text().trim() || '';
  const type = typeText.toUpperCase().includes('MOVIE') ? 'Movie' : 
               typeText.toUpperCase().includes('ONA') ? 'ONA' : 
               typeText.toUpperCase().includes('OVA') ? 'OVA' : 'TV';

  const episodeText = el.find('.ep, .episode, .eps, .latest-episode').first().text().trim() || '';
  const episodeMatch = episodeText.match(/Ep\s*(\d+)/i);
  const episode = episodeMatch ? parseInt(episodeMatch[1]) : null;

  const statusText = el.find('.status, .ongoing, .completed').first().text().trim().toLowerCase() || '';
  const status = statusText.includes('completed') ? 'Completed' : 
                 statusText.includes('ongoing') ? 'Ongoing' :
                 statusText.includes('upcoming') ? 'Upcoming' : 'Ongoing';

  const ratingText = el.find('.rating, .score').first().text().trim() || '';
  const rating = ratingText ? parseFloat(ratingText) : null;

  return {
    title,
    link,
    linkId,
    image,
    type,
    episode,
    status,
    rating,
  };
}

function extractAnimeList($, containerSelector, itemSelector) {
  const animeList = [];
  const container = $(containerSelector);

  if (container.length === 0) {
    $(itemSelector).each((_, el) => {
      const anime = extractAnimeCard($, el);
      if (anime.title && anime.title !== 'Unknown') {
        animeList.push(anime);
      }
    });
  } else {
    container.find(itemSelector).each((_, el) => {
      const anime = extractAnimeCard($, el);
      if (anime.title && anime.title !== 'Unknown') {
        animeList.push(anime);
      }
    });
  }

  return animeList;
}

module.exports = {
  BASE_URL,
  axiosInstance,
  setCorsHeaders,
  handleError,
  fetchHTML,
  extractAnimeCard,
  extractAnimeList,
};
