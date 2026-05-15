const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '../logs/memory.json');

// Ensure file exists
const ensureFile = () => {
  const dir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({
      user: { name: null, traits: [], preferences: [], patterns: [] },
      conversations: [],
      summary: ''
    }, null, 2));
  }
};

// Read memory
const readMemory = () => {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch {
    return { user: { name: null, traits: [], preferences: [], patterns: [] }, conversations: [], summary: '' };
  }
};

// Save a conversation turn
const saveConversation = (userMsg, zoriceMsg) => {
  ensureFile();
  const mem = readMemory();

  const entry = {
    timestamp: new Date().toISOString(),
    user: userMsg,
    zoric: zoriceMsg
  };

  mem.conversations.push(entry);

  // Keep last 200 conversations
  if (mem.conversations.length > 200) {
    mem.conversations = mem.conversations.slice(-200);
  }

  // Auto-detect user traits from message
  detectAndUpdateTraits(mem, userMsg);

  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
};

// Detect personality traits from messages
const detectAndUpdateTraits = (mem, msg) => {
  const lower = msg.toLowerCase();
  const hour = new Date().getHours();

  // Time patterns
  if (hour >= 22 || hour <= 4) {
    addPattern(mem, 'raat ko zyada active rehta hai');
  } else if (hour >= 6 && hour <= 10) {
    addPattern(mem, 'subah jaldi uthta hai');
  }

  // Interest detection
  if (lower.includes('code') || lower.includes('programming') || lower.includes('debug')) {
    addTrait(mem, 'developer/programmer hai');
  }
  if (lower.includes('music') || lower.includes('song') || lower.includes('gana')) {
    addTrait(mem, 'music pasand karta hai');
  }
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
    addTrait(mem, 'fitness conscious hai');
  }
  if (lower.includes('game') || lower.includes('gaming') || lower.includes('play')) {
    addTrait(mem, 'gaming mein interest hai');
  }

  // Name detection
  const nameMatch = msg.match(/(?:my name is|mera naam|main|mein)\s+([A-Z][a-z]+)/);
  if (nameMatch && !mem.user.name) {
    mem.user.name = nameMatch[1];
  }
};

const addTrait = (mem, trait) => {
  if (!mem.user.traits.includes(trait)) {
    mem.user.traits.push(trait);
    if (mem.user.traits.length > 20) mem.user.traits = mem.user.traits.slice(-20);
  }
};

const addPattern = (mem, pattern) => {
  if (!mem.user.patterns.includes(pattern)) {
    mem.user.patterns.push(pattern);
    if (mem.user.patterns.length > 10) mem.user.patterns = mem.user.patterns.slice(-10);
  }
};

// Build context string for system prompt
const buildMemoryContext = () => {
  const mem = readMemory();
  const parts = [];

  if (mem.user.name) parts.push(`User ka naam: ${mem.user.name}`);
  if (mem.user.traits.length > 0) parts.push(`User ke baare mein: ${mem.user.traits.join(', ')}`);
  if (mem.user.patterns.length > 0) parts.push(`User ke patterns: ${mem.user.patterns.join(', ')}`);

  // Last 10 conversations as context
  const recent = mem.conversations.slice(-10);
  if (recent.length > 0) {
    const convStr = recent.map(c =>
      `[${new Date(c.timestamp).toLocaleTimeString('en-IN')}] User: "${c.user}" → ZORIC: "${c.zoric.substring(0, 80)}..."`
    ).join('\n');
    parts.push(`\nRecent conversation history:\n${convStr}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
};

module.exports = { saveConversation, buildMemoryContext, readMemory };
