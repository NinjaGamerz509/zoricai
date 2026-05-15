const axios = require('axios');
const logger = require('./loggerService');

const tavilySearch = async (query, searchDepth = 'basic') => {
  try {
    logger.info(`Tavily search: ${query}`, 'TAVILY_SEARCH');
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: `${query} 2026`,
      search_depth: searchDepth,
      include_answer: true,
      include_images: false,
      max_results: 5,
      topic: 'news'
    });
    logger.success(`Tavily search complete`, 'TAVILY_SUCCESS');
    return {
      answer: response.data.answer,
      results: response.data.results,
      query
    };
  } catch (error) {
    logger.error(`Tavily error: ${error.message}`, 'TAVILY_ERROR');
    throw error;
  }
};

const getWeather = async (city) => {
  try {
    logger.info(`Weather search: ${city}`, 'WEATHER_SEARCH');
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: `current weather ${city} today 2026`,
      search_depth: 'basic',
      include_answer: true,
      max_results: 3
    });
    return { answer: response.data.answer, city };
  } catch (error) {
    logger.error(`Weather error: ${error.message}`, 'WEATHER_ERROR');
    throw error;
  }
};

const getNews = async (topic = 'latest news') => {
  try {
    logger.info(`News search: ${topic}`, 'NEWS_SEARCH');
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: `${topic} 2026 latest`,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 5,
      topic: 'news'
    });
    return {
      answer: response.data.answer,
      results: response.data.results?.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content?.substring(0, 200)
      }))
    };
  } catch (error) {
    logger.error(`News error: ${error.message}`, 'NEWS_ERROR');
    throw error;
  }
};

module.exports = { tavilySearch, getWeather, getNews };
