const ytsr = require('ytsr');
const ytdl = require('ytdl-core');
const logger = require('./loggerService');

const searchVideos = async (query, limit = 5) => {
  try {
    logger.info(`YouTube search: ${query}`, 'YT_SEARCH');
    const filters = await ytsr.getFilters(query);
    const filter = filters.get('Type')?.get('Video');
    const searchOptions = { limit, gl: 'IN', hl: 'en' };
    if (filter?.url) searchOptions.requestOptions = {};
    const results = await ytsr(filter?.url || query, searchOptions);
    const videos = results.items
      .filter(item => item.type === 'video')
      .map(v => ({
        videoId: v.id,
        title: v.title,
        author: v.author?.name || 'Unknown',
        duration: v.duration,
        thumbnail: v.bestThumbnail?.url || v.thumbnails?.[0]?.url,
        url: v.url,
        views: v.views,
        uploadedAt: v.uploadedAt
      }));
    logger.success(`YouTube found ${videos.length} results`, 'YT_SEARCH');
    return videos;
  } catch (error) {
    logger.error(`YouTube search error: ${error.message}`, 'YT_ERROR');
    throw error;
  }
};

const getVideoInfo = async (videoId) => {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getBasicInfo(url);
    return {
      videoId,
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails?.slice(-1)[0]?.url,
      url,
      description: info.videoDetails.shortDescription?.substring(0, 200)
    };
  } catch (error) {
    logger.error(`YouTube info error: ${error.message}`, 'YT_ERROR');
    throw error;
  }
};

const getVideoIdFromUrl = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const searchChannelVideos = async (channelName, limit = 5) => {
  try {
    logger.info(`Channel search: ${channelName}`, 'YT_CHANNEL');
    const query = `${channelName} latest videos`;
    const results = await searchVideos(query, limit);
    return results;
  } catch (error) {
    logger.error(`Channel search error: ${error.message}`, 'YT_ERROR');
    throw error;
  }
};

const getTrending = async (limit = 5) => {
  try {
    logger.info('Fetching trending videos', 'YT_TRENDING');
    const results = await searchVideos('trending India today', limit);
    return results;
  } catch (error) {
    logger.error(`Trending error: ${error.message}`, 'YT_ERROR');
    throw error;
  }
};

module.exports = { searchVideos, getVideoInfo, getVideoIdFromUrl, searchChannelVideos, getTrending };
