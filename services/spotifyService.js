const SpotifyWebApi = require('spotify-web-api-node');
const logger = require('./loggerService');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

const setTokens = (accessToken, refreshToken) => {
  spotifyApi.setAccessToken(accessToken);
  if (refreshToken) spotifyApi.setRefreshToken(refreshToken);
};

const refreshAccessToken = async () => {
  try {
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body.access_token);
    logger.info('Spotify token refreshed', 'SPOTIFY_REFRESH');
    return data.body.access_token;
  } catch (error) {
    logger.error(`Spotify refresh error: ${error.message}`, 'SPOTIFY_ERROR');
    throw error;
  }
};

const withAutoRefresh = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    const status = error?.statusCode || error?.response?.status;
    if (status === 401) {
      try {
        await refreshAccessToken();
        return await fn();
      } catch (refreshError) {
        throw refreshError;
      }
    }
    throw error;
  }
};

const getActiveDevice = async () => {
  try {
    const data = await spotifyApi.getMyDevices();
    const devices = data.body.devices;
    if (!devices || devices.length === 0) return null;
    // Active device pehle prefer karo
    const active = devices.find(d => d.is_active);
    return active || devices[0];
  } catch (error) {
    return null;
  }
};

const searchAndPlay = async (query) => {
  return withAutoRefresh(async () => {
    logger.info(`Spotify search: ${query}`, 'MUSIC_CMD');
    const searchResult = await spotifyApi.searchTracks(query, { limit: 1 });
    const track = searchResult.body.tracks?.items?.[0];
    if (!track) throw new Error('Track not found on Spotify');

    // Device check karo
    const device = await getActiveDevice();
    const playOptions = { uris: [track.uri] };
    if (device) playOptions.device_id = device.id;

    await spotifyApi.play(playOptions);
    logger.success(`Playing: ${track.name} - ${track.artists[0].name}`, 'MUSIC_CMD');
    return {
      name: track.name,
      artist: track.artists[0].name,
      uri: track.uri,
      albumArt: track.album.images[0]?.url
    };
  });
};

const pausePlayback = async () => {
  return withAutoRefresh(async () => {
    await spotifyApi.pause();
    logger.info('Spotify paused', 'MUSIC_CMD');
  });
};

const resumePlayback = async () => {
  return withAutoRefresh(async () => {
    await spotifyApi.play();
    logger.info('Spotify resumed', 'MUSIC_CMD');
  });
};

const nextTrack = async () => {
  return withAutoRefresh(async () => {
    await spotifyApi.skipToNext();
    logger.info('Spotify next track', 'MUSIC_CMD');
  });
};

const prevTrack = async () => {
  return withAutoRefresh(async () => {
    await spotifyApi.skipToPrevious();
    logger.info('Spotify previous track', 'MUSIC_CMD');
  });
};

const setVolume = async (volume) => {
  return withAutoRefresh(async () => {
    await spotifyApi.setVolume(volume);
    logger.info(`Spotify volume: ${volume}%`, 'MUSIC_CMD');
  });
};

const getCurrentTrack = async () => {
  if (!spotifyApi.getAccessToken()) return null;
  try {
    return await withAutoRefresh(async () => {
      const data = await spotifyApi.getMyCurrentPlayingTrack();
      if (!data.body || !data.body.item) return null;
      const track = data.body.item;
      return {
        name: track.name,
        artist: track.artists[0].name,
        albumArt: track.album.images[0]?.url,
        isPlaying: data.body.is_playing,
        duration: track.duration_ms,
        progress: data.body.progress_ms
      };
    });
  } catch {
    return null;
  }
};

const getAuthUrl = () => {
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
    'user-library-read'
  ];
  return spotifyApi.createAuthorizeURL(scopes, 'zoric-state');
};

module.exports = {
  spotifyApi, setTokens, refreshAccessToken,
  searchAndPlay, pausePlayback, resumePlayback,
  nextTrack, prevTrack, setVolume, getCurrentTrack, getAuthUrl
};
