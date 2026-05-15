const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const path = require('path');
const fs = require('fs');
const logger = require('./loggerService');

const VOICE = process.env.TTS_VOICE || 'hi-IN-MadhurNeural';
const OUTPUT_DIR = path.join(__dirname, '../logs');

const cleanText = (text) => {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/[*#_`~]/g, '')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\n+/g, '. ')
    .trim()
    .substring(0, 600);
};

const msedgeTTS = async (text) => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const timestamp = Date.now();
  const outputFile = path.join(OUTPUT_DIR, `tts_${timestamp}.mp3`);
  const { audioStream } = await tts.toStream(cleanText(text));
  const chunks = [];
  return new Promise((resolve, reject) => {
    audioStream.on('data', chunk => chunks.push(chunk));
    audioStream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      logger.success('msEdge TTS audio ready', 'VOICE_GEN');
      resolve(buffer);
    });
    audioStream.on('error', reject);
  });
};

const gttsFallback = async (text) => {
  const gtts = require('gtts');
  const timestamp = Date.now();
  const tmpFile = path.join(OUTPUT_DIR, `tts_fallback_${timestamp}.mp3`);
  logger.info('gTTS fallback initiated', 'VOICE_FALLBACK');
  return new Promise((resolve, reject) => {
    const tts = new gtts(cleanText(text), 'hi');
    tts.save(tmpFile, (err) => {
      if (err) return reject(err);
      const buffer = fs.readFileSync(tmpFile);
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      logger.success('gTTS fallback ready', 'VOICE_FALLBACK');
      resolve(buffer);
    });
  });
};

const generateSpeech = async (text) => {
  try {
    logger.info('msEdge TTS initiated', 'VOICE_GEN');
    return await msedgeTTS(text);
  } catch (err) {
    logger.warn(`msEdge failed: ${err.message} — gTTS fallback`, 'VOICE_WARN');
    return await gttsFallback(text);
  }
};

module.exports = { generateSpeech };
