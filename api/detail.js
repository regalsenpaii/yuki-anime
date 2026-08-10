const { setCorsHeaders, handleError, fetchHTML, BASE_URL } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { id, slug } = req.query;
    const animeId = id || slug || '';

    if (!animeId) {
      res.status(400).json({
        success: false,
        message: 'Parameter "id" or "slug" is required',
        data: null,
      });
      return;
    }

    const detailUrl = `${BASE_URL}/anime/${animeId}/`;
    const $ = await fetchHTML(detailUrl);

    // Extract title
    const title = $('.entry-title, h1.title, .anime-title').first().text().trim() || 
                  $('h1').first().text().trim() || '';

    // Extract image
    const imgEl = $('.thumb img, .poster img, .anime-image img, .entry-content img').first();
    const image = imgEl.attr('src') || imgEl.attr('data-src') || '';

    // Extract synopsis
    const synopsis = $('.synopsis, .desc, .summary, .entry-content p').first().text().trim() || '';

    // Extract genres
    const genres = [];
    $('.genre a, .genres a, [class*="genre"] a').each((_, el) => {
      const genreName = $(el).text().trim();
      const genreLink = $(el).attr('href') || '';
      const genreId = genreLink.replace(/\/$/, '').split('/').pop() || '';
      if (genreName && genreId) {
        genres.push({ name: genreName, id: genreId, link: genreLink });
      }
    });

    // Extract rating
    const ratingText = $('.rating, .score, .vote').first().text().trim() || '';
    const rating = ratingText ? parseFloat(ratingText) : null;

    // Extract status
    const statusText = $('.status, .ongoing, .completed, .info-status').first().text().trim().toLowerCase() || '';
    const status = statusText.includes('completed') ? 'Completed' : 
                   statusText.includes('ongoing') ? 'Ongoing' :
                   statusText.includes('upcoming') ? 'Upcoming' : 'Unknown';

    // Extract type
    const typeText = $('.type, .ttype, .info-type').first().text().trim() || '';
    const type = typeText.toUpperCase().includes('MOVIE') ? 'Movie' : 
                 typeText.toUpperCase().includes('ONA') ? 'ONA' : 
                 typeText.toUpperCase().includes('OVA') ? 'OVA' : 'TV';

    // Extract total episodes
    const totalEpsText = $('.totalep, .total-episode, .episodes').first().text().trim() || '';
    const totalEpisodes = totalEpsText ? parseInt(totalEpsText.match(/\d+/)?.[0]) || null : null;

    // Extract duration
    const duration = $('.duration, .info-duration').first().text().trim() || '';

    // Extract aired date
    const aired = $('.aired, .info-aired, .release-date').first().text().trim() || '';

    // Extract studios
    const studios = [];
    $('.studio a, .studios a, .producer a').each((_, el) => {
      const studioName = $(el).text().trim();
      if (studioName) studios.push(studioName);
    });

    // Extract episode list
    const episodes = [];
    $('.eplister li, .episode-list li, .eps li, [class*="episode"] li').each((_, el) => {
      const $el = $(el);
      const epLink = $el.find('a').first().attr('href') || '';
      const epTitle = $el.find('.epl-title, .title, a').first().text().trim() || '';
      const epNumberMatch = epTitle.match(/Episode\s*(\d+)/i) || epLink.match(/episode-(\d+)/i);
      const epNumber = epNumberMatch ? parseInt(epNumberMatch[1]) : null;
      const epDate = $el.find('.epl-date, .date').first().text().trim() || '';

      if (epLink && epNumber) {
        episodes.push({
          number: epNumber,
          title: epTitle,
          link: epLink,
          date: epDate,
        });
      }
    });

    // Sort episodes by number
    episodes.sort((a, b) => a.number - b.number);

    // Extract related/recommended anime
    const relatedAnime = [];
    $('.related-posts, .recommendations, .similar-anime').first().find('.bs, .animepost, .item').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first().attr('href') || '';
      const linkId = link.replace(/\/$/, '').split('/').pop() || '';
      const imgEl = $el.find('img').first();
      const img = imgEl.attr('src') || imgEl.attr('data-src') || '';
      const relTitle = imgEl.attr('title') || imgEl.attr('alt') || $el.find('.title, h2, h3').first().text().trim() || '';

      if (relTitle) {
        relatedAnime.push({ title: relTitle, link, linkId, image: img });
      }
    });

    res.status(200).json({
      success: true,
      data: {
        title,
        image,
        synopsis,
        genres,
        rating,
        status,
        type,
        totalEpisodes,
        duration,
        aired,
        studios,
        episodes,
        relatedAnime: relatedAnime.slice(0, 8),
        linkId: animeId,
        link: detailUrl,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
