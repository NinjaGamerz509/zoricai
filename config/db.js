const mongoose = require('mongoose');
const logger = require('../services/loggerService');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`MongoDB Atlas Connected: ${conn.connection.host}`, 'DB_CONNECT');
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${error.message}`, 'DB_ERROR');
    process.exit(1);
  }
};

module.exports = connectDB;
