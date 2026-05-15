const axios = require('axios');
const logger = require('../services/loggerService');

// ── IP Tracker ────────────────────────────────────────────────────────────────
const trackIp = async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, message: 'IP required' });
  try {
    logger.info(`IP track: ${ip}`, 'SENTINEL');
    const r = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query`, { timeout: 8000 });
    if (r.data.status === 'fail') return res.json({ success: false, message: r.data.message });
    res.json({
      success: true, type: 'ip',
      data: {
        ip: r.data.query, city: r.data.city, region: r.data.regionName,
        country: r.data.country, countryCode: r.data.countryCode,
        lat: r.data.lat, lon: r.data.lon, timezone: r.data.timezone,
        isp: r.data.isp, org: r.data.org, isProxy: r.data.proxy,
        isHosting: r.data.hosting, as: r.data.as,
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Phone Lookup ──────────────────────────────────────────────────────────────
const lookupPhone = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone required' });
  try {
    const clean = phone.replace(/[^0-9+]/g, '');
    const isIndian = clean.startsWith('+91') || (clean.length === 10 && !clean.startsWith('+'));
    res.json({
      success: true, type: 'phone',
      data: {
        number: clean,
        valid: true,
        country: isIndian ? 'India' : 'Unknown',
        countryCode: isIndian ? 'IN' : '',
        carrier: 'Unknown — carrier info publicly available nahi',
        lineType: 'mobile',
        internationalFormat: isIndian ? `+91${clean.slice(-10)}` : clean,
        note: 'Phone number se exact location legally available nahi hoti — sirf law enforcement ke paas hoti hai',
      }
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

// ── Email Breach ──────────────────────────────────────────────────────────────
const checkEmailBreach = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const r = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
      headers: { 'hibp-api-key': process.env.HIBP_API_KEY || '', 'User-Agent': 'ZORIC-Sentinel' }, timeout: 8000,
    });
    res.json({ success: true, type: 'email_breach', breached: true, breaches: r.data, count: r.data.length });
  } catch (e) {
    if (e.response?.status === 404) return res.json({ success: true, type: 'email_breach', breached: false, breaches: [], count: 0 });
    if (e.response?.status === 401) return res.json({ success: false, message: 'HIBP API key chahiye — haveibeenpwned.com se lo' });
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── Username Search ───────────────────────────────────────────────────────────
const searchUsername = async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'Username required' });
  logger.info(`Username search: ${username}`, 'SENTINEL');
  const platforms = [
    { name: 'GitHub', url: `https://github.com/${username}`, icon: '💻' },
    { name: 'Twitter/X', url: `https://twitter.com/${username}`, icon: '🐦' },
    { name: 'Instagram', url: `https://instagram.com/${username}`, icon: '📸' },
    { name: 'Reddit', url: `https://reddit.com/user/${username}`, icon: '🤖' },
    { name: 'LinkedIn', url: `https://linkedin.com/in/${username}`, icon: '💼' },
    { name: 'YouTube', url: `https://youtube.com/@${username}`, icon: '▶️' },
    { name: 'TikTok', url: `https://tiktok.com/@${username}`, icon: '🎵' },
    { name: 'Pinterest', url: `https://pinterest.com/${username}`, icon: '📌' },
    { name: 'Twitch', url: `https://twitch.tv/${username}`, icon: '🎮' },
    { name: 'Dev.to', url: `https://dev.to/${username}`, icon: '🛠️' },
    { name: 'Steam', url: `https://steamcommunity.com/id/${username}`, icon: '🎮' },
    { name: 'HackerNews', url: `https://news.ycombinator.com/user?id=${username}`, icon: '🔶' },
  ];
  const results = await Promise.allSettled(platforms.map(async (p) => {
    try {
      const r = await axios.get(p.url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 2, validateStatus: (s) => s < 500 });
      return { ...p, found: r.status === 200, status: r.status };
    } catch { return { ...p, found: false, status: 0 }; }
  }));
  const all = results.map(r => r.value || r.reason);
  res.json({ success: true, type: 'username', username, found: all.filter(r => r.found), notFound: all.filter(r => !r.found), total: platforms.length });
};

// ── Subdomain Finder ──────────────────────────────────────────────────────────
const findSubdomains = async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ success: false, message: 'Domain required' });
  logger.info(`Subdomain find: ${domain}`, 'SENTINEL');
  const subs = ['www','mail','ftp','admin','api','dev','staging','test','blog','shop','cdn','static','media','app','portal','dashboard','beta','support','docs','status','vpn','secure','m','mobile','old','new'];
  const results = await Promise.allSettled(subs.map(async (sub) => {
    const url = `https://${sub}.${domain}`;
    try {
      const r = await axios.get(url, { timeout: 4000, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: (s) => s < 500, maxRedirects: 2 });
      return { subdomain: `${sub}.${domain}`, url, found: true, status: r.status };
    } catch { return { subdomain: `${sub}.${domain}`, url, found: false }; }
  }));
  res.json({ success: true, type: 'subdomain', domain, found: results.map(r => r.value).filter(r => r?.found), total: subs.length });
};

// ── Phishing Detector ─────────────────────────────────────────────────────────
const checkPhishing = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, message: 'URL required' });
  const flags = [];
  let riskScore = 0;
  if (url.includes('@')) { flags.push('URL mein @ symbol — suspicious!'); riskScore += 30; }
  if ((url.match(/\./g) || []).length > 4) { flags.push('Bahut saare dots — suspicious!'); riskScore += 20; }
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) { flags.push('IP address as domain'); riskScore += 40; }
  if (!url.startsWith('https')) { flags.push('HTTPS nahi — insecure'); riskScore += 25; }
  if (url.length > 100) { flags.push('URL bahut lamba'); riskScore += 15; }
  ['login','verify','secure','account','update','confirm','banking','signin'].forEach(w => {
    if (url.toLowerCase().includes(w)) { flags.push(`Suspicious keyword: ${w}`); riskScore += 10; }
  });
  const risk = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : riskScore >= 20 ? 'LOW' : 'SAFE';
  res.json({ success: true, type: 'phishing', url, risk, riskScore, flags, safe: risk === 'SAFE' });
};

// ── Password Analyzer ─────────────────────────────────────────────────────────
const analyzePassword = async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ success: false, message: 'Password required' });
  const checks = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    noCommon: !['password','123456','qwerty','abc123','admin','12345678'].includes(password.toLowerCase()),
    noRepeating: !/(.)\1{2,}/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const strength = score <= 2 ? 'VERY WEAK' : score <= 3 ? 'WEAK' : score <= 5 ? 'MEDIUM' : score <= 6 ? 'STRONG' : 'VERY STRONG';
  const color = score <= 2 ? '#ff4444' : score <= 3 ? '#ff8800' : score <= 5 ? '#ffaa00' : '#00ff88';
  const suggestions = [];
  if (!checks.length) suggestions.push('12+ characters use karo');
  if (!checks.uppercase) suggestions.push('Capital letters add karo (A-Z)');
  if (!checks.lowercase) suggestions.push('Small letters add karo (a-z)');
  if (!checks.numbers) suggestions.push('Numbers add karo (0-9)');
  if (!checks.special) suggestions.push('Special chars add karo (!@#$)');
  if (!checks.noCommon) suggestions.push('Yeh common password hai!');
  if (!checks.noRepeating) suggestions.push('Repeating characters mat use karo');
  const charset = (checks.uppercase?26:0)+(checks.lowercase?26:0)+(checks.numbers?10:0)+(checks.special?32:0);
  const secs = Math.pow(charset||26, password.length) / 1e10;
  const crackTime = secs < 1 ? 'Instant' : secs < 60 ? `${Math.round(secs)}s` : secs < 3600 ? `${Math.round(secs/60)} min` : secs < 86400 ? `${Math.round(secs/3600)} hours` : secs < 31536000 ? `${Math.round(secs/86400)} days` : `${Math.round(secs/31536000)} years`;
  res.json({ success: true, type: 'password', strength, score, maxScore: 7, color, checks, suggestions, crackTime });
};

// ── Domain Analyzer ───────────────────────────────────────────────────────────
const analyzeDomain = async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ success: false, message: 'Domain required' });
  try {
    const r = await axios.get(`http://ip-api.com/json/${domain}?fields=status,country,city,isp,org,lat,lon,query`, { timeout: 6000 });
    res.json({ success: true, type: 'domain', domain, ip: r.data?.query, location: r.data ? `${r.data.city}, ${r.data.country}` : 'Unknown', isp: r.data?.isp, lat: r.data?.lat, lon: r.data?.lon });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { trackIp, lookupPhone, checkEmailBreach, searchUsername, findSubdomains, checkPhishing, analyzePassword, analyzeDomain };
