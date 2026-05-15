const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./loggerService');

const PIPER_PATH = process.env.PIPER_PATH || 'piper';
const MODEL_PATH = process.env.PIPER_MODEL_PATH || path.join(__dirname, '../piper_models/hi_IN-pratham-medium.onnx');
const MODEL_CONFIG = process.env.PIPER_MODEL_CONFIG || path.join(__dirname, '../piper_models/hi_IN-pratham-medium.onnx.json');
const OUTPUT_DIR = path.join(__dirname, '../logs');
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

// Check if piper is installed
const checkPiper = () => {
  return new Promise((resolve) => {
    exec(`${PIPER_PATH} --version`, (err) => {
      resolve(!err);
    });
  });
};

// Check if ffmpeg is installed
const checkFFmpeg = () => {
  return new Promise((resolve) => {
    exec(`${FFMPEG_PATH} -version`, (err) => {
      resolve(!err);
    });
  });
};

// Check if model exists
const checkModel = () => {
  return fs.existsSync(MODEL_PATH);
};

// Clean text for TTS
const cleanText = (text) => {
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/[*#_`~]/g, '')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/\n+/g, '. ')
    .replace(/[^\u0000-\u007E\u0900-\u097F\s.,!?]/g, '')
    .trim()
    .substring(0, 500); // Limit to 500 chars for low latency
};

// Generate speech using Piper
const generateSpeech = async (text, outputFormat = 'mp3') => {
  try {
    logger.info('Piper TTS initiated', 'VOICE_GEN');

    const piperAvailable = await checkPiper();
    const modelAvailable = checkModel();

    if (!piperAvailable || !modelAvailable) {
      logger.warn('Piper not available, using fallback', 'VOICE_WARN');
      return await fallbackTTS(text);
    }

    const cleanedText = cleanText(text);
    const timestamp = Date.now();
    const wavFile = path.join(OUTPUT_DIR, `tts_${timestamp}.wav`);
    const mp3File = path.join(OUTPUT_DIR, `tts_${timestamp}.mp3`);

    // Generate WAV using Piper
    await new Promise((resolve, reject) => {
      const piper = spawn(PIPER_PATH, [
        '--model', MODEL_PATH,
        '--config', MODEL_CONFIG,
        '--output_file', wavFile,
        '--length_scale', '0.9',  // Slightly faster speech
        '--noise_scale', '0.667',
        '--noise_w', '0.8'
      ]);

      piper.stdin.write(cleanedText);
      piper.stdin.end();

      let stderr = '';
      piper.stderr.on('data', (data) => { stderr += data.toString(); });

      piper.on('close', (code) => {
        if (code === 0 && fs.existsSync(wavFile)) {
          resolve();
        } else {
          reject(new Error(`Piper failed: ${stderr}`));
        }
      });

      piper.on('error', reject);

      // Timeout 10 seconds
      setTimeout(() => reject(new Error('Piper timeout')), 10000);
    });

    logger.success('Piper WAV generated', 'VOICE_GEN');

    // Convert WAV to MP3 using FFmpeg if available
    if (outputFormat === 'mp3') {
      const ffmpegAvailable = await checkFFmpeg();
      if (ffmpegAvailable) {
        await new Promise((resolve, reject) => {
          exec(
            `${FFMPEG_PATH} -i "${wavFile}" -codec:a libmp3lame -qscale:a 4 "${mp3File}" -y -loglevel quiet`,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
          setTimeout(() => reject(new Error('FFmpeg timeout')), 8000);
        });

        // Cleanup WAV
        if (fs.existsSync(wavFile)) fs.unlinkSync(wavFile);

        if (fs.existsSync(mp3File)) {
          const buffer = fs.readFileSync(mp3File);
          fs.unlinkSync(mp3File);
          logger.success('Piper MP3 ready via FFmpeg', 'VOICE_GEN');
          return { buffer, contentType: 'audio/mpeg' };
        }
      }
    }

    // Return WAV if MP3 conversion failed or not needed
    if (fs.existsSync(wavFile)) {
      const buffer = fs.readFileSync(wavFile);
      fs.unlinkSync(wavFile);
      logger.success('Piper WAV ready', 'VOICE_GEN');
      return { buffer, contentType: 'audio/wav' };
    }

    throw new Error('No audio file generated');

  } catch (error) {
    logger.error(`Piper TTS error: ${error.message}`, 'VOICE_ERROR');
    // Fallback to gTTS if piper fails
    return await fallbackTTS(text);
  }
};

// Fallback: gTTS if Piper not installed
const fallbackTTS = async (text) => {
  try {
    logger.info('Using gTTS fallback', 'VOICE_FALLBACK');
    const gtts = require('gtts');
    const timestamp = Date.now();
    const tmpFile = path.join(OUTPUT_DIR, `tts_fallback_${timestamp}.mp3`);

    const cleanedText = cleanText(text);

    return new Promise((resolve, reject) => {
      const tts = new gtts(cleanedText, 'hi');
      tts.save(tmpFile, (err) => {
        if (err) return reject(err);
        const buffer = fs.readFileSync(tmpFile);
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        logger.success('gTTS fallback audio ready', 'VOICE_FALLBACK');
        resolve({ buffer, contentType: 'audio/mpeg' });
      });
    });
  } catch (error) {
    logger.error(`Fallback TTS error: ${error.message}`, 'VOICE_ERROR');
    throw error;
  }
};

// Get TTS status
const getTTSStatus = async () => {
  const piperAvailable = await checkPiper();
  const modelAvailable = checkModel();
  const ffmpegAvailable = await checkFFmpeg();

  return {
    piper: piperAvailable,
    model: modelAvailable,
    ffmpeg: ffmpegAvailable,
    modelPath: MODEL_PATH,
    ready: piperAvailable && modelAvailable
  };
};

module.exports = { generateSpeech, getTTSStatus, cleanText };
