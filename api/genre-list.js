const { setCorsHeaders, handleError, fetchHTML, BASE_URL } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const $ = await fetchHTML(`${BASE_URL}/daftar-genre/`);

    const genres = [];
    $('.genre-list a, .genres a, .list-genre a, [class*="genre"] a').each((_, el) => {
      const $el = $(el);
      const name = $el.text().trim();
      const link = $el.attr('href') || '';
      const id = link.replace(/\/$/, '').split('/').pop() || '';

      if (name && id && !genres.find(g => g.id === id)) {
        genres.push({ name, id, link });
      }
    });

    // Sort alphabetically
    genres.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({
      success: true,
      data: {
        genres,
        total: genres.length,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
