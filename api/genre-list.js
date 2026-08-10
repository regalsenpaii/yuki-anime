const { CONFIG, setCorsHeaders, handleError, fetchHTML } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const $ = await fetchHTML(CONFIG.BASE_URL + '/daftar-genre/');
    const S = CONFIG.SELECTORS.genreList;

    const genres = [];
    for (const containerSel of S.container.split(', ')) {
      $(containerSel).find(S.items).each((_, el) => {
        const name = $(el).text().trim();
        const link = $(el).attr('href') || '';
        const id = link.replace(/\/$/, '').split('/').pop() || '';
        if (name && id && !genres.find(g => g.id === id)) genres.push({ name, id, link });
      });
    }

    genres.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({ success: true, data: { genres, total: genres.length } });
  } catch (error) {
    handleError(res, error);
  }
};
