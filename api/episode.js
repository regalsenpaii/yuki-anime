const { CONFIG, setCorsHeaders, handleError, fetchHTML } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { id, slug, url } = req.query;
    let episodeUrl = url || '';

    if (!episodeUrl && id) {
      episodeUrl = CONFIG.BASE_URL + `/${id}/`;
    }

    if (!episodeUrl) {
      res.status(400).json({ success: false, message: 'Parameter "url", "id", or "slug" is required', data: null });
      return;
    }

    const $ = await fetchHTML(episodeUrl);
    const S = CONFIG.SELECTORS.episode;

    const title = $(S.title).first().text().trim() || '';
    const episodeMatch = title.match(/Episode\s*(\d+)/i) || episodeUrl.match(/episode[-_](\d+)/i) || episodeUrl.match(/-(\d+)\/?$/);
    const episodeNumber = episodeMatch ? parseInt(episodeMatch[1]) : null;

    const animeSlugMatch = episodeUrl.match(/anime\/([^\/]+)/) || episodeUrl.match(/([^\/]+)-episode[-_]/);
    const animeSlug = animeSlugMatch ? animeSlugMatch[1] : '';

    // ===== AGGRESSIVE VIDEO EXTRACTION =====
    const servers = [];
    const serverNames = new Set();

    // Method 1: Direct iframe in player containers
    const iframeSelectors = [
      '.player-embed iframe', '.videoplayer iframe', '.video iframe', '.player iframe',
      '.embed-responsive iframe', '[class*="player"] iframe', '[class*="video"] iframe',
      'iframe[src*="embed"]', 'iframe[src*="player"]', 'iframe[src*="stream"]',
      'iframe[src*="video"]', 'iframe[src*="watch"]', 'iframe'
    ];

    for (const sel of iframeSelectors) {
      $(sel).each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src && !serverNames.has(src)) {
          serverNames.add(src);
          let name = 'Server ' + (servers.length + 1);
          if (src.includes('streamsb')) name = 'StreamSB';
          else if (src.includes('dood')) name = 'DoodStream';
          else if (src.includes('streamtape')) name = 'StreamTape';
          else if (src.includes('yourupload')) name = 'YourUpload';
          else if (src.includes('mega')) name = 'Mega';
          else if (src.includes('mp4upload')) name = 'MP4Upload';
          else if (src.includes('vidstack')) name = 'Vidstack';
          else if (src.includes('plyr')) name = 'Plyr';

          servers.push({ name, embedUrl: src, quality: 'Auto', type: 'embed' });
        }
      });
    }

    // Method 2: Server tabs/buttons with data attributes
    const serverContainerSelectors = [
      '.server-item', '.server', '.mirror', '[class*="server"]', '[class*="mirror"]',
      '.source', '.player-source', '.tab-server', '.server-list', '.video-source'
    ];

    for (const sel of serverContainerSelectors) {
      $(sel).each((_, el) => {
        const $el = $(el);
        let name = $el.find('.server-name, .name, h3, h4, span, [class*="name"]').first().text().trim() ||
                   $el.attr('data-server') || $el.attr('data-name') || `Server ${servers.length + 1}`;

        let embedUrl = $el.attr('data-src') || $el.attr('data-embed') || $el.attr('data-video') ||
                       $el.attr('data-url') || $el.attr('data-link') || '';

        if (!embedUrl) {
          const iframe = $el.find('iframe').first();
          if (iframe.length) embedUrl = iframe.attr('src') || iframe.attr('data-src') || '';
        }

        if (!embedUrl) {
          const link = $el.find('a').first();
          if (link.length) embedUrl = link.attr('href') || '';
        }

        if (embedUrl && !serverNames.has(embedUrl)) {
          serverNames.add(embedUrl);
          const quality = ($el.find('.quality, .res').first().text().trim().match(/(360|480|720|1080)p?/i)?.[0]) || 'Auto';
          servers.push({ name, embedUrl, quality, type: 'embed' });
        }
      });
    }

    // Method 3: Download links section
    const downloadSelectors = ['.download', '.dl', '[class*="download"]', '[class*="ddl"]', '.link-download'];
    for (const sel of downloadSelectors) {
      $(sel).each((_, el) => {
        $(el).find('a').each((_, linkEl) => {
          const href = $(linkEl).attr('href') || '';
          const text = $(linkEl).text().trim() || '';
          if (href && !serverNames.has(href)) {
            serverNames.add(href);
            const quality = (text.match(/(360|480|720|1080)p?/i)?.[0]) || 'Auto';
            let name = 'Download';
            if (text.includes('Akamai')) name = 'Akamai';
            else if (text.includes('Odnoklassniki') || text.includes('OK')) name = 'OK.ru';
            else if (text.includes('StreamSB')) name = 'StreamSB';
            else if (text.includes('Streamtape')) name = 'StreamTape';
            else if (text.includes('Dood')) name = 'DoodStream';
            else if (text.includes('YourUpload')) name = 'YourUpload';
            else if (text.includes('Mega')) name = 'Mega';
            else if (href.includes('.mp4')) name = 'Direct MP4';

            servers.push({ name, embedUrl: href, quality, type: href.includes('.mp4') ? 'direct' : 'embed' });
          }
        });
      });
    }

    // Method 4: Extract from script tags (JSON data, video URLs)
    $('script').each((_, el) => {
      const scriptText = $(el).html() || '';

      // Look for iframe src patterns
      const patterns = [
        /["'](https?:\/\/[^"']+\.mp4[^"']*)["']/g,
        /["'](https?:\/\/[^"']*akamai[^"']*)["']/g,
        /["'](https?:\/\/[^"']*stream[^"']*)["']/g,
        /["'](https?:\/\/[^"']*embed[^"']*)["']/g,
        /["'](https?:\/\/[^"']*player[^"']*)["']/g,
        /src:\\s*["']([^"']+)["']/g,
        /url:\\s*["']([^"']+)["']/g,
        /file:\\s*["']([^"']+)["']/g,
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(scriptText)) !== null) {
          const url = match[1];
          if (url && url.startsWith('http') && !serverNames.has(url) && url.length > 15) {
            serverNames.add(url);
            let name = 'Direct';
            if (url.includes('streamsb')) name = 'StreamSB';
            else if (url.includes('dood')) name = 'DoodStream';
            else if (url.includes('streamtape')) name = 'StreamTape';
            else if (url.includes('yourupload')) name = 'YourUpload';

            servers.push({ name, embedUrl: url, quality: 'Auto', type: url.includes('.mp4') ? 'direct' : 'embed' });
          }
        }
      });
    });

    // Method 5: Video element
    $('video source, video').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !serverNames.has(src)) {
        serverNames.add(src);
        servers.push({ name: 'Direct Video', embedUrl: src, quality: 'Auto', type: 'direct' });
      }
    });

    // Method 6: Look for anchor tags with video-related hrefs
    $('a[href*="embed"], a[href*="stream"], a[href*="video"], a[href*="player"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href && !serverNames.has(href)) {
        serverNames.add(href);
        servers.push({ name: $(el).text().trim() || 'Link', embedUrl: href, quality: 'Auto', type: 'embed' });
      }
    });

    // ===== EPISODE LIST =====
    const episodeList = [];
    $(S.episodeList).each((_, el) => {
      const $el = $(el);
      const epLink = $el.find('a').first().attr('href') || '';
      const epTitle = $el.find('.epl-title, .title, a').first().text().trim() || '';
      const epNumberMatch = epTitle.match(/Episode\s*(\d+)/i) || epLink.match(/episode[-_](\d+)/i) || epLink.match(/-(\d+)\/?$/);
      const epNumber = epNumberMatch ? parseInt(epNumberMatch[1]) : null;

      if (epLink && epNumber) {
        episodeList.push({
          number: epNumber, title: epTitle, link: epLink,
          isCurrent: epLink === episodeUrl || episodeUrl.includes(epLink.split('/').pop() || ''),
        });
      }
    });
    episodeList.sort((a, b) => a.number - b.number);

    const currentIndex = episodeList.findIndex(ep => ep.isCurrent);
    const prevEpisode = currentIndex > 0 ? episodeList[currentIndex - 1] : null;
    const nextEpisode = currentIndex < episodeList.length - 1 ? episodeList[currentIndex + 1] : null;

    // Group servers by name
    const groupedServers = [];
    servers.forEach(server => {
      const existing = groupedServers.find(s => s.name === server.name);
      if (existing) {
        existing.links.push({ url: server.embedUrl, quality: server.quality, type: server.type });
      } else {
        groupedServers.push({ name: server.name, links: [{ url: server.embedUrl, quality: server.quality, type: server.type }] });
      }
    });

    // Sort by quality
    groupedServers.forEach(s => {
      s.links.sort((a, b) => {
        const order = { '1080': 4, '720': 3, '480': 2, '360': 1, 'Auto': 0 };
        return (order[b.quality.replace('p', '')] || 0) - (order[a.quality.replace('p', '')] || 0);
      });
    });

    res.status(200).json({
      success: true,
      data: {
        title, episodeNumber, animeSlug,
        servers: groupedServers,
        episodeList, prevEpisode, nextEpisode,
        currentUrl: episodeUrl,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
