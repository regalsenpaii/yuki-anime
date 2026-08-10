const { CONFIG, setCorsHeaders, handleError, fetchHTML, extractAnimeList } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const $ = await fetchHTML(CONFIG.BASE_URL + '/');
    const S = CONFIG.SELECTORS.home;

    // Extract latest releases
    const latest = extractAnimeList($, [S.latestContainer], S.latestItems.split(', '));

    // Extract ongoing
    let ongoing = [];
    for (const containerSel of S.ongoingContainer.split(', ')) {
      $(containerSel).each((_, section) => {
        const items = extractAnimeList($, [$(section).parent()], S.ongoingItems.split(', '));
        ongoing.push(...items);
      });
    }
    if (ongoing.length === 0) ongoing = latest.filter(a => a.status === 'Ongoing').slice(0, 12);

    // Extract popular/trending
    let popular = [];
    for (const containerSel of S.popularContainer.split(', ')) {
      $(containerSel).each((_, section) => {
        const items = extractAnimeList($, [$(section).parent()], S.popularItems.split(', '));
        popular.push(...items);
      });
    }
    if (popular.length === 0) popular = latest.slice(0, 8);

    // Deduplicate
    const seen = new Set();
    popular = popular.filter(a => { if (seen.has(a.linkId)) return false; seen.add(a.linkId); return true; });

    // Extract genres
    const genres = [];
    for (const containerSel of S.genreContainer.split(', ')) {
      $(containerSel).find(S.genreItems).each((_, el) => {
        const name = $(el).text().trim();
        const link = $(el).attr('href') || '';
        const id = link.replace(/\/$/, '').split('/').pop() || '';
        if (name && id && !genres.find(g => g.id === id)) genres.push({ name, id, link });
      });
    }

    // Extract featured
    const featured = [];
    for (const containerSel of S.featuredContainer.split(', ')) {
      $(containerSel).first().find(S.featuredItems).each((_, el) => {
        const $el = $(el);
        const link = $el.find('a').first().attr('href') || '';
        const linkId = link.replace(/\/$/, '').split('/').pop() || '';
        const imgEl = $el.find('img').first();
        const image = imgEl.attr('src') || imgEl.attr('data-src') || '';
        const title = imgEl.attr('title') || imgEl.attr('alt') || $el.find('h2, h3, .title').first().text().trim() || '';
        const synopsis = $el.find('.synopsis, .desc, .summary, p').first().text().trim() || '';
        if (title) featured.push({ title, link, linkId, image, synopsis });
      });
    }
    if (featured.length === 0 && popular.length > 0) {
      featured.push(...popular.slice(0, 5).map(a => ({ title: a.title, link: a.link, linkId: a.linkId, image: a.image, synopsis: '' })));
    }

    res.status(200).json({
      success: true,
      data: {
        featured: featured.slice(0, 5),
        latest: latest.slice(0, 24),
        ongoing: ongoing.slice(0, 12),
        popular: popular.slice(0, 12),
        genres: genres.slice(0, 30),
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
