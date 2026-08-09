const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://s13.nontonanimeid.boats';

const axiosConfig = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/',
    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive'
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

function parseAnimeCard($, element) {
  const $el = $(element);
  
  const link = $el.find('a').first().attr('href') || 
               $el.find('.bsx a').attr('href') || 
               $el.find('.thumb a').attr('href') || '';
  
  const title = $el.find('.tt h2, .tt h4, .entry-title a, h2 a, .title, h3').first().text().trim() ||
                $el.find('a').first().attr('title') || '';
  
  const poster = $el.find('img').first().attr('src') || 
                 $el.find('img').first().attr('data-src') || 
                 $el.find('img').first().attr('data-lazy-src') || '';
  
  const status = $el.find('.status, .type, .sb, .limit .bt span').first().text().trim();
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const { data: html } = await axios.get(BASE_URL, axiosConfig);
    const $ = cheerio.load(html);
    
    const ongoing = [];
    const latest = [];
    const popular = [];
    const featured = [];
    
    // Ongoing
    $('.listupd .bsx, .ongoing .bsx, .series-ongoing .bsx, [class*="ongoing"] .bsx').each((i, el) => {
      if (i < 24) ongoing.push(parseAnimeCard($, el));
    });
    
    if (ongoing.length === 0) {
      $('.bsx, .animposx, .anime-card, .item').slice(0, 24).each((i, el) => {
        ongoing.push(parseAnimeCard($, el));
      });
    }
    
    // Latest
    $('.listupd .bsx, .latest .bsx, .new-series .bsx, .updates .bsx').each((i, el) => {
      if (i < 24) latest.push(parseAnimeCard($, el));
    });
    
    // Popular
    $('.popular .bsx, .trending .bsx, .hot-series .bsx, .pop .bsx').each((i, el) => {
      if (i < 12) popular.push(parseAnimeCard($, el));
    });
    
    // Featured
    $('.bixbox .bsx, .featured .bsx, .highlight .bsx').slice(0, 5).each((i, el) => {
      featured.push(parseAnimeCard($, el));
    });
    
    const dedupe = (arr) => {
      const seen = new Set();
      return arr.filter(item => {
        if (!item.slug || seen.has(item.slug)) return false;
        seen.add(item.slug);
        return true;
      });
    };
    
    const allItems = [...ongoing, ...latest, ...popular, ...featured];
    const uniqueAll = dedupe(allItems);
    
    const result = {
      success: true,
      ongoing: dedupe(ongoing).length > 0 ? dedupe(ongoing) : uniqueAll.slice(0, 12),
      latest: dedupe(latest).length > 0 ? dedupe(latest) : uniqueAll.slice(12, 24),
      popular: dedupe(popular).length > 0 ? dedupe(popular) : uniqueAll.slice(0, 12),
      featured: dedupe(featured).length > 0 ? dedupe(featured) : uniqueAll.slice(0, 5)
    };
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Home scrape error:', error.message);
    res.status(200).json({
      success: false,
      error: error.message,
      ongoing: [],
      latest: [],
      popular: [],
      featured: []
    });
  }
};
