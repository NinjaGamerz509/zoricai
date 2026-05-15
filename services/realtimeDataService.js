const axios = require('axios');
const logger = require('./loggerService');
const tavilyService = require('./tavilyService');

// Crypto prices
const getCryptoPrice = async (coin = 'bitcoin') => {
  try {
    logger.info(`Crypto price: ${coin}`, 'CRYPTO');
    const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
      params: { ids: coin.toLowerCase(), vs_currencies: 'inr,usd' },
      timeout: 5000
    });
    const data = res.data[coin.toLowerCase()];
    if (!data) throw new Error('Coin not found');
    return { coin, inr: data.inr, usd: data.usd };
  } catch (error) {
    logger.error(`Crypto error: ${error.message}`, 'CRYPTO_ERROR');
    throw error;
  }
};

// Stock price via Tavily search
const getStockPrice = async (company) => {
  try {
    logger.info(`Stock search: ${company}`, 'STOCK');
    const result = await tavilyService.tavilySearch(`${company} stock price today NSE BSE`);
    return result.answer || `${company} ka stock price: Check karo NSE/BSE pe`;
  } catch (error) {
    logger.error(`Stock error: ${error.message}`, 'STOCK_ERROR');
    throw error;
  }
};

// Cricket scores via Tavily
const getCricketScore = async () => {
  try {
    logger.info('Cricket score fetch', 'CRICKET');
    const result = await tavilyService.tavilySearch('live cricket score today match');
    return result.answer || 'Abhi koi live match nahi chal raha';
  } catch (error) {
    logger.error(`Cricket error: ${error.message}`, 'CRICKET_ERROR');
    throw error;
  }
};

// Flight status via Tavily
const getFlightStatus = async (flightNo) => {
  try {
    logger.info(`Flight status: ${flightNo}`, 'FLIGHT');
    const result = await tavilyService.tavilySearch(`flight status ${flightNo} today live`);
    return result.answer || `Flight ${flightNo} ki info nahi mili`;
  } catch (error) {
    logger.error(`Flight error: ${error.message}`, 'FLIGHT_ERROR');
    throw error;
  }
};

// Train status via Tavily
const getTrainStatus = async (trainNo) => {
  try {
    logger.info(`Train status: ${trainNo}`, 'TRAIN');
    const result = await tavilyService.tavilySearch(`train ${trainNo} live status running today`);
    return result.answer || `Train ${trainNo} ki info nahi mili`;
  } catch (error) {
    logger.error(`Train error: ${error.message}`, 'TRAIN_ERROR');
    throw error;
  }
};

// Currency converter
const convertCurrency = async (amount, from, to) => {
  try {
    logger.info(`Currency convert: ${amount} ${from} to ${to}`, 'CURRENCY');
    const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`, { timeout: 5000 });
    const rate = res.data.rates[to.toUpperCase()];
    if (!rate) throw new Error('Currency not found');
    const converted = (amount * rate).toFixed(2);
    return { from, to, amount, converted, rate };
  } catch (error) {
    logger.error(`Currency error: ${error.message}`, 'CURRENCY_ERROR');
    throw error;
  }
};

// IPL/Sports scores
const getSportsScore = async (sport = 'IPL') => {
  try {
    const result = await tavilyService.tavilySearch(`${sport} live score today 2026`);
    return result.answer || `${sport} score nahi mila`;
  } catch (error) {
    throw error;
  }
};

module.exports = { getCryptoPrice, getStockPrice, getCricketScore, getFlightStatus, getTrainStatus, convertCurrency, getSportsScore };
