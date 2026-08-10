const { CONFIG, setCorsHeaders, handleError, fetchHTML, extractAnimeList } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { id, slug, page = 1 } = req.query;
    const genreId = id || slug || '';

    if (!genreId) {
      res.status(400).json({ success: false, message: 'Parameter "id" or "slug" is required', data: null });
      return;
    }

    const genreUrl = CONFIG.BASE_URL + `/genre/${genreId}/page/${page}/`;
    const $ = await fetchHTML(genreUrl);
    const S = CONFIG.SELECTORS.genre;

    const results = extractAnimeList($, S.container.split(', '), S.items.split(', '));
    const genreName = $('.archive-title, h1, .page-title').first().text().trim() || genreId;
    const hasNext = $('.pagination .next, .page-numbers.next').length > 0;

    res.status(200).json({
      success: true,
      data: { genre: { id: genreId, name: genreName }, page: parseInt(page), results: results.slice(0, 24), hasNext },
    });
  } catch (error) {
    handleError(res, error);
  }
};
