const { setCorsHeaders, handleError, fetchHTML, BASE_URL } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { id, slug, url } = req.query;
    let episodeUrl = url || '';

    if (!episodeUrl && id) {
      episodeUrl = `${BASE_URL}/${id}/`;
    }

    if (!episodeUrl) {
      res.status(400).json({
        success: false,
        message: 'Parameter "url", "id", or "slug" is required',
        data: null,
      });
      return;
    }

    const $ = await fetchHTML(episodeUrl);

    // Extract anime title and episode info
    const title = $('.entry-title, h1').first().text().trim() || '';
    const episodeMatch = title.match(/Episode\s*(\d+)/i) || episodeUrl.match(/episode-(\d+)/i);
    const episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : null;

    // Extract anime slug for navigation
    const animeSlugMatch = episodeUrl.match(/anime\/([^\/]+)/) || episodeUrl.match(/([^\/]+)-episode-/);
    const animeSlug = animeSlugMatch ? animeSlugMatch[1] : '';

    // Extract all video servers
    const servers = [];

    // Method 1: Extract from download links / server tabs
    $('.server-item, .server, .mirror, [class*="server"]').each((_, el) => {
      const $el = $(el);
      const serverName = $el.find('.server-name, .name, h3, h4, span').first().text().trim() || 
                         $el.attr('data-server') || 
                         `Server ${servers.length + 1}`;

      // Look for iframe or video source
      const iframe = $el.find('iframe').first();
      const video = $el.find('video source, video').first();
      const link = $el.find('a').first();

      let embedUrl = iframe.attr('src') || 
                     video.attr('src') || 
                     link.attr('href') || 
                     $el.attr('data-src') || 
                     $el.attr('data-link') || '';

      // Look for data attributes
      if (!embedUrl) {
        embedUrl = $el.attr('data-embed') || 
                   $el.attr('data-video') || 
                   $el.attr('data-url') || '';
      }

      if (embedUrl) {
        // Determine quality if available
        const qualityText = $el.find('.quality, .res').first().text().trim() || '';
        const quality = qualityText.match(/(360|480|720|1080)p?/i)?.[0] || 'Auto';

        servers.push({
          name: serverName,
          embedUrl,
          quality,
          type: 'embed',
        });
      }
    });

    // Method 2: Extract from download section / direct links
    $('.download, .dl, [class*="download"]').each((_, el) => {
      const $el = $(el);
      $el.find('a').each((_, linkEl) => {
        const $link = $(linkEl);
        const href = $link.attr('href') || '';
        const linkText = $link.text().trim() || '';

        if (href && (href.includes('.mp4') || href.includes('akamai') || href.includes('cdn'))) {
          const quality = linkText.match(/(360|480|720|1080)p?/i)?.[0] || 'Auto';
          const serverName = linkText.includes('Akamai') ? 'Akamai' : 
                            linkText.includes('Odnoklassniki') ? 'OK.ru' :
                            linkText.includes('StreamSB') ? 'StreamSB' :
                            linkText.includes('Streamtape') ? 'StreamTape' :
                            linkText.includes('Doodstream') ? 'DoodStream' :
                            `Download ${quality}`;

          // Check if this server already exists
          const exists = servers.find(s => s.embedUrl === href);
          if (!exists) {
            servers.push({
              name: serverName,
              embedUrl: href,
              quality,
              type: href.includes('.mp4') ? 'direct' : 'embed',
            });
          }
        }
      });
    });

    // Method 3: Look for iframe directly in content
    if (servers.length === 0) {
      $('iframe').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src) {
          const serverName = $(el).attr('title') || 
                            $(el).closest('[class*="server"]').find('.server-name').first().text().trim() ||
                            `Server ${servers.length + 1}`;

          servers.push({
            name: serverName,
            embedUrl: src,
            quality: 'Auto',
            type: 'embed',
          });
        }
      });
    }

    // Method 4: Extract from script tags (some sites embed video data in JS)
    $('script').each((_, el) => {
      const scriptText = $(el).html() || '';

      // Look for video URL patterns
      const videoPatterns = [
        /["'](https?:\/\/[^"']+\.mp4[^"']*)["']/g,
        /["'](https?:\/\/[^"']*akamai[^"']*)["']/g,
        /["'](https?:\/\/[^"']*stream[^"']*)["']/g,
      ];

      videoPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(scriptText)) !== null) {
          const url = match[1];
          const exists = servers.find(s => s.embedUrl === url);
          if (!exists && url.length > 10) {
            servers.push({
              name: 'Direct',
              embedUrl: url,
              quality: 'Auto',
              type: 'direct',
            });
          }
        }
      });
    });

    // Method 5: Look for video element
    $('video source').each((_, el) => {
      const src = $(el).attr('src') || '';
      const type = $(el).attr('type') || '';
      if (src) {
        const exists = servers.find(s => s.embedUrl === src);
        if (!exists) {
          servers.push({
            name: 'Direct Video',
            embedUrl: src,
            quality: 'Auto',
            type: 'direct',
          });
        }
      }
    });

    // Extract episode list for navigation
    const episodeList = [];
    $('.eplister li, .episode-list li, .eps li').each((_, el) => {
      const $el = $(el);
      const epLink = $el.find('a').first().attr('href') || '';
      const epTitle = $el.find('.epl-title, .title, a').first().text().trim() || '';
      const epNumberMatch = epTitle.match(/Episode\s*(\d+)/i) || epLink.match(/episode-(\d+)/i);
      const epNumber = epNumberMatch ? parseInt(epNumberMatch[1]) : null;

      if (epLink && epNumber) {
        episodeList.push({
          number: epNumber,
          title: epTitle,
          link: epLink,
          isCurrent: epLink === episodeUrl || epLink.includes(episodeUrl.split('/').pop() || ''),
        });
      }
    });

    episodeList.sort((a, b) => a.number - b.number);

    // Find prev/next episodes
    const currentIndex = episodeList.findIndex(ep => ep.isCurrent);
    const prevEpisode = currentIndex > 0 ? episodeList[currentIndex - 1] : null;
    const nextEpisode = currentIndex < episodeList.length - 1 ? episodeList[currentIndex + 1] : null;

    // Group servers by name for cleaner UI
    const groupedServers = [];
    servers.forEach(server => {
      const existing = groupedServers.find(s => s.name === server.name);
      if (existing) {
        existing.links.push({ url: server.embedUrl, quality: server.quality, type: server.type });
      } else {
        groupedServers.push({
          name: server.name,
          links: [{ url: server.embedUrl, quality: server.quality, type: server.type }],
        });
      }
    });

    // Sort links by quality
    groupedServers.forEach(server => {
      server.links.sort((a, b) => {
        const qualityOrder = { '1080': 4, '720': 3, '480': 2, '360': 1, 'Auto': 0 };
        const qa = qualityOrder[a.quality.replace('p', '')] || 0;
        const qb = qualityOrder[b.quality.replace('p', '')] || 0;
        return qb - qa;
      });
    });

    res.status(200).json({
      success: true,
      data: {
        title,
        episodeNumber,
        animeSlug,
        servers: groupedServers,
        episodeList,
        prevEpisode,
        nextEpisode,
        currentUrl: episodeUrl,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
