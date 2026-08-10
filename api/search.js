const { setCorsHeaders, handleError, fetchHTML, extractAnimeList, BASE_URL } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { q, query, page = 1 } = req.query;
    const searchQuery = q || query || '';

    if (!searchQuery) {
      res.status(400).json({
        success: false,
        message: 'Query parameter "q" or "query" is required',
        data: null,
      });
      return;
    }

    const searchUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(searchQuery)}`;
    const $ = await fetchHTML(searchUrl);

    const results = extractAnimeList($, '.listupd, .search-results, .postbody', '.bs, .animepost, .item, article');

    // Get total pages info
    const pagination = [];
    $('.pagination a, .page-numbers').each((_, el) => {
      const pageNum = $(el).text().trim();
      const pageLink = $(el).attr('href') || '';
      if (pageNum && !isNaN(parseInt(pageNum))) {
        pagination.push({ page: parseInt(pageNum), link: pageLink });
      }
    });

    const hasNext = $('.pagination .next, .page-numbers.next').length > 0 || 
                    $('.pagination a:contains("Next"), .page-numbers:contains("Next")').length > 0;

    res.status(200).json({
      success: true,
      data: {
        query: searchQuery,
        page: parseInt(page),
        results: results.slice(0, 24),
        hasNext,
        totalPages: pagination.length > 0 ? Math.max(...pagination.map(p => p.page)) : 1,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
