const { google } = require('googleapis');
const logger = require('./loggerService');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
};

const getTokens = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

const setCredentials = (tokens) => {
  oauth2Client.setCredentials(tokens);
};

// Gmail
const getEmails = async (tokens, maxResults = 5) => {
  try {
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: ['INBOX'],
      q: 'is:unread'
    });
    const messages = res.data.messages || [];
    const emailDetails = await Promise.all(
      messages.slice(0, maxResults).map(async (msg) => {
        const detail = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
        const headers = detail.data.payload.headers;
        return {
          id: msg.id,
          from: headers.find(h => h.name === 'From')?.value || 'Unknown',
          subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
          date: headers.find(h => h.name === 'Date')?.value || '',
          snippet: detail.data.snippet
        };
      })
    );
    logger.success(`Gmail fetched ${emailDetails.length} emails`, 'GMAIL');
    return emailDetails;
  } catch (error) {
    logger.error(`Gmail error: ${error.message}`, 'GMAIL_ERROR');
    throw error;
  }
};

const sendEmail = async (tokens, to, subject, body) => {
  try {
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const message = [`To: ${to}`, `Subject: ${subject}`, '', body].join('\n');
    const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    logger.success(`Email sent to ${to}`, 'GMAIL');
    return true;
  } catch (error) {
    logger.error(`Gmail send error: ${error.message}`, 'GMAIL_ERROR');
    throw error;
  }
};

// Calendar
const getCalendarEvents = async (tokens, maxResults = 5) => {
  try {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    });
    logger.success(`Calendar fetched ${res.data.items.length} events`, 'CALENDAR');
    return res.data.items.map(e => ({
      id: e.id,
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
      description: e.description
    }));
  } catch (error) {
    logger.error(`Calendar error: ${error.message}`, 'CALENDAR_ERROR');
    throw error;
  }
};

const addCalendarEvent = async (tokens, title, startTime, endTime, description = '') => {
  try {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const event = {
      summary: title,
      description,
      start: { dateTime: startTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: endTime, timeZone: 'Asia/Kolkata' }
    };
    const res = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
    logger.success(`Calendar event added: ${title}`, 'CALENDAR');
    return res.data;
  } catch (error) {
    logger.error(`Calendar add error: ${error.message}`, 'CALENDAR_ERROR');
    throw error;
  }
};

// Drive
const getDriveFiles = async (tokens, maxResults = 10, query = '') => {
  try {
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const res = await drive.files.list({
      pageSize: maxResults,
      fields: 'files(id, name, mimeType, modifiedTime, size)',
      q: query ? `name contains '${query}'` : undefined,
      orderBy: 'modifiedTime desc'
    });
    logger.success(`Drive fetched ${res.data.files.length} files`, 'DRIVE');
    return res.data.files;
  } catch (error) {
    logger.error(`Drive error: ${error.message}`, 'DRIVE_ERROR');
    throw error;
  }
};

module.exports = {
  oauth2Client, getAuthUrl, getTokens, setCredentials,
  getEmails, sendEmail,
  getCalendarEvents, addCalendarEvent,
  getDriveFiles
};
