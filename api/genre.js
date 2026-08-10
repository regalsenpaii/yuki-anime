const { setCorsHeaders, handleError, fetchHTML, extractAnimeList, BASE_URL } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { id, slug, page = 1 } = req.query;
    const genreId = id || slug || '';

    if (!genreId) {
      res.status(400).json({
        success: false,
        message: 'Parameter "id" or "slug" is required',
        data: null,
      });
      return;
    }

    const genreUrl = `${BASE_URL}/genre/${genreId}/page/${page}/`;
    const $ = await fetchHTML(genreUrl);

    const results = extractAnimeList($, '.listupd, .postbody', '.bs, .animepost, .item, article');

    // Get genre name from page title or heading
    const genreName = $('.archive-title, h1, .page-title').first().text().trim() || genreId;

    // Pagination
    const hasNext = $('.pagination .next, .page-numbers.next').length > 0;

    res.status(200).json({
      success: true,
      data: {
        genre: {
          id: genreId,
          name: genreName,
        },
        page: parseInt(page),
        results: results.slice(0, 24),
        hasNext,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
