const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://samehadaku.ac';

const axiosConfig = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Referer': 'https://www.google.com/'
  },
  timeout: 20000
};

function extractSlug(url) {
  if (!url) return '';
  const clean = url.replace(/\/$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1] || '';
}

function parseAnimeCard($, element) {
  const $el = $(element);
  
  const link = $el.find('a').first().attr('href') || '';
  const title = $el.find('h2, h3, h4, .title, a').first().text().trim() || 
                $el.find('a').first().attr('title') || '';
  
  const poster = $el.find('img').first().attr('src') || 
                 $el.find('img').first().attr('data-src') || '';
  
  const status = $el.find('.type, .status, .tt span').first().text().trim();
  const episode = $el.find('.epx, .episode, .num, .latest-chapter').first().text().trim();
  const rating = $el.find('.rating, .numscore').first().text().trim();
  
  return {
    slug: extractSlug(link),
    title,
    poster,
    status: status || 'On-going',
    latestEpisode: episode || '',
    rating: rating || '',
    url: link.startsWith('http') ? link : `${BASE_URL}${link}`
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { data: html } = await axios.get(BASE_URL, axiosConfig);
    const $ = cheerio.load(html);
    
    const ongoing = [];
    const latest = [];
    const popular = [];
    const featured = [];
    
    // Samehadaku latest release
    $('.listupd .bsx, .animposx, .anime-item, .post-item').each((i, el) => {
      if (i < 24) latest.push(parseAnimeCard($, el));
    });
    
    // If still empty, grab all anime links from homepage
    if (latest.length === 0) {
      $('a[href*="/anime/"]').each((i, el) => {
        if (i >= 24) return false;
        const $a = $(el);
        const href = $a.attr('href') || '';
        const title = $a.text().trim() || $a.attr('title') || '';
        const img = $a.find('img').attr('src') || $a.find('img').attr('data-src') || '';
        if (title && href && !latest.find(x => x.slug === extractSlug(href))) {
          latest.push({
            slug: extractSlug(href),
            title,
            poster: img,
            status: 'On-going',
            latestEpisode: '',
            rating: '',
            url: href.startsWith('http') ? href : `${BASE_URL}${href}`
          });
        }
      });
    }
    
    // Recommendation / Popular section
    $('.bixbox .bsx, .series-gen .bsx, .pop .bsx, .trending .bsx').each((i, el) => {
      if (i < 12) popular.push(parseAnimeCard($, el));
    });
    
    // Ongoing = same as latest for samehadaku (they mix it)
    const dedupe = (arr) => {
      const seen = new Set();
      return arr.filter(item => {
        if (!item.slug || seen.has(item.slug)) return false;
        seen.add(item.slug);
        return true;
      });
    };
    
    const uniqueLatest = dedupe(latest);
    const uniquePopular = dedupe(popular);
    
    res.status(200).json({
      success: true,
      ongoing: uniqueLatest.slice(0, 12),
      latest: uniqueLatest,
      popular: uniquePopular.length > 0 ? uniquePopular : uniqueLatest.slice(0, 12),
      featured: uniqueLatest.slice(0, 5)
    });
    
  } catch (error) {
    console.error('Home scrape error:', error.message);
    res.status(200).json({
      success: false,
      error: error.message,
      ongoing: [], latest: [], popular: [], featured: []
    });
  }
};
