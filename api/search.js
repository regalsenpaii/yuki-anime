const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://s13.nontonanimeid.boats';

const axiosConfig = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': BASE_URL,
    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  },
  timeout: 20000,
  maxRedirects: 5,
  decompress: true
};

function extractSlug(url) {
  if (!url) return '';
  const clean = url.replace(/\/$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1] || '';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { q } = req.query;
  
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" is required', results: [] });
  }
  
  try {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(q)}`;
    const { data: html } = await axios.get(searchUrl, axiosConfig);
    const $ = cheerio.load(html);
    
    const results = [];
    
    const selectors = [
      '.listupd .bsx',
      '.search-results .bsx',
      '.result .bsx',
      '.bsx',
      '.animposx',
      '.anime-card',
      '.item'
    ];
    
    for (const selector of selectors) {
      $(selector).each((i, el) => {
        if (i >= 50) return false;
        
        const $el = $(el);
        const link = $el.find('a').first().attr('href') || 
                     $el.find('.thumb a').attr('href') || '';
        
        const title = $el.find('.tt h2, .tt h4, .entry-title a, h2 a, .title, h3, a').first().text().trim() ||
                      $el.find('a').first().attr('title') || '';
        
        const poster = $el.find('img').first().attr('src') || 
                       $el.find('img').first().attr('data-src') || '';
        
        const status = $el.find('.status, .type, .sb').first().text().trim();
        const episode = $el.find('.epx, .episode, .num').first().text().trim();
        const rating = $el.find('.rating, .numscore').first().text().trim();
        
        if (title && link) {
          results.push({
            slug: extractSlug(link),
            title,
            poster,
            status: status || 'Unknown',
            latestEpisode: episode || '',
            rating: rating || '',
            url: link.startsWith('http') ? link : `${BASE_URL}${link}`
          });
        }
      });
      
      if (results.length > 0) break;
    }
    
    const seen = new Set();
    const unique = results.filter(item => {
      if (seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    });
    
    res.status(200).json({
      success: true,
      query: q,
      count: unique.length,
      results: unique
    });
    
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(200).json({
      success: false,
      error: error.message,
      query: q,
      results: []
    });
  }
};
