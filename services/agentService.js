const groqService = require('./groqService');
const tavilyService = require('./tavilyService');
const logger = require('./loggerService');

const AGENT_TIMEOUT = 10000;

const runWithTimeout = (promise, timeout) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeout))
  ]);
};

const parseIntent = (message) => {
  const lower = message.toLowerCase();
  const intents = [];
  if (lower.includes('search') || lower.includes('find') || lower.includes('kya hai') || lower.includes('batao') || lower.includes('bata')) intents.push('search');
  if (lower.includes('weather') || lower.includes('mausam') || lower.includes('temperature')) intents.push('weather');
  if (lower.includes('news') || lower.includes('khabar') || lower.includes('latest') || lower.includes('aaj ki') || lower.includes('current')) intents.push('news');
  return intents;
};

const orchestrate = async (messages, userMessage, io, socketId) => {
  const intents = parseIntent(userMessage);
  const needsSearch = intents.length > 0;

  const emitAgentUpdate = (agents) => {
    if (io && socketId) io.to(socketId).emit('agent_update', { agents, active: true });
  };

  const emitAgentDone = () => {
    if (io && socketId) io.to(socketId).emit('agent_update', { agents: [], active: false });
  };

  if (!needsSearch) {
    logger.info('Single agent handling request', 'AGENT_SINGLE');
    emitAgentUpdate([{ id: 1, name: 'Agent-1', status: 'thinking', task: 'Processing request' }]);
    try {
      const result = await runWithTimeout(groqService.chat(messages), AGENT_TIMEOUT);
      emitAgentDone();
      return result;
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        logger.warn('Agent timed out, spawning multi-agents', 'AGENT_TIMEOUT');
        return await multiAgentProcess(messages, userMessage, intents, io, socketId, emitAgentUpdate, emitAgentDone);
      }
      throw error;
    }
  }

  return await multiAgentProcess(messages, userMessage, intents, io, socketId, emitAgentUpdate, emitAgentDone);
};

const multiAgentProcess = async (messages, userMessage, intents, io, socketId, emitAgentUpdate, emitAgentDone) => {
  logger.info(`Multi-agent spawned for: ${intents.join(', ')}`, 'AGENT_MULTI');

  const agents = [
    { id: 1, name: 'Agent-1', status: 'working', task: 'Analyzing request' },
    { id: 2, name: 'Agent-2', status: 'working', task: 'Fetching live data' },
    { id: 3, name: 'Agent-3', status: 'working', task: 'Processing 2026 data' },
  ].slice(0, intents.length + 1);

  emitAgentUpdate(agents);

  const sharedContext = { userMessage, results: {} };
  const agentTasks = [];

  if (intents.includes('news')) {
    agentTasks.push(
      tavilyService.getNews(userMessage).then(result => {
        sharedContext.results.news = result;
        const agent = agents.find(a => a.task === 'Fetching live data');
        if (agent) agent.status = 'done';
        emitAgentUpdate(agents);
      }).catch(e => logger.warn(`News fetch failed: ${e.message}`, 'AGENT_WARN'))
    );
  }

  if (intents.includes('search')) {
    agentTasks.push(
      tavilyService.tavilySearch(userMessage).then(result => {
        sharedContext.results.search = result;
        const agent = agents.find(a => a.task === 'Processing 2026 data');
        if (agent) agent.status = 'done';
        emitAgentUpdate(agents);
      }).catch(e => logger.warn(`Search failed: ${e.message}`, 'AGENT_WARN'))
    );
  }

  if (intents.includes('weather')) {
    const cityMatch = userMessage.match(/weather(?:\s+in)?\s+([a-zA-Z\s]+)/i);
    const city = cityMatch ? cityMatch[1].trim() : 'India';
    agentTasks.push(
      tavilyService.getWeather(city).then(result => {
        sharedContext.results.weather = result;
      }).catch(() => {})
    );
  }

  await Promise.allSettled(agentTasks);

  // Inject real data into messages
  let enrichedMessages = [...messages];
  if (Object.keys(sharedContext.results).length > 0) {
    const contextStr = Object.entries(sharedContext.results).map(([key, val]) => {
      if (key === 'news') return `LATEST NEWS 2026:\n${val.answer}\n${val.results?.map(r => `- ${r.title}`).join('\n') || ''}`;
      if (key === 'search') return `SEARCH RESULT 2026:\n${val.answer}`;
      if (key === 'weather') return `WEATHER DATA:\n${val.answer}`;
      return '';
    }).join('\n\n');

    enrichedMessages = [
      ...messages.slice(0, -1),
      {
        role: 'user',
        content: `${userMessage}\n\n[REAL-TIME 2026 DATA - Use this to answer]:\n${contextStr}\n\nIss data ke basis pe answer de — ye 2026 ka real data hai.`
      }
    ];
  }

  agents.forEach(a => a.status = 'done');
  emitAgentUpdate(agents);

  const result = await groqService.chat(enrichedMessages);
  emitAgentDone();

  logger.success(`Multi-agent complete`, 'AGENT_DONE');
  return result;
};

module.exports = { orchestrate };
