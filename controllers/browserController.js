const axios = require('axios');
const groqService = require('../services/groqService');
const logger = require('../services/loggerService');

// Simple HTML tag stripper
const stripHtml = (html) => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 8000); // Limit context
};

// Extract page title
const extractTitle = (html) => {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : 'Unknown Page';
};

// Extract meta description
const extractDescription = (html) => {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  return match ? match[1].trim() : '';
};

// Extract all links
const extractLinks = (html, baseUrl) => {
  const links = [];
  const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && links.length < 20) {
    const href = match[1];
    const text = match[2].trim();
    if (text && href && !href.startsWith('#') && !href.startsWith('javascript')) {
      try {
        const url = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        links.push({ url, text: text.slice(0, 50) });
      } catch {}
    }
  }
  return links;
};

// Fetch webpage
const fetchPage = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, message: 'URL required' });

  try {
    let fetchUrl = url;
    if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;

    logger.info(`Browser fetch: ${fetchUrl}`, 'BROWSER');

    const response = await axios.get(fetchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 3,
    });

    const html = response.data;
    const title = extractTitle(html);
    const description = extractDescription(html);
    const content = stripHtml(html);
    const links = extractLinks(html, fetchUrl);

    // Auto AI summary
    const summaryResult = await groqService.chat([{
      role: 'user',
      content: `Yeh webpage ka content hai:\n\nTitle: ${title}\n\n${content.slice(0, 4000)}\n\nIsका ek short summary de 3-4 lines mein. Key points bullet mein bata. Hinglish mein.`
    }]);

    logger.success(`Browser fetch done: ${title}`, 'BROWSER');

    res.json({
      success: true,
      title,
      description,
      content,
      links,
      url: fetchUrl,
      summary: summaryResult.content,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(fetchUrl).hostname}&sz=32`,
    });

  } catch (error) {
    logger.error(`Browser fetch error: ${error.message}`, 'BROWSER_ERROR');

    // Tavily fallback
    if (process.env.TAVILY_API_KEY) {
      try {
        const tavily = await axios.post('https://api.tavily.com/search', {
          api_key: process.env.TAVILY_API_KEY,
          query: url,
          search_depth: 'basic',
          include_answer: true,
        });
        return res.json({
          success: true,
          title: url,
          content: tavily.data.answer || 'Content not available',
          links: [],
          url,
          summary: tavily.data.answer || 'Could not fetch page',
          favicon: '',
          fallback: true,
        });
      } catch {}
    }

    res.status(500).json({ success: false, message: `Page fetch nahi ho paya: ${error.message}` });
  }
};

// Analyze selected text / ask question about page
const analyzeText = async (req, res) => {
  const { content, question, title } = req.body;
  if (!content || !question) return res.status(400).json({ success: false, message: 'Content and question required' });

  try {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const result = await groqService.chat([{
      role: 'user',
      content: `Aaj ki date: ${today}\n\nWebpage: "${title}"\n\nPage ka content (real-time fetched):\n${content.slice(0, 5000)}\n\nQuestion: ${question}\n\nImportant: Sirf is page ke content ke basis pe answer de. Apna purana knowledge mat use kar. Jo page mein likha hai wohi bata. Hinglish mein answer de.`
    }]);

    res.json({ success: true, answer: result.content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { fetchPage, analyzeText };
