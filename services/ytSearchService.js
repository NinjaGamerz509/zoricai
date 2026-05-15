const axios = require('axios');
const logger = require('./loggerService');

// YouTube search using invidious public API (no API key needed!)
const INVIDIOUS_INSTANCES = [
  'https://invidious.io',
  'https://vid.puffyan.us',
  'https://invidious.slipfox.xyz',
  'https://yt.artemislena.eu'
];

const searchYouTube = async (query) => {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      logger.info(`YouTube search: ${query}`, 'YT_SEARCH');
      const res = await axios.get(`${instance}/api/v1/search`, {
        params: { q: query, type: 'video', page: 1 },
        timeout: 5000
      });
      const video = res.data?.[0];
      if (video) {
        logger.success(`YouTube found: ${video.title}`, 'YT_SEARCH');
        return {
          title: video.title,
          videoId: video.videoId,
          url: `https://www.youtube.com/watch?v=${video.videoId}`,
          author: video.author,
          thumbnail: video.videoThumbnails?.[0]?.url
        };
      }
    } catch (err) {
      logger.warn(`Invidious instance failed: ${instance}`, 'YT_WARN');
      continue;
    }
  }
  throw new Error('YouTube search failed on all instances');
};

module.exports = { searchYouTube };
