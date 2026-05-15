const ttsService = require('../services/elevenLabsService');
const logger = require('../services/loggerService');

const textToSpeech = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text required' });

    logger.info('TTS request received', 'VOICE_TTS');
    const buffer = await ttsService.generateSpeech(text);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache'
    });
    res.send(buffer);

  } catch (error) {
    logger.error(`TTS error: ${error.message}`, 'VOICE_ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { textToSpeech };
