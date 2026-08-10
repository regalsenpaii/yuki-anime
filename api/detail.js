const { CONFIG, setCorsHeaders, handleError, fetchHTML, extractText, extractAttr, extractAnimeList } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { id, slug } = req.query;
    const animeId = id || slug || '';

    if (!animeId) {
      res.status(400).json({ success: false, message: 'Parameter "id" or "slug" is required', data: null });
      return;
    }

    const detailUrl = CONFIG.BASE_URL + `/anime/${animeId}/`;
    const $ = await fetchHTML(detailUrl);
    const S = CONFIG.SELECTORS.detail;

    const title = extractText($, S.title.split(', '));
    const image = extractAttr($, S.image.split(', '), 'src') || extractAttr($, S.image.split(', '), 'data-src');
    const synopsis = extractText($, S.synopsis.split(', '));

    const genres = [];
    $(S.genre).each((_, el) => {
      const name = $(el).text().trim();
      const link = $(el).attr('href') || '';
      const id = link.replace(/\/$/, '').split('/').pop() || '';
      if (name && id && !genres.find(g => g.id === id)) genres.push({ name, id, link });
    });

    const ratingText = extractText($, S.rating.split(', '));
    const rating = ratingText ? parseFloat(ratingText) : null;

    const statusText = extractText($, S.status.split(', ')).toLowerCase();
    const status = statusText.includes('completed') || statusText.includes('selesai') ? 'Completed' : 
                   statusText.includes('upcoming') || statusText.includes('akan datang') ? 'Upcoming' : 'Ongoing';

    const typeText = extractText($, S.type.split(', '));
    const type = typeText.toUpperCase().includes('MOVIE') ? 'Movie' : 
                 typeText.toUpperCase().includes('ONA') ? 'ONA' : 
                 typeText.toUpperCase().includes('OVA') ? 'OVA' : 
                 typeText.toUpperCase().includes('SPECIAL') ? 'Special' : 'TV';

    const totalEpsText = extractText($, S.totalEpisodes.split(', '));
    const totalEpisodes = totalEpsText ? parseInt(totalEpsText.match(/\d+/)?.[0]) || null : null;
    const duration = extractText($, S.duration.split(', '));
    const aired = extractText($, S.aired.split(', '));

    const studios = [];
    $(S.studio).each((_, el) => {
      const name = $(el).text().trim();
      if (name && !studios.includes(name)) studios.push(name);
    });

    const episodes = [];
    $(S.episodeList).each((_, el) => {
      const $el = $(el);
      const epLink = $el.find(S.episodeLink).first().attr('href') || '';
      const epTitle = $el.find(S.episodeTitle).first().text().trim() || '';
      const epNumberMatch = epTitle.match(/Episode\s*(\d+)/i) || epLink.match(/episode[-_](\d+)/i) || epLink.match(/-(\d+)\/?$/);
      const epNumber = epNumberMatch ? parseInt(epNumberMatch[1]) : null;
      const epDate = $el.find(S.episodeDate).first().text().trim() || '';

      if (epLink && epNumber) {
        episodes.push({ number: epNumber, title: epTitle, link: epLink, date: epDate });
      }
    });
    episodes.sort((a, b) => a.number - b.number);

    const relatedAnime = extractAnimeList($, S.relatedContainer.split(', '), S.relatedItems.split(', '));

    res.status(200).json({
      success: true,
      data: {
        title, image, synopsis, genres, rating, status, type, totalEpisodes, duration, aired, studios,
        episodes, relatedAnime: relatedAnime.slice(0, 8), linkId: animeId, link: detailUrl,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
