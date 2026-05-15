const DailySummary = require('../models/DailySummary');
const Chat = require('../models/Chat');
const Task = require('../models/Task');
const groqService = require('../services/groqService');
const memoryFileService = require('../services/memoryFileService');
const logger = require('../services/loggerService');

// Generate daily summary at 11:55 PM
const generateDailySummary = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Already generated today?
    const existing = await DailySummary.findOne({ userId, date: today });
    if (existing) return existing;

    // Get today's chats
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const chats = await Chat.find({ userId, createdAt: { $gte: startOfDay } }).sort({ createdAt: 1 });

    if (chats.length === 0) {
      logger.info('No chats today — skipping summary', 'DAILY_SUMMARY');
      return null;
    }

    // Get tasks
    const tasksCompleted = await Task.countDocuments({ userId, status: 'completed', updatedAt: { $gte: startOfDay } });

    // Analyze chats
    const chatText = chats.slice(-50).map(c => `${c.role}: ${c.message}`).join('\n');
    const activeHours = [...new Set(chats.map(c => new Date(c.createdAt).getHours()))];

    // Detect mood from last few messages
    const lastMessages = chats.filter(c => c.role === 'user').slice(-10).map(c => c.message).join(' ');
    const gymMentioned = lastMessages.toLowerCase().includes('gym') || lastMessages.toLowerCase().includes('workout');

    // AI generate summary
    const result = await groqService.chat([{
      role: 'user',
      content: `Yeh aaj ke conversations hain:\n\n${chatText.slice(0, 4000)}\n\nAaj ke stats:\n- Completed tasks: ${tasksCompleted}\n- Active hours: ${activeHours.join(', ')}\n- Gym mentioned: ${gymMentioned}\n\nIn conversations ke basis pe:\n1. Aaj ka short summary bana (3-4 lines, Hinglish mein)\n2. User ke baare mein kya seekha aaj (personality insight)\n3. User ka aaj ka mood kya tha (happy/sad/frustrated/neutral/focused)\n4. Top 3 topics jo discuss hue\n\nSIRF JSON return karo:\n{"summary": "...", "personalityInsight": "...", "mood": "...", "topTopics": ["...", "...", "..."]}`
    }]);

    let aiData = { summary: 'Aaj ka din complete hua boss!', personalityInsight: '', mood: 'neutral', topTopics: [] };
    try {
      const clean = result.content.replace(/```json|```/g, '').trim();
      aiData = JSON.parse(clean);
    } catch {}

    // Save summary
    const summary = await DailySummary.create({
      userId,
      date: today,
      summary: aiData.summary,
      stats: {
        totalMessages: chats.filter(c => c.role === 'user').length,
        tasksCompleted,
        gymMentioned,
        mood: aiData.mood || 'neutral',
        activeHours,
        topTopics: aiData.topTopics || [],
      },
      personalityInsights: aiData.personalityInsight,
      rawData: chatText.slice(0, 2000),
    });

    // Update memory.json with personality insights
    if (aiData.personalityInsight) {
      const mem = memoryFileService.readMemory();
      if (!mem.user.traits.includes(aiData.personalityInsight)) {
        mem.user.traits.push(`[${today}] ${aiData.personalityInsight}`);
        if (mem.user.traits.length > 30) mem.user.traits = mem.user.traits.slice(-30);
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(__dirname, '../logs/memory.json'), JSON.stringify(mem, null, 2));
      }
    }

    logger.success(`Daily summary generated for ${today}`, 'DAILY_SUMMARY');
    return summary;
  } catch (e) {
    logger.error(`Daily summary failed: ${e.message}`, 'DAILY_SUMMARY_ERROR');
    return null;
  }
};

// Get long term personality profile
const getPersonalityProfile = async (userId) => {
  try {
    const summaries = await DailySummary.find({ userId }).sort({ date: -1 }).limit(30);
    if (summaries.length === 0) return null;

    const allInsights = summaries.map(s => s.personalityInsights).filter(Boolean).join('\n');
    const moodHistory = summaries.map(s => s.stats.mood);
    const gymDays = summaries.filter(s => s.stats.gymMentioned).length;
    const avgTasks = summaries.reduce((acc, s) => acc + s.stats.tasksCompleted, 0) / summaries.length;
    const allTopics = summaries.flatMap(s => s.stats.topTopics);
    const topicCount = {};
    allTopics.forEach(t => { topicCount[t] = (topicCount[t] || 0) + 1; });
    const topTopics = Object.entries(topicCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([t]) => t);

    const happyDays = moodHistory.filter(m => m === 'happy').length;
    const dominantMood = moodHistory.reduce((acc, m) => { acc[m] = (acc[m]||0)+1; return acc; }, {});
    const mood = Object.entries(dominantMood).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'neutral';

    return {
      totalDays: summaries.length,
      gymDays,
      avgTasksPerDay: Math.round(avgTasks * 10) / 10,
      dominantMood: mood,
      happyPercentage: Math.round((happyDays / summaries.length) * 100),
      topTopics,
      insights: allInsights.slice(0, 500),
      recentSummaries: summaries.slice(0, 7).map(s => ({ date: s.date, summary: s.summary, mood: s.stats.mood })),
    };
  } catch (e) {
    return null;
  }
};

// Proactive check — kya ZORIC khud kuch bolna chahta hai
const getProactiveMessage = async (userId) => {
  try {
    const summaries = await DailySummary.find({ userId }).sort({ date: -1 }).limit(7);
    const messages = [];

    // Gym check
    const recentGymDays = summaries.filter(s => s.stats.gymMentioned).length;
    const lastGymDay = summaries.findIndex(s => s.stats.gymMentioned);
    if (lastGymDay > 2) messages.push(`Boss! ${lastGymDay} din ho gaye gym nahi gaya! 💪`);

    // Mood check
    const recentMoods = summaries.slice(0,3).map(s => s.stats.mood);
    const sadDays = recentMoods.filter(m => m === 'sad' || m === 'frustrated').length;
    if (sadDays >= 2) messages.push('Boss, last 3 din se thoda stressed lag raha hai. Kuch baat karni hai? 🤝');

    // Tasks check
    const recentTasks = summaries.slice(0,3).map(s => s.stats.tasksCompleted);
    const avgTasks = recentTasks.reduce((a,b) => a+b, 0) / recentTasks.length;
    if (avgTasks === 0) messages.push('Boss! 3 din se koi task complete nahi hua. Kya chal raha hai? 📋');

    return messages[0] || null;
  } catch { return null; }
};

// API endpoints
const generateSummaryApi = async (req, res) => {
  try {
    const summary = await generateDailySummary(req.userId);
    res.json({ success: true, summary });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getProfileApi = async (req, res) => {
  try {
    const profile = await getPersonalityProfile(req.userId);
    res.json({ success: true, profile });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getProactiveApi = async (req, res) => {
  try {
    const message = await getProactiveMessage(req.userId);
    res.json({ success: true, message });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getSummariesApi = async (req, res) => {
  try {
    const summaries = await DailySummary.find({ userId: req.userId }).sort({ date: -1 }).limit(30);
    res.json({ success: true, summaries });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { generateDailySummary, getPersonalityProfile, getProactiveMessage, generateSummaryApi, getProfileApi, getProactiveApi, getSummariesApi };
