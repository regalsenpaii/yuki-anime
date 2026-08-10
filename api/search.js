const { CONFIG, setCorsHeaders, handleError, fetchHTML, extractAnimeList } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { q, query, page = 1 } = req.query;
    const searchQuery = q || query || '';

    if (!searchQuery) {
      res.status(400).json({ success: false, message: 'Query parameter "q" or "query" is required', data: null });
      return;
    }

    const searchUrl = CONFIG.BASE_URL + `/page/${page}/?s=${encodeURIComponent(searchQuery)}`;
    const $ = await fetchHTML(searchUrl);
    const S = CONFIG.SELECTORS.search;

    const results = extractAnimeList($, S.container.split(', '), S.items.split(', '));
    const hasNext = $('.pagination .next, .page-numbers.next, a:contains("Next")').length > 0;

    res.status(200).json({
      success: true,
      data: { query: searchQuery, page: parseInt(page), results: results.slice(0, 24), hasNext },
    });
  } catch (error) {
    handleError(res, error);
  }
};
