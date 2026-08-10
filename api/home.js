const { setCorsHeaders, handleError, fetchHTML, extractAnimeList, BASE_URL } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const $ = await fetchHTML(BASE_URL);

    // Extract latest releases
    const latestReleases = extractAnimeList($, '.listupd, .latest-releases, .postbody', '.bs, .animepost, .item, article');

    // Extract ongoing anime (usually in a specific section)
    let ongoingAnime = [];
    $('.ongoing, .status-ongoing, [class*="ongoing"]').each((_, section) => {
      const items = extractAnimeList($(section).parent(), '', '.bs, .animepost, .item, article');
      ongoingAnime.push(...items);
    });

    // If no specific ongoing section found, filter from latest
    if (ongoingAnime.length === 0) {
      ongoingAnime = latestReleases.filter(a => a.status === 'Ongoing').slice(0, 12);
    }

    // Extract popular/trending (usually featured or recommended)
    let popularAnime = [];
    $('.trending, .popular, .featured, .recommendation, [class*="popular"], [class*="trending"]').each((_, section) => {
      const items = extractAnimeList($(section).parent(), '', '.bs, .animepost, .item, article');
      popularAnime.push(...items);
    });

    // Deduplicate
    const seen = new Set();
    popularAnime = popularAnime.filter(a => {
      if (seen.has(a.linkId)) return false;
      seen.add(a.linkId);
      return true;
    });

    // If no popular section, use first 8 from latest
    if (popularAnime.length === 0) {
      popularAnime = latestReleases.slice(0, 8);
    }

    // Extract genres from the page for the genre list
    const genres = [];
    $('.genre-list a, .genres a, [class*="genre"] a').each((_, el) => {
      const genreName = $(el).text().trim();
      const genreLink = $(el).attr('href') || '';
      const genreId = genreLink.replace(/\/$/, '').split('/').pop() || '';
      if (genreName && genreId && !genres.find(g => g.id === genreId)) {
        genres.push({ name: genreName, id: genreId, link: genreLink });
      }
    });

    // Extract featured/banner anime for hero section
    const featuredAnime = [];
    $('.hero, .banner, .featured-slider, .owl-carousel').first().find('.item, .slide, article').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first().attr('href') || '';
      const linkId = link.replace(/\/$/, '').split('/').pop() || '';
      const imgEl = $el.find('img').first();
      const image = imgEl.attr('src') || imgEl.attr('data-src') || '';
      const title = imgEl.attr('title') || imgEl.attr('alt') || $el.find('h2, h3, .title').first().text().trim() || '';
      const synopsis = $el.find('.synopsis, .desc, .summary, p').first().text().trim() || '';

      if (title) {
        featuredAnime.push({ title, link, linkId, image, synopsis });
      }
    });

    // If no featured section, use first 5 from popular
    if (featuredAnime.length === 0 && popularAnime.length > 0) {
      featuredAnime.push(...popularAnime.slice(0, 5).map(a => ({
        title: a.title,
        link: a.link,
        linkId: a.linkId,
        image: a.image,
        synopsis: '',
      })));
    }

    res.status(200).json({
      success: true,
      data: {
        featured: featuredAnime.slice(0, 5),
        latest: latestReleases.slice(0, 24),
        ongoing: ongoingAnime.slice(0, 12),
        popular: popularAnime.slice(0, 12),
        genres: genres.slice(0, 20),
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
