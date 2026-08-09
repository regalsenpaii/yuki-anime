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

function extractEpisodeNumber(text) {
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { slug } = req.query;
  
  if (!slug) {
    return res.status(400).json({ success: false, error: 'Query parameter "slug" is required' });
  }
  
  try {
    const detailUrl = `${BASE_URL}/anime/${slug}/`;
    const { data: html } = await axios.get(detailUrl, axiosConfig);
    const $ = cheerio.load(html);
    
    const title = $('h1.entry-title, .anime-title h1, .title h1, h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') || '';
    
    const alternativeTitle = $('.alter, .alternative-title, .judul-alt').first().text().trim();
    
    const poster = $('.thumb img').attr('src') || 
                   $('.poster img').attr('src') || 
                   $('meta[property="og:image"]').attr('content') || '';
    
    const synopsis = $('.entry-content p, .sinopsis p, .desc p, .synopsis, [class*="synopsis"]').first().text().trim() ||
                     $('meta[property="og:description"]').attr('content') || '';
    
    const infoMap = {};
    $('.infox .spe span, .info-content .spe span, .detail-info span, .meta span').each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes(':')) {
        const [key, ...valParts] = text.split(':');
        infoMap[key.trim().toLowerCase()] = valParts.join(':').trim();
      }
    });
    
    $('.infox table tr, .detail-info table tr').each((i, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 2) {
        const key = $(tds[0]).text().trim().toLowerCase();
        const val = $(tds[1]).text().trim();
        infoMap[key] = val;
      }
    });
    
    const status = infoMap['status'] || infoMap['status:'] || $('.status, .type').first().text().trim() || 'Unknown';
    const type = infoMap['type'] || infoMap['tipe'] || $('.type').first().text().trim() || 'TV';
    const rating = infoMap['rating'] || infoMap['score'] || $('.numscore').first().text().trim() || '';
    const duration = infoMap['duration'] || infoMap['durasi'] || '';
    const year = infoMap['year'] || infoMap['tahun'] || infoMap['released'] || '';
    const totalEpisodes = infoMap['total episodes'] || infoMap['episodes'] || infoMap['jumlah episode'] || '';
    
    const genres = [];
    $('.genxed a, .genre a, .genres a, [class*="genre"] a').each((i, el) => {
      const g = $(el).text().trim();
      if (g) genres.push(g);
    });
    
    const episodes = [];
    $('.episodelist li, .epsdlist li, .episode-list li, .episodes li, .eplister li, .ep-list li').each((i, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href') || '';
      const epTitle = $el.find('.epl-title, .title, a').first().text().trim();
      const epNumber = extractEpisodeNumber(epTitle) || extractEpisodeNumber($el.text()) || (episodes.length + 1);
      const epSlug = extractSlug(link);
      
      if (epSlug && link) {
        episodes.push({
          slug: epSlug,
          title: epTitle,
          number: epNumber,
          url: link.startsWith('http') ? link : `${BASE_URL}${link}`
        });
      }
    });
    
    if (episodes.length === 0) {
      $('a[href*="/episode/"]').each((i, el) => {
        const $el = $(el);
        const link = $el.attr('href') || '';
        const epTitle = $el.text().trim();
        const epNumber = extractEpisodeNumber(epTitle) || (i + 1);
        const epSlug = extractSlug(link);
        
        if (epSlug && !episodes.find(e => e.slug === epSlug)) {
          episodes.push({
            slug: epSlug,
            title: epTitle,
            number: epNumber,
            url: link.startsWith('http') ? link : `${BASE_URL}${link}`
          });
        }
      });
    }
    
    episodes.sort((a, b) => (a.number || 0) - (b.number || 0));
    
    res.status(200).json({
      success: true,
      anime: {
        slug,
        title,
        alternativeTitle,
        poster,
        synopsis,
        status,
        type,
        rating,
        duration,
        year,
        totalEpisodes,
        genres,
        episodes,
        url: detailUrl
      }
    });
    
  } catch (error) {
    console.error('Detail error:', error.message);
    res.status(200).json({
      success: false,
      error: error.message,
      anime: null
    });
  }
};
