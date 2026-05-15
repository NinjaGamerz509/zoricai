const memoryFileService = require('../services/memoryFileService');
const { detectEmotion, detectLanguage } = require('../services/groqService');
const Chat = require('../models/Chat');
const Memory = require('../models/Memory');
const agentService = require('../services/agentService');
const youtubeService = require('../services/youtubeService');
const realtimeDataService = require('../services/realtimeDataService');
const browserController = require('./browserController');
const googleService = require('../services/googleService');
const notificationService = require('../services/notificationService');
const User = require('../models/User');
const { Journal, Habit, Expense, Mood } = require('../models/NewModels');
const logger = require('../services/loggerService');

const sendMessage = async (req, res) => {
  try {
    const { message, socketId } = req.body;
    const userId = req.userId;
    const io = req.app.get('io');
    const lowerMsg = message.toLowerCase();

    logger.info(`User message: ${message.substring(0, 50)}...`, 'CHAT_MSG');
    await Chat.create({ userId, role: 'user', message });

    // ==================== YOUTUBE COMMANDS ====================
    const musicKeywords = ['play', 'chala', 'chalao', 'bajao', 'baja', 'suno', 'laga', 'lagao', 'video chala', 'dikha'];
    const isMusicRequest = musicKeywords.some(kw => lowerMsg.includes(kw));

    if (isMusicRequest) {
      // YouTube URL direct play
      const urlMatch = message.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+)/);
      if (urlMatch) {
        const videoId = youtubeService.getVideoIdFromUrl(urlMatch[1]);
        if (videoId) {
          try {
            const info = await youtubeService.getVideoInfo(videoId);
            const reply = `Boss yeh video chal raha hai! 🎬\n\n"${info.title}" by ${info.author}`;
            await Chat.create({ userId, role: 'zoric', message: reply });
            return res.json({ success: true, message: reply, youtubeVideoId: videoId, videoInfo: info });
          } catch {}
        }
      }

      // Channel videos - GamerFleet etc
      const channelPatterns = [
        /(\w+)\s+(?:ka|ke|ki)\s+(?:latest|naya|new|recent)\s+video/i,
        /(\w+)\s+(?:channel|ke videos)/i,
        /latest video (?:of|from|by)\s+(\w+)/i
      ];
      for (const pattern of channelPatterns) {
        const match = message.match(pattern);
        if (match) {
          try {
            const channelName = match[1];
            const videos = await youtubeService.searchChannelVideos(channelName, 5);
            if (videos.length > 0) {
              const latest = videos[0];
              const reply = `Boss, ${channelName} ka latest video mila! 🎬\n\n"${latest.title}"\nDuration: ${latest.duration}`;
              await Chat.create({ userId, role: 'zoric', message: reply });
              return res.json({ success: true, message: reply, youtubeVideoId: latest.videoId, videoInfo: latest });
            }
          } catch {}
        }
      }

      // ── Pehle playlist check karo ──────────────────────────────
      const PlaylistModel = require('../models/Playlist');
      try {
        const allPlaylists = await PlaylistModel.find({ userId });
        const matchedPlaylist = allPlaylists.find(p =>
          lowerMsg.includes(p.name.toLowerCase())
        );
        if (matchedPlaylist && matchedPlaylist.songs.length > 0) {
          const firstSong = matchedPlaylist.songs[0];
          const reply = `🎵 Boss! "${matchedPlaylist.name}" playlist chala raha hoon!\n\nPehla song: "${firstSong.title}" by ${firstSong.author}\n\nTotal ${matchedPlaylist.songs.length} songs hain!`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          memoryFileService.saveConversation(message, reply);
          return res.json({ success: true, message: reply, youtubeVideoId: firstSong.videoId, videoInfo: firstSong, playlistPlay: true, playlistSongs: matchedPlaylist.songs });
        }
      } catch (e) { logger.warn(`Pre-playlist check failed: ${e.message}`, 'PLAYLIST_WARN'); }

      // Normal song/video search
      const songQuery = message
        .replace(/^(now\s+)?(?:play|chala|chalao|bajao|baja|suno|laga|lagao)\s+/i, '')
        .replace(/\b(song|track|gana|music|video|please|pls|do|kar|karo)\b/gi, '')
        .replace(/\bfrom\b/gi, '')
        .trim();

      // Reject agar query mein sirf filler words hain — real song name nahi
      const fillerOnly = /^(yahan|wahan|koi|aur|ek|doosra|doosri|kuch|bhi|hi|se|ka|ki|ke|ja|ye|yeh|woh|is|uss|iska|uska|please|pls|bhai|boss|bro|ok|haan|nahi|mat|na|ab|toh|fir|phir|bas|zyada|thoda|jaldi|dhire|acha|theek|sahi|galat|naya|purana|different|other|another|channel|video|link|url|same|wala|wali|waala|dikha|dikhao|laga|lagao|chala|chalao){1,4}$/i;
      if (fillerOnly.test(songQuery.trim())) {
        const reply = 'Boss kaunsa song chahiye? Naam bolo! 🎵';
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      }

      if (songQuery.length > 1) {
        try {
          const videos = await youtubeService.searchVideos(songQuery, 5);
          if (videos.length > 0) {
            let picked = videos[0];
            for (const v of videos) {
              if (!v.title.toLowerCase().includes('unavailable') && v.videoId) {
                picked = v;
                break;
              }
            }
            const reply = `Haan boss! "${picked.title}" by ${picked.author} chal raha hai! 🎵`;
            await Chat.create({ userId, role: 'zoric', message: reply });
            return res.json({ success: true, message: reply, youtubeVideoId: picked.videoId, videoInfo: picked });
          }
        } catch (e) {
          logger.warn(`YouTube search failed: ${e.message}`, 'YT_WARN');
        }
      }
    }

    // YouTube controls
    if (lowerMsg.includes('next video') || lowerMsg.includes('agla video') || lowerMsg.includes('next song')) {
      const reply = 'Boss next video ke liye playlist mein se choose karo! ⏭';
      await Chat.create({ userId, role: 'zoric', message: reply });
      return res.json({ success: true, message: reply, action: 'YOUTUBE_NEXT' });
    }

    if (lowerMsg.includes('pause') || (lowerMsg.includes('ruk') && lowerMsg.includes('video'))) {
      await Chat.create({ userId, role: 'zoric', message: 'Video pause kar diya boss! ⏸' });
      return res.json({ success: true, message: 'Video pause kar diya boss! ⏸', action: 'YOUTUBE_PAUSE' });
    }

    // Trending videos
    if (lowerMsg.includes('trending') && (lowerMsg.includes('video') || lowerMsg.includes('dekha'))) {
      try {
        const videos = await youtubeService.getTrending(3);
        const list = videos.map((v, i) => `${i + 1}. "${v.title}" by ${v.author}`).join('\n');
        const reply = `Boss, aaj ke trending videos:\n\n${list}`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply, trendingVideos: videos });
      } catch {}
    }

    // ==================== SENTINEL AI COMMANDS ====================
    const sentinelIpMatch = message.match(/(?:track|trace|ip info|location of|locate)s+(d+.d+.d+.d+)/i);
    if (sentinelIpMatch) {
      try {
        const ip = sentinelIpMatch[1];
        const axios = require('axios');
        const r = await axios.get(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,org,lat,lon,proxy`, { timeout: 8000 });
        if (r.data.status === 'success') {
          const d = r.data;
          const reply = `🌐 IP: ${ip}\n📍 Location: ${d.city}, ${d.regionName}, ${d.country}\n🏢 ISP: ${d.isp}\n🔒 Proxy/VPN: ${d.proxy ? '⚠️ YES' : '✅ NO'}\n\nSENTINEL page pe detailed map dekho!`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          memoryFileService.saveConversation(message, reply);
          return res.json({ success: true, message: reply });
        }
      } catch (e) { logger.warn(`Sentinel IP failed: ${e.message}`, 'SENTINEL_WARN'); }
    }

    const sentinelPhishMatch = lowerMsg.match(/(?:check|scan|safe|phishing|link check)\s+(https?:\/\/\S+)/i);
    if (sentinelPhishMatch) {
      try {
        const url = sentinelPhishMatch[1];
        const flags = [];
        let risk = 0;
        if (url.includes('@')) { flags.push('@ symbol'); risk += 30; }
        if (!/^https/.test(url)) { flags.push('No HTTPS'); risk += 25; }
        if (/d{1,3}.d{1,3}.d{1,3}.d{1,3}/.test(url)) { flags.push('IP address as domain'); risk += 40; }
        const level = risk >= 60 ? '🔴 HIGH RISK' : risk >= 30 ? '🟡 MEDIUM RISK' : '🟢 SAFE';
        const reply = `🎣 Phishing Check: ${url}\n\nRisk Level: ${level}\n${flags.length > 0 ? 'Issues: ' + flags.join(', ') : 'Koi suspicious pattern nahi mila!'}`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        memoryFileService.saveConversation(message, reply);
        return res.json({ success: true, message: reply });
      } catch (e) { logger.warn(`Sentinel phish failed: ${e.message}`, 'SENTINEL_WARN'); }
    }

    if (lowerMsg.includes('email') && (lowerMsg.includes('breach') || lowerMsg.includes('leak') || lowerMsg.includes('hack'))) {
      const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}/);
      if (emailMatch) {
        try {
          const axios = require('axios');
          const r = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${emailMatch[0]}`, {
            headers: { 'hibp-api-key': process.env.HIBP_API_KEY || '', 'User-Agent': 'ZORIC' }, timeout: 8000
          });
          const reply = `📧 Email: ${emailMatch[0]}\n⚠️ ${r.data.length} BREACH${r.data.length > 1 ? 'ES' : ''} FOUND!\n\n${r.data.slice(0,3).map(b => `• ${b.Name} (${b.BreachDate})`).join('\n')}\n\nSENTINEL page pe full details dekho!`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          return res.json({ success: true, message: reply });
        } catch (e) {
          if (e.response?.status === 404) {
            const reply = `📧 Email: ${emailMatch[0]}\n✅ Koi breach nahi mila! Safe hai boss!`;
            await Chat.create({ userId, role: 'zoric', message: reply });
            return res.json({ success: true, message: reply });
          }
        }
      }
    }

    // ==================== BROWSER SEARCH ====================
    const browseKeywords = ['open', 'kholo', 'browse', 'visit', 'check karo', 'dekho', 'padho', 'read', 'website', 'site pe ja'];
    const urlPattern = new RegExp('(?:https?://)?(?:www.)?([a-zA-Z0-9-]+.[a-zA-Z]{2,}(?:/[^s]*)?)');
    const urlMatch = message.match(urlPattern);
    const wantsBrowse = browseKeywords.some(k => lowerMsg.includes(k)) && urlMatch;

    if (wantsBrowse && urlMatch) {
      try {
        let browserResult = null;
        const fakeReq = { body: { url: urlMatch[0] } };
        const fakeRes = { json: (data) => { browserResult = data; }, status: () => ({ json: () => {} }) };
        await browserController.fetchPage(fakeReq, fakeRes);
        if (browserResult?.success) {
          const reply = `Boss, maine "${browserResult.title}" page padh liya! 🌐\n\n${browserResult.summary}`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          memoryFileService.saveConversation(message, reply);
          return res.json({ success: true, message: reply });
        }
      } catch (e) {
        logger.warn(`Browser fetch failed: ${e.message}`, 'BROWSER_WARN');
      }
    }

    // ==================== PLAYLIST AI COMMANDS ====================
    const Playlist = require('../models/Playlist');

    const createPlaylistMatch = lowerMsg.match(/(?:playlist|list)\s+(?:bana|create|banao|new)\s+(.+)|(.+)\s+(?:playlist|list)\s+(?:bana|create|banao)/i);
    if (createPlaylistMatch) {
      try {
        const name = (createPlaylistMatch[1] || createPlaylistMatch[2])?.trim();
        if (name && name.length < 50) {
          const playlist = await Playlist.create({ userId, name });
          const reply = `✅ Boss! "${name}" playlist bana di! Ab songs add kar sakte ho 🎵`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          memoryFileService.saveConversation(message, reply);
          return res.json({ success: true, message: reply });
        }
      } catch (e) { logger.warn(`Playlist create failed: ${e.message}`, 'PLAYLIST_WARN'); }
    }

    // Smart playlist detection — pehle user ke playlists check karo
    const playKeywords = ['chala', 'play', 'start', 'bajao', 'lagao', 'suno', 'laga'];
    const isPlayRequest = playKeywords.some(k => lowerMsg.includes(k));

    if (isPlayRequest) {
      try {
        const allPlaylists = await PlaylistModel.find({ userId });
        // Check karo koi playlist name message mein hai
        const matchedPlaylist = allPlaylists.find(p =>
          lowerMsg.includes(p.name.toLowerCase())
        );
        if (matchedPlaylist && matchedPlaylist.songs.length > 0) {
          const firstSong = matchedPlaylist.songs[0];
          const reply = `🎵 Boss! "${matchedPlaylist.name}" playlist chala raha hoon!\n\nPehla song: "${firstSong.title}" by ${firstSong.author}\n\nTotal ${matchedPlaylist.songs.length} songs hain!`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          memoryFileService.saveConversation(message, reply);
          return res.json({ success: true, message: reply, youtubeVideoId: firstSong.videoId, videoInfo: firstSong, playlistPlay: true, playlistId: matchedPlaylist._id, playlistSongs: matchedPlaylist.songs });
        } else if (matchedPlaylist) {
          const reply = `Boss "${matchedPlaylist.name}" playlist mein koi song nahi hai! Pehle songs add karo 🎵`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          return res.json({ success: true, message: reply });
        }
      } catch (e) { logger.warn(`Smart playlist check failed: ${e.message}`, 'PLAYLIST_WARN'); }
    }

    const playPlaylistMatch = lowerMsg.match(/(.+?)\s+playlist\s+(?:chala|play|start|bajao|lagao)|(?:chala|play)\s+(.+?)\s+playlist/i);
    if (playPlaylistMatch) {
      try {
        const name = (playPlaylistMatch[1] || playPlaylistMatch[2])?.trim();
        const playlist = await Playlist.findOne({ userId, name: { $regex: name, $options: 'i' } });
        if (playlist && playlist.songs.length > 0) {
          const firstSong = playlist.songs[0];
          const reply = `🎵 Boss! "${playlist.name}" playlist chala raha hoon!\n\nPehla song: "${firstSong.title}" by ${firstSong.author}\n\nTotal ${playlist.songs.length} songs hain!`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          memoryFileService.saveConversation(message, reply);
          return res.json({ success: true, message: reply, youtubeVideoId: firstSong.videoId, videoInfo: firstSong, playlistPlay: true, playlistId: playlist._id, playlistSongs: playlist.songs });
        } else if (playlist) {
          const reply = `Boss "${playlist.name}" playlist mein koi song nahi hai! Pehle songs add karo 🎵`;
          await Chat.create({ userId, role: 'zoric', message: reply });
          return res.json({ success: true, message: reply });
        }
      } catch (e) { logger.warn(`Playlist play failed: ${e.message}`, 'PLAYLIST_WARN'); }
    }

    if (lowerMsg.includes('playlist') && (lowerMsg.includes('dikhao') || lowerMsg.includes('list') || lowerMsg.includes('show') || lowerMsg.includes('kya hai') || lowerMsg.includes('kitni'))) {
      try {
        const playlists = await Playlist.find({ userId });
        if (playlists.length === 0) {
          const reply = 'Boss abhi koi playlist nahi hai! Banane ke liye bolo "Chill playlist bana" 🎵';
          await Chat.create({ userId, role: 'zoric', message: reply });
          return res.json({ success: true, message: reply });
        }
        const list = playlists.map(p => `🎵 **${p.name}** — ${p.songs.length} songs`).join('\n');
        const reply = `Boss, teri playlists:\n\n${list}`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        memoryFileService.saveConversation(message, reply);
        return res.json({ success: true, message: reply });
      } catch (e) { logger.warn(`Playlist list failed: ${e.message}`, 'PLAYLIST_WARN'); }
    }

    // ==================== AUTO TASK DETECT ====================
    const taskKeywords = ['task add kar', 'task bana', 'remind me', 'yaad dilana', 'todo add', 'kaam add kar', 'task hai', 'karna hai', 'add task', 'note kar task'];
    const habitKeywords = ['meri habit hai', 'main roz karta hoon', 'daily karta hoon', 'mujhe aadat hai', 'har roz', 'routine hai', 'habit hai'];

    const isTaskRequest = taskKeywords.some(k => lowerMsg.includes(k));
    const isHabitMention = habitKeywords.some(k => lowerMsg.includes(k));

    if (isTaskRequest) {
      try {
        const Task = require('../models/Task');
        const groqService = require('../services/groqService');
        const extractResult = await groqService.chat([{
          role: 'user',
          content: `User ne yeh kaha: "${message}"\n\nIs message se task details extract kar aur SIRF JSON return kar, kuch aur mat likho:\n{"title": "task name", "description": "details", "priority": "HIGH/MEDIUM/LOW", "category": "today/upcoming/project", "dueTime": "HH:MM ya null"}`
        }]);
        const clean = extractResult.content.replace(/```json|```/g, '').trim();
        const taskData = JSON.parse(clean);
        await Task.create({ userId, title: taskData.title, description: taskData.description || '', priority: taskData.priority || 'MEDIUM', category: taskData.category || 'today', dueTime: taskData.dueTime || '' });
        const reply = `✅ Boss! Task add kar diya!\n\n📌 **${taskData.title}**\nPriority: ${taskData.priority || 'MEDIUM'}\nCategory: ${taskData.category || 'today'}\n\nTasks page pe dekh sakte ho!`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        memoryFileService.saveConversation(message, reply);
        return res.json({ success: true, message: reply });
      } catch (e) {
        logger.warn(`Task auto-create failed: ${e.message}`, 'TASK_WARN');
      }
    }

    if (isHabitMention) {
      try {
        const memData = memoryFileService.readMemory();
        const habitMatch = message.match(/(?:meri habit hai|main roz karta hoon|daily karta hoon|har roz|habit hai|routine hai)[,\s]+(.+)/i);
        if (habitMatch) {
          const habitText = habitMatch[1].trim();
          memoryFileService.saveConversation(message, '');
          const mem = memoryFileService.readMemory();
          if (!mem.user.traits.includes(`Habit: ${habitText}`)) {
            mem.user.traits.push(`Habit: ${habitText}`);
            const fs2 = require('fs');
            const path2 = require('path');
            fs2.writeFileSync(path2.join(__dirname, '../logs/memory.json'), JSON.stringify(mem, null, 2));
          }
        }
      } catch (e) {
        logger.warn(`Habit save failed: ${e.message}`, 'HABIT_WARN');
      }
    }

    // ==================== REALTIME DATA ====================
    // Crypto
    const cryptoMatch = lowerMsg.match(/(?:bitcoin|ethereum|btc|eth|crypto|coin)\s*(?:price|rate|kitna|kya bhav)/i) ||
      message.match(/(\w+)\s+(?:coin|crypto)\s+(?:price|rate)/i);
    if (cryptoMatch) {
      try {
        const coin = lowerMsg.includes('ethereum') || lowerMsg.includes('eth') ? 'ethereum' : 'bitcoin';
        const data = await realtimeDataService.getCryptoPrice(coin);
        const reply = `Boss, ${data.coin} ka price:\n💰 INR: ₹${data.inr?.toLocaleString()}\n💵 USD: $${data.usd?.toLocaleString()}`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      } catch {}
    }

    // Cricket
    if (lowerMsg.includes('cricket') || lowerMsg.includes('ipl') || lowerMsg.includes('match score')) {
      try {
        let browserResult = null;
        const fakeReq = { body: { url: 'https://www.cricbuzz.com/cricket-match/live-scores' } };
        const fakeRes = { json: (data) => { browserResult = data; }, status: () => ({ json: () => {} }) };
        await browserController.fetchPage(fakeReq, fakeRes);
        if (browserResult?.success) {
          // Sirf pehle 2000 chars lo — zyada nahi
          const shortContent = browserResult.content.slice(0, 2000);
          const groqService = require('../services/groqService');
          const result = await groqService.chat([{
            role: 'user',
            content: `Yeh Cricbuzz live scores page ka content hai:\n\n${shortContent}\n\nSirf aaj ke matches aur unke current scores batao. Aaj ki date: ${new Date().toLocaleDateString('en-IN')}. Agar match live hai toh score batao, agar upcoming hai toh time batao. Max 5 matches. Hinglish mein.`
          }]);
          const reply = result.content;
          await Chat.create({ userId, role: 'zoric', message: reply });
          memoryFileService.saveConversation(message, reply);
          return res.json({ success: true, message: reply });
        }
      } catch (e) {
        logger.warn(`Cricket fetch failed: ${e.message}`, 'CRICKET_WARN');
      }
    }

    // Currency convert
    const currencyMatch = message.match(/(\d+)\s+(\w+)\s+(?:to|mein|ka)\s+(\w+)/i);
    if (currencyMatch && (lowerMsg.includes('convert') || lowerMsg.includes('kitna') || lowerMsg.includes('dollar') || lowerMsg.includes('rupee'))) {
      try {
        const data = await realtimeDataService.convertCurrency(currencyMatch[1], currencyMatch[2], currencyMatch[3]);
        const reply = `Boss, ${data.amount} ${data.from.toUpperCase()} = ${data.converted} ${data.to.toUpperCase()}`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      } catch {}
    }

    // Stock
    if (lowerMsg.includes('stock') || lowerMsg.includes('share price') || lowerMsg.includes('nse') || lowerMsg.includes('bse')) {
      try {
        const companyMatch = message.match(/(\w+)\s+(?:ka\s+)?(?:stock|share)/i);
        const company = companyMatch ? companyMatch[1] : 'Nifty 50';
        const data = await realtimeDataService.getStockPrice(company);
        await Chat.create({ userId, role: 'zoric', message: data });
        return res.json({ success: true, message: data });
      } catch {}
    }

    // ==================== GOOGLE COMMANDS ====================
    const user = await User.findById(userId);

    // Gmail
    if (lowerMsg.includes('email') || lowerMsg.includes('mail') || lowerMsg.includes('gmail')) {
      if (!user?.googleTokens) {
        const reply = 'Boss, Google connect nahi hai! Settings mein jaake Google Connect karo!';
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      }
      try {
        const emails = await googleService.getEmails(user.googleTokens, 3);
        if (emails.length === 0) {
          const reply = 'Boss, koi unread email nahi hai!';
          await Chat.create({ userId, role: 'zoric', message: reply });
          return res.json({ success: true, message: reply });
        }
        const list = emails.map((e, i) => `${i + 1}. From: ${e.from}\nSubject: ${e.subject}\n${e.snippet}`).join('\n\n');
        const reply = `Boss, ${emails.length} unread emails hain:\n\n${list}`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      } catch {}
    }

    // Calendar
    if (lowerMsg.includes('calendar') || lowerMsg.includes('schedule') || lowerMsg.includes('meeting') || lowerMsg.includes('event')) {
      if (!user?.googleTokens) {
        const reply = 'Boss, Google connect nahi hai! Settings mein jaake Google Connect karo!';
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      }
      try {
        const events = await googleService.getCalendarEvents(user.googleTokens, 5);
        if (events.length === 0) {
          const reply = 'Boss, koi upcoming event nahi hai!';
          await Chat.create({ userId, role: 'zoric', message: reply });
          return res.json({ success: true, message: reply });
        }
        const list = events.map((e, i) => `${i + 1}. ${e.title}\n📅 ${new Date(e.start).toLocaleString('en-IN')}`).join('\n\n');
        const reply = `Boss, upcoming events:\n\n${list}`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      } catch {}
    }

    // ==================== PERSONAL COMMANDS ====================
    // Mood log
    const moodMatch = lowerMsg.match(/(?:mai|main|mujhe|i am|i feel|feeling)\s+(happy|sad|excited|angry|anxious|neutral|khush|dukhi|achi|buri)/i);
    if (moodMatch) {
      const moodMap = { khush: 'happy', dukhi: 'sad', achi: 'happy', buri: 'sad' };
      const moodVal = moodMap[moodMatch[1]] || moodMatch[1];
      try {
        const date = new Date().toISOString().split('T')[0];
        await Mood.findOneAndUpdate({ userId, date }, { mood: moodVal, note: message }, { upsert: true });
        const reply = `Boss, tumhara mood note kar liya — ${moodVal}! 📊 Khayal rakhna apna!`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      } catch {}
    }

    // Expense log
    const expenseMatch = message.match(/(\d+)\s*(?:rupaye|rs|₹|rupees?)\s*(?:kharch|spent|spend|pe|on|mein)\s+(.+)/i);
    if (expenseMatch) {
      try {
        const amount = parseInt(expenseMatch[1]);
        const desc = expenseMatch[2].trim();
        const catMap = { food: 'food', khana: 'food', transport: 'transport', uber: 'transport', movie: 'entertainment', shopping: 'shopping', medicine: 'health' };
        let category = 'other';
        for (const [key, val] of Object.entries(catMap)) {
          if (desc.toLowerCase().includes(key)) { category = val; break; }
        }
        await Expense.create({ userId, amount, category, description: desc });
        const reply = `Boss, ₹${amount} ka expense add kar diya — ${desc}! 💸`;
        await Chat.create({ userId, role: 'zoric', message: reply });
        return res.json({ success: true, message: reply });
      } catch {}
    }

    // Pomodoro
    if (lowerMsg.includes('pomodoro') || lowerMsg.includes('focus session') || (lowerMsg.includes('focus') && lowerMsg.includes('start'))) {
      const minMatch = message.match(/(\d+)\s*(?:min|minute)/i);
      const duration = minMatch ? parseInt(minMatch[1]) : 25;
      const reply = `Boss, ${duration} minute ka focus session shuru! 🍅 Concentrate karo — main timer set kar raha hun!`;
      await Chat.create({ userId, role: 'zoric', message: reply });
      return res.json({ success: true, message: reply, action: 'POMODORO_START', duration });
    }

    // Password generator
    if (lowerMsg.includes('password') && (lowerMsg.includes('generate') || lowerMsg.includes('banao') || lowerMsg.includes('bana'))) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let pwd = '';
      for (let i = 0; i < 16; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      const reply = `Boss, yeh raha strong password:\n\n\`${pwd}\`\n\nKahin safe jagah save kar lena! 🔐`;
      await Chat.create({ userId, role: 'zoric', message: reply });
      return res.json({ success: true, message: reply });
    }

    // ==================== NORMAL AI RESPONSE ====================
    const history = await Chat.find({ userId }).sort({ createdAt: -1 }).limit(20);
    const messages = history.reverse().map(c => ({
      role: c.role === 'zoric' ? 'assistant' : 'user',
      content: c.message
    }));

    const memories = await Memory.find({ userId }).limit(10);
    if (memories.length > 0) {
      const memStr = memories.map(m => `${m.key}: ${m.value}`).join(', ');
      messages.unshift({ role: 'system', content: `User memories: ${memStr}` });
    }

    const start = Date.now();
    const result = await agentService.orchestrate(messages, message, io, socketId);
    const responseTime = Date.now() - start;
    const cleanResponse = result.content.replace(/\[SPOTIFY_PLAY:.*?\]/gi, '').trim();

    await Chat.create({ userId, role: 'zoric', message: cleanResponse, model: result.model, responseTime });

    // Memory save
    if (lowerMsg.includes('my name is') || lowerMsg.includes('mera naam')) {
      const nameMatch = message.match(/(?:my name is|mera naam hai?) ([a-zA-Z\s]+)/i);
      if (nameMatch) {
        await Memory.findOneAndUpdate({ userId, key: 'user_name' }, { userId, key: 'user_name', value: nameMatch[1].trim() }, { upsert: true });
      }
    }

    logger.success(`Chat response in ${responseTime}ms`, 'CHAT_DONE');
    memoryFileService.saveConversation(message, cleanResponse);
    res.json({ success: true, message: cleanResponse, responseTime });

  } catch (error) {
    logger.error(`Chat error: ${error.message}`, 'CHAT_ERROR');
    res.status(500).json({ success: false, message: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await Chat.find({ userId: req.userId }).sort({ createdAt: 1 }).limit(100);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const clearHistory = async (req, res) => {
  try {
    await Chat.deleteMany({ userId: req.userId });
    logger.info('Chat history cleared', 'CHAT_CLEAR');
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendMessage, getHistory, clearHistory };
