const Groq = require('groq-sdk');
const logger = require('./loggerService');
const memoryFileService = require('./memoryFileService');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODELS = [
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
  'llama-3.3-70b-versatile',
];

// ── Emotion detector ─────────────────────────────────────────────────────────
const detectEmotion = (message) => {
  const m = message.toLowerCase();
  if (/frustrated|kaam nahi|bakwaas|bkwas|ullu|bekar|chutiya|sala|yaar kya|kya yaar|nahi chal|problem|issue|error|galat/.test(m)) return 'frustrated';
  if (/happy|khush|mast|badhiya|awesome|great|perfect|love|❤|😊|🔥|💪/.test(m)) return 'happy';
  if (/sad|dukhi|bura|akela|pareshan|tension|stress|depressed|feel nahi|thaka/.test(m)) return 'sad';
  if (/code|work|focus|kaam|project|deadline|study|padh/.test(m)) return 'focused';
  if (/wow|amazing|unbelievable|yaar sun|suno|bhai sun|fire|🔥|💥/.test(m)) return 'excited';
  return 'neutral';
};

// ── Language detector ────────────────────────────────────────────────────────
const detectLanguage = (message) => {
  const gujaratiChars = /[\u0A80-\u0AFF]/;
  const hindiChars = /[\u0900-\u097F]/;
  if (gujaratiChars.test(message)) return 'gujarati';
  if (hindiChars.test(message)) return 'hindi';
  if (/\b(nahi|hai|kya|bhai|yaar|haan|theek|kar|dede|bata|chala|dekh)\b/i.test(message)) return 'hinglish';
  return 'english';
};

// ── Emotion based tone ───────────────────────────────────────────────────────
const getEmotionTone = (emotion) => {
  switch (emotion) {
    case 'frustrated': return 'User thoda frustrated lag raha hai. Soft, patient aur helpful tone rakho. Seedha solution do, zyada bakwaas mat karo.';
    case 'sad': return 'User sad ya stressed lag raha hai. Empathetic aur gentle raho. Pehle feelings acknowledge karo, phir help karo. Thoda warm raho.';
    case 'happy': return 'User khush hai! Energetic aur fun tone rakho. Thoda casual aur enthusiastic raho.';
    case 'focused': return 'User kaam mein focused hai. Concise, technical aur to-the-point raho. Extra chatter avoid karo.';
    case 'excited': return 'User excited hai! Match their energy. Enthusiastic raho.';
    default: return '';
  }
};

// ── Language tone ────────────────────────────────────────────────────────────
const getLanguageTone = (lang) => {
  switch (lang) {
    case 'gujarati': return 'User Gujarati mein baat kar raha hai. Gujarati mein respond karo jab bhi possible ho, ya Gujarati-English mix mein.';
    case 'hindi': return 'User Hindi mein baat kar raha hai. Pure Hindi mein respond karo.';
    case 'hinglish': return 'Hinglish mein respond karo (Hindi + English mix).';
    default: return 'English mein respond karo.';
  }
};

const getSystemPrompt = (emotion = 'neutral', language = 'hinglish') => {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata', hour12: true };
  const date = now.toLocaleDateString('en-IN', { ...options, day: 'numeric', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('en-IN', { ...options, hour: '2-digit', minute: '2-digit' });
  const day = now.toLocaleDateString('en-IN', { ...options, weekday: 'long' });

  const memoryContext = memoryFileService.buildMemoryContext();
  const emotionTone = getEmotionTone(emotion);
  const langTone = getLanguageTone(language);

  return `Tu ZORIC hai — ek advanced, intelligent aur loyal AI assistant. Bilkul JARVIS ki tarah.
Tera owner ne tujhe banaya hai apne personal use ke liye.
Tu smart hai, thoda witty bhi hai lekin hamesha helpful.

CURRENT DATE & TIME:
- Aaj ka din: ${day}
- Date: ${date}
- Time: ${time} IST
- Abhi 2026 chal raha hai — kabhi 2024 mat bolna!

${langTone}

${emotionTone ? `TONE INSTRUCTION:\n${emotionTone}\n` : ''}

${memoryContext ? `━━━ USER MEMORY (JARVIS DATABASE) ━━━\n${memoryContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nIn memories ke basis pe user ko personally jaanta hai tu.` : ''}

Search karna ho toh [SEARCH: query] format use kar.
Weather ke liye [WEATHER: city] format.
News ke liye [NEWS: topic] format.
Har response mein confident aur helpful reh.`;
};

const chat = async (messages, modelIndex = 0, emotion = 'neutral', language = 'hinglish') => {
  if (modelIndex >= MODELS.length) throw new Error('Saare models rate limited hain! Thodi der baad try karo boss.');
  const model = MODELS[modelIndex];

  try {
    logger.info(`Groq API call: ${model} [${emotion}/${language}]`, 'AI_REQUEST');
    const start = Date.now();

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: getSystemPrompt(emotion, language) },
        ...messages
      ],
      model,
      temperature: emotion === 'frustrated' ? 0.5 : emotion === 'happy' ? 0.8 : 0.7,
      max_tokens: 1024,
    });

    const responseTime = Date.now() - start;
    logger.success(`Groq response in ${responseTime}ms [${model}]`, 'AI_RESPONSE');

    return {
      content: completion.choices[0]?.message?.content || '',
      responseTime,
      model,
      emotion,
      language,
    };

  } catch (error) {
    const isRateLimit = error?.status === 429 || error?.message?.includes('rate') || error?.message?.includes('limit');
    if (isRateLimit) {
      logger.warn(`Rate limit on ${model} — switching`, 'MODEL_FALLBACK');
      return await chat(messages, modelIndex + 1, emotion, language);
    }
    logger.error(`Groq error [${model}]: ${error.message}`, 'GROQ_ERROR');
    throw error;
  }
};

module.exports = { chat, detectEmotion, detectLanguage };
