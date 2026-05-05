require('dotenv').config();

const http = require('node:http');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { OpenAI } = require('openai');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const compression = require('compression');
const { buildListenFailureResult, probeAtlasHealth } = require('./startup-utils');
const rateLimitStore = new Map();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Set a strong random string (32+ chars) before starting the server.');
  process.exit(1);
}

// App configuration
const APP_CONFIG = Object.freeze({
  port: process.env.PORT || 3000,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.API_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM || 'Atlas Wellness <onboarding@resend.dev>',
  publicAppUrl:
    process.env.PUBLIC_APP_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN ||
    process.env.RAILWAY_STATIC_URL ||
    process.env.DEPLOY_URL ||
    'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  jwtSecret: process.env.JWT_SECRET,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  anonymousUserId: 'anonymous',
  maxContextMessages: 16,
  maxTokens: 400,
  temperature: 0.7,
  rateWindowMs: 60_000,
  rateLimitAuthIp: 30,
  rateLimitAuthUser: 20,
  rateLimitChatIp: 90,
  rateLimitChatUser: 60,
  guestPrefix: 'guest-',
  rateLimitCheckinUser: 10,
  rateLimitCheckinIp: 20,
  rateLimitDashboardIp: 30,
  rateLimitDashboardUser: 30,
  rateLimitNotifyUser: 30,
  rateLimitNotifyIp: 60,
});

const runtimeSettings = {
  temperature: APP_CONFIG.temperature,
  maxTokens: APP_CONFIG.maxTokens,
  maxContextMessages: APP_CONFIG.maxContextMessages,
};

const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  cadence: 'daily',
  dailyReminder: true,
  reminderTime: '20:00',
  timezone: 'UTC',
  weeklySummary: false,
  push: false,
  email: true,
});

const memoryStore = {
  users: new Map(),
  sessions: [],
  messages: [],
  settings: new Map(),
  passwordResets: [],
  dailyCheckins: [],
  kbDocuments: [],
};

let persistenceMode =
  APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseKey ? 'supabase' : 'memory';

  const GREETING_PHRASES = Object.freeze([
  'hello',
  'hi',
  'hey',
  'hello atlas',
  'hi atlas',
  'hey atlas',
  'hola',
  'hola atlas',
  'buenas',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
]);

const MEDICAL_REQUEST_MARKERS = Object.freeze([
  'diagnose',
  'diagnosis',
  'what do i have',
  'what illness do i have',
  'what disease do i have',
  'what is wrong with me',
  'treat',
  'treatment',
  'prescribe',
  'prescription',
  'medication',
  'medicine',
  'antibiotic',
  'dosage',
  'dose',
  'diagnostico',
  'diagnosticar',
  'que tengo',
  'que enfermedad tengo',
  'que me pasa',
  'tratamiento',
  'tratar',
  'recetar',
  'receta',
  'medicamento',
  'medicina',
  'antibiotico',
  'dosis',
]);

const MENTAL_HEALTH_MARKERS = Object.freeze([
  'suicide',
  'suicidal',
  'kill myself',
  'killing myself',
  'want to die',
  'wanna die',
  'end my life',
  'take my life',
  'no reason to live',
  'not worth living',
  'self harm',
  'hurt myself',
  'cut myself',
  'harm myself',
  'give up on life',
  'cant go on',
  'cannot go on',
  'dont want to be here',
  'do not want to be here',
  // Spanish equivalents
  'suicidio',
  'suicidarme',
  'matarme',
  'no quiero vivir',
  'hacerme dano',
]);

const OFF_TOPIC_MARKERS = Object.freeze([
  'stock price',
  'stock market',
  'buy stocks',
  'invest in',
  'bitcoin',
  'cryptocurrency',
  'write code',
  'debug my code',
  'fix my code',
  'legal advice',
  'file a lawsuit',
  'who won the game',
  'sports score',
  'election results',
  'write an essay',
  'do my homework',
  'solve this equation',
  'weather forecast',
]);

const DISTRESSED_KEYWORDS = Object.freeze([
  'hopeless',
  'desperate',
  'miserable',
  'unbearable',
  'burned out',
  'burnt out',
  'falling apart',
  'breaking down',
  'panic attack',
  'panicking',
  'losing my mind',
  'cant cope',
  'cannot cope',
  'everything is too much',
  'drowning in',
  'too much to handle',
  'completely drained',
  'hit a wall',
]);

const STRESSED_KEYWORDS = Object.freeze([
  'stressed',
  'anxious',
  'anxiety',
  'worried',
  'nervous',
  'tense',
  'struggling',
  'exhausted',
  'overwhelmed',
  'cant sleep',
  'cannot sleep',
  'not sleeping',
  'barely sleeping',
  'so tired',
  'worn out',
  'under pressure',
  'hard time',
  'tough time',
  'feeling off',
  'run down',
]);

const POSITIVE_KEYWORDS = Object.freeze([
  'feeling great',
  'feeling good',
  'doing well',
  'so much better',
  'much better',
  'making progress',
  'feeling motivated',
  'feeling energized',
  'feeling energised',
  'feeling amazing',
  'really happy',
  'in a good mood',
  'thriving',
  'fantastic',
]);

const ASSISTANT_SYSTEM_MESSAGE = Object.freeze({
  role: 'system',
  content: [
    'You are Atlas, a supportive wellness assistant focused only on everyday well-being.',
    'Stay within wellness topics such as sleep, stress management, energy, focus, routines, motivation, movement, hydration, recovery, work-life balance, and healthy habits.',
    'Always reply in English, even if the user writes in another language. Keep language simple and clear.',
    'Do not provide medical diagnoses, symptom interpretation, triage, treatment plans, prescriptions, medication advice, or claims about what condition the user has.',
    'If the user asks for diagnosis or treatment, briefly state that you cannot help with that, encourage them to consult a licensed clinician, and then offer safe wellness support instead.',
    'If the request is outside wellness, explain briefly that you only handle wellness support and redirect to a wellness angle.',
    'Keep the tone warm, practical, and concise.',
    'For greetings, reply with a short welcome and ask what part of well-being the user wants help with.',
    'When the user asks for tips, steps, or a plan, use a short numbered list with 3 to 5 items.',
  ].join('\n'),
});

const CHAT_GREETING_MESSAGE =
  "Hello, I'm Atlas, your wellness assistant. I can help with sleep, stress, energy, focus, habits, and everyday well-being. What would you like to improve today?";

const MEDICAL_BOUNDARY_MESSAGE =
  'I can only help with general wellness support and healthy habits. I cannot diagnose conditions, interpret symptoms, or recommend medical treatments. If you are worried about a symptom or need treatment, please consult a licensed clinician. If you want, I can still help with sleep, stress, energy, focus, or daily routines.';

const KB_FALLBACK_MESSAGE =
  'I could not find enough trusted information for that. Could you rephrase or ask something else about wellness?';

const MENTAL_HEALTH_RESPONSE =
  'What you are going through sounds really difficult, and your feelings matter. As a wellness assistant, I am not equipped to provide the support you deserve right now. Please reach out to a mental health professional or a crisis line — in the US you can call or text 988 (Suicide and Crisis Lifeline) any time, day or night. You do not have to face this alone. I am here for sleep, stress, energy, routines, or other wellness topics whenever you are ready.';

const OFF_TOPIC_RESPONSE =
  'I am here specifically to help with everyday wellness — sleep, stress, energy, focus, habits, and daily routines. That topic falls outside what I can help with. If there is a wellness angle you would like to explore, I am happy to help. What would you like to work on?';

const SENTIMENT_TONES = Object.freeze({
  POSITIVE:
    'The user is in a positive or motivated state. Match their energy, acknowledge any progress they mention, and build on their momentum with encouraging language.',
  STRESSED:
    'The user appears stressed or anxious. Use a calm, steady, and reassuring tone. Acknowledge the pressure they are feeling before offering practical steps. Keep suggestions simple and immediately actionable.',
  DISTRESSED:
    'The user appears to be in significant distress. Lead with empathy and validation before anything practical. Use a gentle, unhurried tone. Avoid long action lists until the user feels heard. If it feels right, gently note that talking to someone they trust can also help.',
});

const DIAGNOSTIC_OUTPUT_MARKERS = Object.freeze([
  'you may have',
  'you might have',
  'you could have a',
  'you likely have',
  'you probably have',
  'you appear to have',
  'it sounds like you have',
  'diagnosis',
  'diagnose',
  'prescribe',
  'prescription',
  'medication',
  'symptoms suggest',
  'treatment for',
]);

const DIAGNOSTIC_LEAK_RESPONSE =
  'I cannot diagnose anemia or any other condition. If you are tired most days, it is worth checking in with a licensed clinician, especially about anemia, iron, B12, sleep, thyroid, and other common causes of fatigue. If you want, I can help you organize a short symptom note for the appointment or keep working with you on sleep, stress, energy, and daily routines.';

function assertRequiredConfig(value, message) {
  if (!value) {
    console.error(message);
    process.exit(1);
  }
}

assertRequiredConfig(APP_CONFIG.openaiApiKey, 'ERROR: OPENAI_API_KEY (or API_KEY) is required in .env');

// External clients
const app = express();
const openai = new OpenAI({ apiKey: APP_CONFIG.openaiApiKey });
//const resend = APP_CONFIG.resendApiKey ? new Resend(APP_CONFIG.resendApiKey) : null;
const supabase =
  APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseKey
    ? createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey)
    : null;

if (!supabase) {
  console.warn('Supabase not configured. Using in-memory storage until persistence is enabled.');
}

app.use(compression());
app.use(cors());
app.use(express.json());

const FRONTEND_DIR = path.resolve(__dirname, 'frontend');

const FRONTEND_PAGES = Object.freeze({
  chat: 'chat.html',
  checkin: 'checkin.html',
  dashboard: 'dashboard.html',
  history: 'history.html',
  landing: 'landing.html',
  profile: 'profile.html',
  signin: 'signin.html',
  signup: 'signup.html',
  onboarding: 'onboarding.html',
  admin: 'admin.html',
  'forgot-password': 'forgot-password.html',
  'reset-password': 'reset-password.html',
});

function sendFrontendPage(res, pageFile) {
  res.set('Cache-Control', 'no-store');
  return res.sendFile(path.join(FRONTEND_DIR, pageFile));
}

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const match = req.path.match(/^\/(chat|checkin|dashboard|history|landing|profile|signin|signup|onboarding|admin|forgot-password|reset-password)\.html$/);
  if (!match) {
    return next();
  }

  return res.redirect(301, `/${match[1]}`);
});

app.get('/', (_req, res) => {
  sendFrontendPage(res, 'landing.html');
});

Object.entries(FRONTEND_PAGES).forEach(([route, pageFile]) => {
  app.get(`/${route}`, (_req, res) => sendFrontendPage(res, pageFile));
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.json({}));
app.use(express.static(FRONTEND_DIR, { index: false, maxAge: '7d', immutable: true }));
app.use('/api', authenticateRequest);
const resend = new Resend(APP_CONFIG.resendApiKey);

// Utility helpers
function normalizeContent(content) {
  return content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGreeting(content) {
  return GREETING_PHRASES.includes(normalizeContent(content));
}

function isMedicalRequest(content) {
  const normalized = normalizeContent(content);
  return MEDICAL_REQUEST_MARKERS.some((marker) => normalized.includes(marker));
}

function isMentalHealthCrisis(content) {
  const normalized = normalizeContent(content);
  return MENTAL_HEALTH_MARKERS.some((marker) => normalized.includes(marker));
}

function isOffTopic(content) {
  const normalized = normalizeContent(content);
  return OFF_TOPIC_MARKERS.some((marker) => normalized.includes(marker));
}

function classifySentiment(content) {
  const normalized = normalizeContent(content);
  if (DISTRESSED_KEYWORDS.some((kw) => normalized.includes(kw))) return 'DISTRESSED';
  if (STRESSED_KEYWORDS.some((kw) => normalized.includes(kw))) return 'STRESSED';
  if (POSITIVE_KEYWORDS.some((kw) => normalized.includes(kw))) return 'POSITIVE';
  return 'NEUTRAL';
}

function containsDiagnosticLanguage(text) {
  const normalized = normalizeContent(text);
  return DIAGNOSTIC_OUTPUT_MARKERS.some((marker) => normalized.includes(marker));
}

function getRequestUserId(userId) {
  return userId || APP_CONFIG.anonymousUserId;
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  return jwt.sign(payload, APP_CONFIG.jwtSecret, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, APP_CONFIG.jwtSecret);
  } catch {
    return null;
  }
}

function buildModelMessages(messages) {
  const recentMessages = messages.slice(-runtimeSettings.maxContextMessages);
  const chatMessages = recentMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return [ASSISTANT_SYSTEM_MESSAGE, ...chatMessages];
}

function buildKnowledgeContext(kbResults) {
  if (!kbResults || kbResults.length === 0) return null;
  const lines = kbResults.map((doc, idx) => {
    const snippet = doc.content.slice(0, 500).replace(/\s+/g, ' ').trim();
    return `${idx + 1}. (${doc.title || 'Untitled'}) ${snippet}`;
  });
  return {
    role: 'system',
    content: `Use the following trusted context to answer. If it is not relevant, say you don't have enough info.\n${lines.join(
      '\n'
    )}`,
  };
}

function buildSentimentTone(sentiment) {
  const tone = SENTIMENT_TONES[sentiment];
  if (!tone) return null;
  return { role: 'system', content: tone };
}

function getStyleInstructions(responseStyle = 'balanced') {
  const style = (responseStyle || 'balanced').toString().toLowerCase();
  if (style === 'short') {
    return 'Respond concisely. Use short paragraphs and up to 3–5 bullet points when giving tips. Keep language direct and actionable.';
  }
  if (style === 'detailed') {
    return 'Respond with clear headings, short paragraphs, and examples. Provide more explanation and 2–3 brief examples where helpful. Use bullets for steps and include brief rationale.';
  }
  // balanced
  return 'Respond in a balanced, easy-to-read style: short paragraphs, occasional bullets for steps, and enough context to be useful without overwhelming.';
}

function buildCheckinContext(checkins) {
  if (!checkins || checkins.length === 0) return null;

  const metrics = ['sleep', 'mood', 'energy', 'stress', 'hydration'];
  const sums = Object.fromEntries(metrics.map((m) => [m, 0]));
  const counts = Object.fromEntries(metrics.map((m) => [m, 0]));

  checkins.forEach((row) => {
    metrics.forEach((m) => {
      const val = Number(row[m]);
      if (Number.isFinite(val)) {
        sums[m] += val;
        counts[m]++;
      }
    });
  });

  const parts = metrics
    .map((m) => {
      if (counts[m] === 0) return null;
      const avg = (sums[m] / counts[m]).toFixed(1);
      const note = m === 'stress' ? ' (lower is better)' : '';
      return `${m} ${avg}/10${note}`;
    })
    .filter(Boolean);

  if (parts.length === 0) return null;

  const n = checkins.length;
  return {
    role: 'system',
    content:
      `The user has logged ${n} wellness check-in${n !== 1 ? 's' : ''} in the last 7 days. ` +
      `Their averages on a 0–10 scale: ${parts.join(', ')}. ` +
      `Reference these patterns naturally when they are relevant to the conversation. ` +
      `Do not recite all scores unless the user asks.`,
  };
}

function buildModelMessagesWithContext(messages, kbResults, sentiment = 'NEUTRAL', checkinContext = null) {
  const recentMessages = messages.slice(-runtimeSettings.maxContextMessages);
  const chatMessages = recentMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const toneMsg = buildSentimentTone(sentiment);
  const ctx = buildKnowledgeContext(kbResults);
  const systemParts = [ASSISTANT_SYSTEM_MESSAGE];
  if (toneMsg) systemParts.push(toneMsg);
  if (checkinContext) systemParts.push(checkinContext);
  if (ctx) systemParts.push(ctx);
  return [...systemParts, ...chatMessages];
}

function rateLimit(key, limit) {
  const now = Date.now();
  const windowStart = now - APP_CONFIG.rateWindowMs;
  const entry = rateLimitStore.get(key) || [];
  const recent = entry.filter((ts) => ts > windowStart);
  recent.push(now);
  rateLimitStore.set(key, recent);
  return recent.length <= limit;
}

function rateLimitDual(userKey, ipKey, userLimit, ipLimit) {
  const userOk = userKey ? rateLimit(userKey, userLimit) : true;
  const ipOk = rateLimit(ipKey, ipLimit);
  return userOk && ipOk;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function subtractDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function parseDateOnlyInput(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day);
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function buildDayListInclusive(rangeStart, rangeEnd) {
  const days = [];
  for (let d = startOfDay(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
    days.push(startOfDay(d));
  }
  return days;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

let reminderCronTask = null;
let reminderTickInProgress = false;

function isValidReminderTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeNotificationPreferences(raw = {}) {
  const cadence = raw.cadence === 'weekly' || (raw.weeklySummary && !raw.dailyReminder) ? 'weekly' : 'daily';

  return {
    cadence,
    dailyReminder: !!raw.dailyReminder,
    reminderTime: isValidReminderTime(raw.reminderTime)
      ? raw.reminderTime
      : DEFAULT_NOTIFICATION_PREFERENCES.reminderTime,
    timezone: isValidTimeZone(raw.timezone)
      ? raw.timezone
      : DEFAULT_NOTIFICATION_PREFERENCES.timezone,
    weeklySummary: cadence === 'weekly',
    push: !!raw.push,
    email: !!raw.email,
  };
}

function extractUserIdFromNotificationKey(key) {
  const prefix = 'notifications_';
  if (typeof key !== 'string' || !key.startsWith(prefix)) return null;
  return key.slice(prefix.length) || null;
}

function getTimePartsInZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const partMap = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      partMap[part.type] = Number(part.value);
    }
  }

  return {
    year: partMap.year,
    month: partMap.month,
    day: partMap.day,
    hour: partMap.hour,
    minute: partMap.minute,
    second: partMap.second,
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const p = getTimePartsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

function zonedTimeToUtc(timeZone, year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs);
}

function getUtcStartOfLocalDay(date, timeZone) {
  const p = getTimePartsInZone(date, timeZone);
  return zonedTimeToUtc(timeZone, p.year, p.month, p.day, 0, 0, 0);
}

function getLocalDateKey(date, timeZone) {
  const p = getTimePartsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function getLocalWeekdayShort(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
}

function isReminderDueNow(date, prefs) {
  if (!prefs.dailyReminder || !prefs.email || !isValidReminderTime(prefs.reminderTime)) {
    return false;
  }

  const [targetHour, targetMinute] = prefs.reminderTime.split(':').map(Number);
  const local = getTimePartsInZone(date, prefs.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone);
  return local.hour === targetHour && local.minute === targetMinute;
}

async function listNotificationSettings() {
  return withPersistence(
    'listNotificationSettings',
    async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('key,value')
        .like('key', 'notifications_%');
      if (error) throw error;
      return data || [];
    },
    async () =>
      Array.from(memoryStore.settings.values())
        .filter((row) => typeof row.key === 'string' && row.key.startsWith('notifications_'))
        .map((row) => cloneData(row))
  );
}

async function sendDailyReminderEmail(user, prefs) {
  if (!resend || !user?.email) {
    return false;
  }

  const displayName = user.full_name || user.email.split('@')[0] || 'there';
  const baseUrl = String(APP_CONFIG.publicAppUrl || 'http://localhost:3000').replace(/\/$/, '');
  const checkInUrl = `${baseUrl}/checkin.html`;
  const reminderTimeLabel = prefs.reminderTime || DEFAULT_NOTIFICATION_PREFERENCES.reminderTime;
  const tzLabel = prefs.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone;

  await resend.emails.send({
    from: APP_CONFIG.emailFrom,
    to: user.email,
    subject: 'Atlas is waiting for your check-in',
    text: [
      `Hi ${displayName},`,
      '',
      'This is Atlas, your wellness buddy, popping in for your daily check-in.',
      'Take 60 seconds to log how you are feeling today so Atlas can keep your guidance personal and useful.',
      '',
      `Open your check-in here: ${checkInUrl}`,
      `Preferred reminder time: ${reminderTimeLabel} (${tzLabel}).`,
      '',
      'You can note your sleep, mood, energy, stress, hydration, and anything else on your mind.',
      '',
      'See you there,',
      'Atlas',
      '',
      'P.S. The more you log, the smarter Atlas gets about your routines.',
    ].join('\n'),
  });

  return true;
}

async function sendWelcomeEmail(user, prefs) {
  if (!resend || !user?.email) {
    return false;
  }

  const displayName = user.full_name || user.email.split('@')[0] || 'there';
  const baseUrl = String(APP_CONFIG.publicAppUrl || 'http://localhost:3000').replace(/\/$/, '');
  const chatUrl = `${baseUrl}/chat`;
  const checkInUrl = `${baseUrl}/checkin`;
  const reminderTimeLabel = prefs.reminderTime || DEFAULT_NOTIFICATION_PREFERENCES.reminderTime;
  const tzLabel = prefs.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  const cadenceLabel = prefs.weeklySummary ? 'weekly summaries' : 'daily check-in reminders';

  await resend.emails.send({
    from: APP_CONFIG.emailFrom,
    to: user.email,
    subject: 'Welcome to Atlas emails',
    text: [
      `Hi ${displayName},`,
      '',
      'You are signed up for Atlas emails now.',
      `Atlas will send ${cadenceLabel} at ${reminderTimeLabel} (${tzLabel}).`,
      '',
      `Check in anytime here: ${checkInUrl}`,
      `Or open Atlas chat here: ${chatUrl}`,
      '',
      'Atlas will use your check-ins to keep guidance practical and personalized.',
      '',
      'If you ever want to change your reminder time or stop emails, update the Notifications section in your profile.',
      '',
      '— Atlas',
    ].join('\n'),
  });

  return true;
}

function isWeeklySummaryDueNow(date, prefs) {
  if (!prefs.weeklySummary || !prefs.email || !isValidReminderTime(prefs.reminderTime)) {
    return false;
  }

  const [targetHour, targetMinute] = prefs.reminderTime.split(':').map(Number);
  const timezone = prefs.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  const local = getTimePartsInZone(date, timezone);
  return getLocalWeekdayShort(date, timezone) === 'Sun' && local.hour === targetHour && local.minute === targetMinute;
}

async function sendWeeklySummaryEmail(user, prefs, now) {
  if (!resend || !user?.email) {
    return false;
  }

  const displayName = user.full_name || user.email.split('@')[0] || 'there';
  const timezone = prefs.timezone || DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  const periodStart = getUtcStartOfLocalDay(subtractDays(now, 6), timezone);
  const checkins = await getCheckinsInRange(user.id, periodStart.toISOString(), now.toISOString());
  const metrics = ['sleep', 'mood', 'energy', 'stress', 'hydration'];
  const labels = {
    sleep: 'Sleep',
    mood: 'Mood',
    energy: 'Energy',
    stress: 'Stress',
    hydration: 'Hydration',
  };

  const averages = Object.fromEntries(
    metrics.map((metric) => [
      metric,
      checkins.length
        ? checkins.reduce((sum, row) => sum + (Number(row[metric]) || 0), 0) / checkins.length
        : null,
    ])
  );

  const lines = [
    `Hi ${displayName},`,
    '',
    'Here is your Atlas weekly summary.',
    '',
    `Check-ins this week: ${checkins.length}`,
    '',
  ];

  metrics.forEach((metric) => {
    const value = averages[metric];
    lines.push(`${labels[metric]} average: ${value === null ? 'No check-ins yet' : `${value.toFixed(1)}/10`}`);
  });

  if (checkins.length > 0) {
    const latest = [...checkins].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    lines.push(
      '',
      'Latest check-in:',
      `- Sleep: ${Number(latest.sleep) || 0}/10`,
      `- Mood: ${Number(latest.mood) || 0}/10`,
      `- Energy: ${Number(latest.energy) || 0}/10`,
      `- Stress: ${Number(latest.stress) || 0}/10`,
      `- Hydration: ${Number(latest.hydration) || 0}/10`
    );
  } else {
    lines.push('', 'No check-ins were logged this week yet. Add a check-in in Atlas to start tracking trends.');
  }

  lines.push('', 'Open Atlas anytime to review the full timeline and guidance.', '', '— Atlas Wellness');

  await resend.emails.send({
    from: APP_CONFIG.emailFrom,
    to: user.email,
    subject: 'Atlas weekly wellness summary',
    text: lines.join('\n'),
  });

  return true;
}

async function processNotificationTick() {
  if (reminderTickInProgress) return;
  reminderTickInProgress = true;

  try {
    const now = new Date();
    const rows = await listNotificationSettings();

    for (const row of rows) {
      const userId = extractUserIdFromNotificationKey(row.key);
      if (!userId) continue;

      const prefs = normalizeNotificationPreferences(row.value || {});
      const todayKey = getLocalDateKey(now, prefs.timezone);
      const user = await findUserById(userId);
      if (!user?.email) continue;

      if (isReminderDueNow(now, prefs)) {
        const stateKey = `notification_state_${userId}_daily`;
        const stateRow = await getSetting(stateKey);
        const lastReminderLocalDate = stateRow?.value?.lastReminderLocalDate || null;

        if (lastReminderLocalDate !== todayKey) {
          const dayStartUtc = getUtcStartOfLocalDay(now, prefs.timezone);
          const checkinsToday = await countCheckinsSince(userId, dayStartUtc.toISOString());
          if (checkinsToday > 0) {
            await upsertSetting(stateKey, {
              lastReminderLocalDate: todayKey,
              skipped: 'already_checked_in',
              updatedAt: now.toISOString(),
            });
          } else {
            try {
              const sent = await sendDailyReminderEmail(user, prefs);
              if (sent) {
                await upsertSetting(stateKey, {
                  lastReminderLocalDate: todayKey,
                  lastSentAt: now.toISOString(),
                });
                console.log(`Daily reminder sent to ${user.email} for user ${userId}`);
              }
            } catch (error) {
              console.error(`Daily reminder send failed for ${userId}:`, error?.message || error);
            }
          }
        }
      }

      if (isWeeklySummaryDueNow(now, prefs)) {
        const stateKey = `notification_state_${userId}_weekly`;
        const stateRow = await getSetting(stateKey);
        const lastReminderLocalDate = stateRow?.value?.lastReminderLocalDate || null;

        if (lastReminderLocalDate !== todayKey) {
          try {
            const sent = await sendWeeklySummaryEmail(user, prefs, now);
            if (sent) {
              await upsertSetting(stateKey, {
                lastReminderLocalDate: todayKey,
                lastSentAt: now.toISOString(),
              });
              console.log(`Weekly summary sent to ${user.email} for user ${userId}`);
            }
          } catch (error) {
            console.error(`Weekly summary send failed for ${userId}:`, error?.message || error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Notification scheduler tick failed:', error?.message || error);
  } finally {
    reminderTickInProgress = false;
  }
}

function startReminderScheduler() {
  if (reminderCronTask) return;

  reminderCronTask = cron.schedule('* * * * *', () => {
    void processNotificationTick();
  });

  if (!resend) {
    console.warn('Notification scheduler started without RESEND_API_KEY. Email reminders are disabled.');
  } else {
    console.log('Notification scheduler started (runs every minute).');
  }
}

function markPersistenceUnavailable(context, error) {
  if (persistenceMode === 'memory') return;
  persistenceMode = 'memory';
  console.warn(`Persistence unavailable during ${context}. Falling back to in-memory storage.`);

  const details = error?.details || error?.message;
  if (details) {
    console.warn(`Persistence details: ${details}`);
  }
}

async function withPersistence(context, remoteAction, memoryAction) {
  if (persistenceMode !== 'supabase' || !supabase) {
    return memoryAction();
  }

  try {
    return await remoteAction();
  } catch (error) {
    markPersistenceUnavailable(context, error);
    return memoryAction();
  }
}
async function handleNotificationsTest(req, res) {
  try {
    const user = await findUserById(req.user.userId);

    if (!user?.email) {
      return res.status(400).json({
        error: 'No email found for this account.',
      });
    }

    const data = await getSetting(`notifications_${req.user.userId}`);
    const prefs = normalizeNotificationPreferences(
      data?.value || DEFAULT_NOTIFICATION_PREFERENCES
    );

    await sendDailyReminderEmail(user, prefs);

    return res.json({
      success: true,
      message: `Test notification sent to ${user.email}`,
    });
  } catch (error) {
    console.error('Error in /api/notifications/test:', error);
    return res.status(500).json({
      error: 'Could not send test notification.',
      details: error.message,
    });
  }
}

async function handleNotificationsWelcome(req, res) {
  try {
    const user = await findUserById(req.user.userId);

    if (!user?.email) {
      return res.status(400).json({
        error: 'No email found for this account.',
      });
    }

    const prefs = normalizeNotificationPreferences(req.body || {});
    await upsertSetting(`notifications_${req.user.userId}`, prefs);
    await sendWelcomeEmail(user, prefs);

    return res.json({
      success: true,
      message: `You are signed up for Atlas emails at ${prefs.reminderTime} (${prefs.timezone}).`,
    });
  } catch (error) {
    console.error('Error in /api/notifications/welcome:', error);
    return res.status(500).json({
      error: 'Could not sign up for Atlas emails.',
      details: error.message,
    });
  }
}
function ensureMemoryUser(userId, email = null, role = 'user', passwordHash = null, fullName = null) {
  const existing = memoryStore.users.get(userId);
  const now = new Date().toISOString();
  const nextRole = existing?.role === 'admin' && role === 'user' ? 'admin' : role || existing?.role || 'user';
  const nextUser = {
    id: userId,
    email: email ?? existing?.email ?? null,
    full_name: fullName ?? existing?.full_name ?? null,
    password_hash: passwordHash || existing?.password_hash || null,
    role: nextRole,
    token_version: existing?.token_version || 0,
    onboarding_complete: existing?.onboarding_complete || false,
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  memoryStore.users.set(userId, nextUser);
  return cloneData(nextUser);
}

function updateMemoryUser(userId, updates) {
  const existing = memoryStore.users.get(userId);
  if (!existing) return null;

  const nextUser = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  memoryStore.users.set(userId, nextUser);
  return cloneData(nextUser);
}

function findMemoryUserByEmail(email) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase();
  for (const user of memoryStore.users.values()) {
    if ((user.email || '').toLowerCase() === normalizedEmail) {
      return cloneData(user);
    }
  }
  return null;
}

function createMemorySession(userId) {
  const session = {
    id: crypto.randomUUID(),
    user_id: userId,
    title: null,
    created_at: new Date().toISOString(),
  };

  memoryStore.sessions.push(session);
  return cloneData(session);
}

function updateMemorySessionTitle(sessionId, title) {
  const idx = memoryStore.sessions.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    memoryStore.sessions[idx] = { ...memoryStore.sessions[idx], title };
  }
}

function getLatestMemorySession(userId) {
  const sessions = memoryStore.sessions
    .filter((session) => session.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return sessions[0] ? cloneData(sessions[0]) : null;
}

function getMemoryMessages(sessionId) {
  return memoryStore.messages
    .filter((message) => message.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((message) => cloneData(message));
}

function insertMemoryMessage(sessionId, role, content) {
  const message = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    role,
    content,
    created_at: new Date().toISOString(),
  };

  memoryStore.messages.push(message);
  return cloneData(message);
}

function getAllMemorySessions(userId) {
  const userSessions = memoryStore.sessions
    .filter(s => s.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return userSessions.map(session => {
    const firstMsg = memoryStore.messages
      .filter(m => m.session_id === session.id && m.role === 'user')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    return {
      id: session.id,
      created_at: session.created_at,
      title: session.title || null,
      first_message: firstMsg ? firstMsg.content : null,
    };
  }).filter(s => s.first_message !== null);
}

function getMemorySessionByIdAndUser(sessionId, userId) {
  const session = memoryStore.sessions.find(s => s.id === sessionId && s.user_id === userId);
  return session ? cloneData(session) : null;
}

function deleteMemorySessionByIdAndUser(sessionId, userId) {
  const beforeLen = memoryStore.sessions.length;
  memoryStore.sessions = memoryStore.sessions.filter(
    (session) => !(session.id === sessionId && session.user_id === userId)
  );
  const deleted = memoryStore.sessions.length !== beforeLen;
  if (deleted) {
    memoryStore.messages = memoryStore.messages.filter((message) => message.session_id !== sessionId);
  }
  return deleted;
}

function upsertMemorySetting(key, value) {
  const row = {
    key,
    value: cloneData(value),
    updated_at: new Date().toISOString(),
  };

  memoryStore.settings.set(key, row);
  return cloneData(row);
}

function getMemorySetting(key) {
  const row = memoryStore.settings.get(key);
  return row ? cloneData(row) : null;
}

function createMemoryPasswordReset(userId, tokenHash, expiresAt) {
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    used: false,
    created_at: new Date().toISOString(),
  };

  memoryStore.passwordResets.push(row);
  return cloneData(row);
}

function getActiveMemoryPasswordResets(nowIso) {
  return memoryStore.passwordResets
    .filter((row) => !row.used && row.expires_at > nowIso)
    .map((row) => cloneData(row));
}

function markMemoryPasswordResetUsed(resetId) {
  const match = memoryStore.passwordResets.find((row) => row.id === resetId);
  if (!match) return null;
  match.used = true;
  return cloneData(match);
}

function countMemoryCheckinsSince(userId, fromIso) {
  return memoryStore.dailyCheckins.filter(
    (row) => row.user_id === userId && row.created_at >= fromIso
  ).length;
}

function insertMemoryCheckin(payload) {
  const row = {
    id: crypto.randomUUID(),
    ...payload,
    created_at: new Date().toISOString(),
  };

  memoryStore.dailyCheckins.push(row);
  return cloneData(row);
}

function getMemoryCheckinsInRange(userId, fromIso, toIso) {
  return memoryStore.dailyCheckins
    .filter((row) => row.user_id === userId && row.created_at >= fromIso && row.created_at <= toIso)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((row) => cloneData(row));
}

function searchMemoryKnowledge(query) {
  const normalized = normalizeContent(query);
  if (!normalized) return [];

  return memoryStore.kbDocuments
    .filter((doc) => normalizeContent(`${doc.title} ${doc.content}`).includes(normalized))
    .slice(0, 5)
    .map((doc) => cloneData(doc));
}

// Data access with graceful in-memory fallback
async function ensureUser(userId, email = null, role = 'user', passwordHash = null, fullName = null) {
  return withPersistence(
    'ensureUser',
    async () => {
      const payload = { id: userId, email, role };
      if (passwordHash) payload.password_hash = passwordHash;
      if (fullName) payload.full_name = fullName;

      console.log('ensureUser: upserting user', { id: userId, email });
      try {
        const { data, error } = await supabase.from('users').upsert(payload).select();
        if (error) {
          console.error('ensureUser: supabase upsert error', error);
          throw error;
        }
        console.log('ensureUser: upsert succeeded', { id: userId, returned: Array.isArray(data) ? data.length : null });
        return data[0];
      } catch (err) {
        console.error('ensureUser: exception during upsert', err?.message || err);
        throw err;
      }
    },
    async () => ensureMemoryUser(userId, email, role, passwordHash, fullName)
  );
}

async function findUserByEmail(email) {
  return withPersistence(
    'findUserByEmail',
    async () => {
      console.log('findUserByEmail: querying for', email);
      const { data, error } = await supabase.from('users').select('*').eq('email', email).limit(1);
      if (error) {
        console.error('findUserByEmail: supabase error', error);
        throw error;
      }
      const result = data?.[0] || null;
      console.log('findUserByEmail: result', !!result);
      return result;
    },
    async () => findMemoryUserByEmail(email)
  );
}

async function findUserById(id) {
  return withPersistence(
    'findUserById',
    async () => {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    async () => {
      const user = memoryStore.users.get(id);
      return user ? cloneData(user) : null;
    }
  );
}

async function updateUser(userId, updates) {
  return withPersistence(
    'updateUser',
    async () => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    },
    async () => updateMemoryUser(userId, updates)
  );
}

async function getOrCreateSession(userId) {
  return withPersistence(
    'getOrCreateSession',
    async () => {
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (sessions.length > 0) return sessions[0];

      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({ user_id: userId })
        .select();

      if (insertError) throw insertError;
      return data[0];
    },
    async () => getLatestMemorySession(userId) || createMemorySession(userId)
  );
}

async function getMessages(sessionId) {
  return withPersistence(
    'getMessages',
    async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    async () => getMemoryMessages(sessionId)
  );
}

async function insertMessage(sessionId, role, content) {
  return withPersistence(
    'insertMessage',
    async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ session_id: sessionId, role, content })
        .select();

      if (error) throw error;
      return data[0];
    },
    async () => insertMemoryMessage(sessionId, role, content)
  );
}

async function createFreshSession(userId) {
  return withPersistence(
    'createFreshSession',
    async () => {
      const { data, error } = await supabase
        .from('sessions')
        .insert({ user_id: userId })
        .select();

      if (error) throw error;
      return data[0];
    },
    async () => createMemorySession(userId)
  );
}

async function updateSessionTitle(sessionId, title) {
  return withPersistence(
    'updateSessionTitle',
    async () => {
      const { error } = await supabase
        .from('sessions')
        .update({ title })
        .eq('id', sessionId);
      if (error) throw error;
    },
    async () => updateMemorySessionTitle(sessionId, title)
  );
}

async function generateSessionTitle(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  if (!userMessages.length) return null;

  const excerpt = messages
    .slice(0, 8)
    .map(m => `${m.role === 'user' ? 'User' : 'Atlas'}: ${m.content.slice(0, 120)}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: APP_CONFIG.openaiModel,
    messages: [
      {
        role: 'system',
        content: 'Generate a short title of 3–5 words for this wellness conversation. Reply with the title only — no punctuation, quotes, or extra words.',
      },
      { role: 'user', content: excerpt },
    ],
    max_completion_tokens: 16,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() || null;
}

async function getAllSessions(userId) {
  return withPersistence(
    'getAllSessions',
    async () => {
      let sessions = null;
      let error = null;

      const querySessions = async (selectClause) => {
        const result = await supabase
          .from('sessions')
          .select(selectClause)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        sessions = result.data;
        error = result.error;
      };

      await querySessions('id, created_at, title');

      if (error && /column .*title/i.test(error.message || '')) {
        console.warn('getAllSessions: title column missing, retrying without it');
        await querySessions('id, created_at');
      }

      if (error) throw error;
      if (!sessions || sessions.length === 0) return [];

      const sessionIds = sessions.map(s => s.id);
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('session_id, content, created_at')
        .in('session_id', sessionIds)
        .eq('role', 'user')
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      const firstMsgMap = {};
      for (const msg of (messages || [])) {
        if (!firstMsgMap[msg.session_id]) firstMsgMap[msg.session_id] = msg.content;
      }

      return sessions
        .map(s => ({ id: s.id, created_at: s.created_at, title: s.title || null, first_message: firstMsgMap[s.id] || null }))
        .filter(s => s.first_message !== null);
    },
    async () => getAllMemorySessions(userId)
  );
}

async function getSessionByIdAndUser(sessionId, userId) {
  return withPersistence(
    'getSessionByIdAndUser',
    async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, created_at')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
      if (error) return null;
      return data;
    },
    async () => getMemorySessionByIdAndUser(sessionId, userId)
  );
}

async function deleteSessionByIdAndUser(sessionId, userId) {
  return withPersistence(
    'deleteSessionByIdAndUser',
    async () => {
      const { data: sessionRows, error: sessionLookupError } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .limit(1);
      if (sessionLookupError) throw sessionLookupError;
      if (!Array.isArray(sessionRows) || sessionRows.length === 0) {
        return false;
      }

      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('session_id', sessionId);
      if (msgError) throw msgError;

      const { data, error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select('id')
        .limit(1);
      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    },
    async () => deleteMemorySessionByIdAndUser(sessionId, userId)
  );
}

async function upsertSetting(key, value) {
  return withPersistence(
    'upsertSetting',
    async () => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
      return null;
    },
    async () => upsertMemorySetting(key, value)
  );
}

async function getSetting(key) {
  return withPersistence(
    'getSetting',
    async () => {
      const { data, error } = await supabase.from('settings').select('*').eq('key', key).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    async () => getMemorySetting(key)
  );
}

async function loadSettingsFromDb() {
  const rows = await withPersistence(
    'loadSettingsFromDb',
    async () => {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      return data || [];
    },
    async () => Array.from(memoryStore.settings.values()).map((row) => cloneData(row))
  );

  rows.forEach((row) => {
    if (row.key === 'temperature' && typeof row.value?.temperature === 'number') {
      runtimeSettings.temperature = row.value.temperature;
    }
    if (row.key === 'maxTokens' && typeof row.value?.maxTokens === 'number') {
      runtimeSettings.maxTokens = row.value.maxTokens;
    }
    if (row.key === 'maxContextMessages' && typeof row.value?.maxContextMessages === 'number') {
      runtimeSettings.maxContextMessages = row.value.maxContextMessages;
    }
  });
}

async function createPasswordReset(userId, tokenHash, expiresAt) {
  return withPersistence(
    'createPasswordReset',
    async () => {
      const { data, error } = await supabase
        .from('password_resets')
        .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
        .select();

      if (error) throw error;
      return data[0];
    },
    async () => createMemoryPasswordReset(userId, tokenHash, expiresAt)
  );
}

async function listActivePasswordResets(nowIso) {
  return withPersistence(
    'listActivePasswordResets',
    async () => {
      const { data, error } = await supabase
        .from('password_resets')
        .select('*')
        .eq('used', false)
        .gt('expires_at', nowIso);

      if (error) throw error;
      return data || [];
    },
    async () => getActiveMemoryPasswordResets(nowIso)
  );
}

async function markPasswordResetUsed(resetId) {
  return withPersistence(
    'markPasswordResetUsed',
    async () => {
      const { data, error } = await supabase
        .from('password_resets')
        .update({ used: true })
        .eq('id', resetId)
        .select()
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    },
    async () => markMemoryPasswordResetUsed(resetId)
  );
}

async function countCheckinsSince(userId, fromIso) {
  return withPersistence(
    'countCheckinsSince',
    async () => {
      const { count, error } = await supabase
        .from('daily_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', fromIso);

      if (error) throw error;
      return count || 0;
    },
    async () => countMemoryCheckinsSince(userId, fromIso)
  );
}

async function createCheckin(payload) {
  return withPersistence(
    'createCheckin',
    async () => {
      const { data, error } = await supabase.from('daily_checkins').insert(payload).select();
      if (error) throw error;
      return data[0];
    },
    async () => insertMemoryCheckin(payload)
  );
}

async function getCheckinsInRange(userId, fromIso, toIso) {
  return withPersistence(
    'getCheckinsInRange',
    async () => {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', fromIso)
        .lte('created_at', toIso);

      if (error) throw error;
      return data || [];
    },
    async () => getMemoryCheckinsInRange(userId, fromIso, toIso)
  );
}

// Auth helpers
async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return next();

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return next();

  try {
    const dbUser = await findUserById(decoded.userId);
    if (!dbUser) return next();
    if (typeof decoded.tokenVersion === 'number' && decoded.tokenVersion !== (dbUser.token_version || 0)) {
      return next();
    }
    req.user = {
      userId: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.full_name || null,
      role: dbUser.role || 'user',
      onboardingComplete: dbUser.onboarding_complete || false,
      tokenVersion: dbUser.token_version || 0,
    };
  } catch (error) {
    console.error('Auth middleware error:', error.message);
  }
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

async function ensureAdminSeed() {
  if (!APP_CONFIG.adminEmail || !APP_CONFIG.adminPassword) {
    console.warn('Admin seed skipped: ADMIN_EMAIL and ADMIN_PASSWORD not set.');
    return;
  }

  const email = APP_CONFIG.adminEmail.toLowerCase();
  const existing = await findUserByEmail(email);

  if (existing) {
    const updates = { role: 'admin' };
    if (!existing.password_hash) {
      updates.password_hash = await hashPassword(APP_CONFIG.adminPassword);
    }
    await updateUser(existing.id, updates);
    console.log('Ensured admin role for existing user.');
    return;
  }

  const passwordHash = await hashPassword(APP_CONFIG.adminPassword);
  await ensureUser(email, email, 'admin', passwordHash);
  console.log('Seeded default admin user from env.');
}

// Assistant logic
async function getActiveSession(userId) {
  await ensureUser(userId);
  return getOrCreateSession(userId);
}

async function storeAssistantReply(sessionId, content) {
  await insertMessage(sessionId, 'assistant', content);
  return content;
}

async function generateAssistantReply(messages, kbResults = [], sentiment = 'NEUTRAL', checkinContext = null, responseStyle = 'balanced') {
  let completion;
  try {
    const baseMessages = buildModelMessagesWithContext(messages, kbResults, sentiment, checkinContext);
    const styleInstructions = getStyleInstructions(responseStyle);
    // Insert style instructions as a system message right after the assistant system prompt
    const systemInserted = [baseMessages[0], { role: 'system', content: styleInstructions }, ...baseMessages.slice(1)];
    console.log('OpenAI request model:', APP_CONFIG.openaiModel, 'responseStyle:', responseStyle);
    completion = await openai.chat.completions.create({
      model: APP_CONFIG.openaiModel,
      messages: systemInserted,
      max_completion_tokens: runtimeSettings.maxTokens,
      temperature: runtimeSettings.temperature,
    });
  } catch (error) {
    console.error('OpenAI chat completion failed:', error?.message || error);
    return 'Atlas is having trouble connecting to the AI service right now. Please check the OpenAI API key/model settings and try again.';
  }

  const raw =
    completion.choices?.[0]?.message?.content?.trim() ||
    'I did not get a response from the model. Please try again.';

  if (containsDiagnosticLanguage(raw)) {
    console.warn('Output validation: diagnostic language detected — applying safe fallback.');
    return DIAGNOSTIC_LEAK_RESPONSE;
  }

  return raw;
}

// Route handlers
async function handleChat(req, res) {
  try {
    const userKey = req.user?.userId ? `chat:user:${req.user.userId}` : null;
    const ipKey = `chat:ip:${req.ip}`;
    if (
      !rateLimitDual(
        userKey,
        ipKey,
        APP_CONFIG.rateLimitChatUser,
        APP_CONFIG.rateLimitChatIp
      )
    ) {
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }

    const { message, userId, responseStyle } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required and must be a string' });
    }

    const resolvedUserId = req.user?.userId || getRequestUserId(userId);
    const session = await getActiveSession(resolvedUserId);
    await insertMessage(session.id, 'user', message);

    if (isGreeting(message)) {
      const reply = await storeAssistantReply(session.id, CHAT_GREETING_MESSAGE);
      return res.json({ message: reply });
    }

    if (isMedicalRequest(message)) {
      const reply = await storeAssistantReply(session.id, MEDICAL_BOUNDARY_MESSAGE);
      return res.json({ message: reply });
    }

    if (isMentalHealthCrisis(message)) {
      const reply = await storeAssistantReply(session.id, MENTAL_HEALTH_RESPONSE);
      return res.json({ message: reply });
    }

    if (isOffTopic(message)) {
      const reply = await storeAssistantReply(session.id, OFF_TOPIC_RESPONSE);
      return res.json({ message: reply });
    }

    console.log('chat: selected responseStyle =', responseStyle || 'balanced');
    const kbResults = await searchKnowledge(message);
    const sentiment = classifySentiment(message);

    let checkinContext = null;
    if (req.user?.userId && !resolvedUserId.startsWith(APP_CONFIG.guestPrefix)) {
      try {
        const from = subtractDays(new Date(), 7).toISOString();
        const recentCheckins = await getCheckinsInRange(resolvedUserId, from, new Date().toISOString());
        checkinContext = buildCheckinContext(recentCheckins);
      } catch (err) {
        console.warn('Could not load check-in context for chat:', err.message);
      }
    }

    const storedMessages = await getMessages(session.id);
    const assistantReply = await generateAssistantReply(storedMessages, kbResults, sentiment, checkinContext, responseStyle || 'balanced');
    const savedReply = await storeAssistantReply(session.id, assistantReply);

    return res.json({ message: savedReply });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleHistory(req, res) {
  try {
    const userId = req.user?.userId || getRequestUserId(req.query.userId);
    let session;
    if (req.query.sessionId) {
      session = await getSessionByIdAndUser(req.query.sessionId, userId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
    } else {
      session = await getActiveSession(userId);
    }
    const messages = await getMessages(session.id);
    return res.json({ messages, sessionId: session.id });
  } catch (error) {
    console.error('Error in /api/history:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleReset(req, res) {
  try {
    const userId = req.user?.userId || getRequestUserId(req.body.userId);

    try {
      const currentSession = await getOrCreateSession(userId);
      const messages = await getMessages(currentSession.id);
      if (messages.some(m => m.role === 'user')) {
        const title = await generateSessionTitle(messages);
        if (title) await updateSessionTitle(currentSession.id, title);
      }
    } catch {
      // Title generation is non-critical — continue regardless
    }

    await createFreshSession(userId);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/reset:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleOnboardingComplete(req, res) {
  try {
    await updateUser(req.user.userId, { onboarding_complete: true });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/auth/onboarding-complete:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleSessions(req, res) {
  try {
    const userId = req.user?.userId;
    const sessions = await getAllSessions(userId);
    return res.json({ sessions });
  } catch (error) {
    console.error('Error in /api/sessions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDeleteSession(req, res) {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const deleted = await deleteSessionByIdAndUser(sessionId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sessions/:sessionId:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleLogin(req, res) {
  try {
    const ipKey = `auth:ip:${req.ip}`;
    if (!rateLimitDual(null, ipKey, APP_CONFIG.rateLimitAuthUser, APP_CONFIG.rateLimitAuthIp)) {
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await findUserByEmail(normalizedEmail);
    if (!user) {
      user = await findUserById(normalizedEmail);
    }
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.email || user.email !== normalizedEmail) {
      await updateUser(user.id, { email: normalizedEmail });
      user = { ...user, email: normalizedEmail };
    }

    const resolvedEmail = user.email || normalizedEmail;

    const token = signToken({
      userId: user.id,
      role: user.role || 'user',
      email: resolvedEmail,
      tokenVersion: user.token_version || 0,
    });
    return res.json({
      token,
      user: { id: user.id, email: resolvedEmail, role: user.role || 'user', fullName: user.full_name || null, onboardingComplete: user.onboarding_complete || false },
    });
  } catch (error) {
    console.error('Error in /api/auth/login:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

function handleMe(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({ user: req.user });
}

async function handleSignup(req, res) {
  try {
    const ipKey = `auth:ip:${req.ip}`;
    if (!rateLimitDual(null, ipKey, APP_CONFIG.rateLimitAuthUser, APP_CONFIG.rateLimitAuthIp)) {
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }

    const { email, password, fullName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const existing = await findUserByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await hashPassword(password);
    const userId = email.toLowerCase();
    const trimmedName = typeof fullName === 'string' ? fullName.trim() : null;
    await ensureUser(userId, email.toLowerCase(), 'user', passwordHash, trimmedName || null);

    const token = signToken({
      userId,
      role: 'user',
      email: email.toLowerCase(),
      tokenVersion: 0,
    });
    return res.json({ token, user: { id: userId, email: email.toLowerCase(), role: 'user', fullName: trimmedName || null, onboardingComplete: false } });
  } catch (error) {
    console.error('Error in /api/auth/signup:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleProfileUpdate(req, res) {
  try {
    const { email, fullName, currentPassword, newPassword } = req.body || {};
    const userId = req.user.userId;
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = {};

    if (typeof fullName === 'string') {
      const trimmed = fullName.trim();
      updates.full_name = trimmed || null;
    }

    if (email && email.toLowerCase() !== user.email) {
      const existing = await findUserByEmail(email.toLowerCase());
      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = email.toLowerCase();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'currentPassword required to set newPassword' });
      }
      const valid = await verifyPassword(currentPassword, user.password_hash || '');
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      updates.password_hash = await hashPassword(newPassword);
      updates.token_version = (user.token_version || 0) + 1; // invalidate existing tokens
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ success: true });
    }

    await updateUser(userId, updates);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/auth/profile:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleDeleteAccount(req, res) {
  try {
    const userId = req.user.userId;
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await withPersistence(
      'deleteUserSettings',
      async () => {
        await supabase.from('settings').delete().like('key', `notifications_${userId}`);
        await supabase.from('settings').delete().like('key', `notification_state_${userId}_%`);
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) throw error;
      },
      () => {
        memoryStore.settings.forEach((_, key) => {
          if (key === `notifications_${userId}` || key.startsWith(`notification_state_${userId}_`)) {
            memoryStore.settings.delete(key);
          }
        });
        const idx = memoryStore.users.get(userId);
        if (idx !== undefined) memoryStore.users.delete(userId);
      }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/auth/account:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleLogoutAll(req, res) {
  try {
    const user = await findUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const newVersion = (user.token_version || 0) + 1;
    await updateUser(user.id, { token_version: newVersion });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/auth/logout-all:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleRequestReset(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });
    const user = await findUserByEmail(email.toLowerCase());
    if (!user) return res.json({ message: 'If the account exists, a reset link was sent.' });

    const token = crypto.randomUUID();
    const tokenHash = await hashPassword(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await createPasswordReset(user.id, tokenHash, expiresAt);

    // For demo purposes return token; in production, send email
    return res.json({ message: 'Reset link created.', token });
  } catch (error) {
    console.error('Error in /api/auth/request-reset:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleResetPassword(req, res) {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'token and password are required' });

    const now = new Date().toISOString();
    const data = await listActivePasswordResets(now);

    const match = await (async () => {
      for (const row of data) {
        const ok = await verifyPassword(token, row.token_hash);
        if (ok) return row;
      }
      return null;
    })();

    if (!match) return res.status(400).json({ error: 'Invalid or expired token' });

    const user = await findUserById(match.user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newHash = await hashPassword(password);
    const newVersion = (user.token_version || 0) + 1;
    await updateUser(user.id, { password_hash: newHash, token_version: newVersion });
    await markPasswordResetUsed(match.id);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/auth/reset:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleGuestLogin(_req, res) {
  try {
    const ipKey = `auth:ip:${_req.ip}`;
    if (!rateLimitDual(null, ipKey, APP_CONFIG.rateLimitAuthUser, APP_CONFIG.rateLimitAuthIp)) {
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }

    const userId = `${APP_CONFIG.guestPrefix}${crypto.randomUUID()}`;
    await ensureUser(userId, null, 'user', null);
    const token = signToken({
      userId,
      role: 'user',
      email: null,
      tokenVersion: 0,
    });
    return res.json({
      token,
      user: { id: userId, email: null, role: 'user', guest: true },
    });
  } catch (error) {
    console.error('Error in /api/auth/guest:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleCheckinToday(req, res) {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = await getCheckinsInRange(userId, today.toISOString(), new Date().toISOString());
    const latest = rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
    return res.json({ checkin: latest, count: rows.length });
  } catch (error) {
    console.error('Error in GET /api/checkin/today:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCheckin(req, res) {
  try {
    const userId = req.user.userId;
    const ipKey = `checkin:ip:${req.ip}`;
    const userKey = `checkin:user:${userId}`;
    if (
      !rateLimitDual(
        userKey,
        ipKey,
        APP_CONFIG.rateLimitCheckinUser,
        APP_CONFIG.rateLimitCheckinIp
      )
    ) {
      return res.status(429).json({ error: 'Too many check-ins, slow down.' });
    }

    const { sleep, mood, energy, stress, hydration, notes } = req.body || {};
    const payload = { sleep, mood, energy, stress, hydration, notes, user_id: userId };
    const ints = ['sleep', 'mood', 'energy', 'stress', 'hydration'];
    for (const key of ints) {
      const val = payload[key];
      if (typeof val !== 'number' || val < 0 || val > 10) {
        return res.status(400).json({ error: `${key} must be a number 0-10` });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await countCheckinsSince(userId, today.toISOString());
    if (count >= 10) {
      return res.status(429).json({ error: 'Daily check-in limit reached (10 per day).' });
    }

    const saved = await createCheckin(payload);

    return res.json({ success: true, checkin: saved, count: count + 1 });
  } catch (error) {
    console.error('Error in /api/checkin:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleDashboard(req, res) {
  try {
    const userId = req.user.userId;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 7), 31);
    const parsedEndDateOnly = parseDateOnlyInput(req.query.endDate);
    const parsedStartDateOnly = parseDateOnlyInput(req.query.startDate);
    const rangeEnd = parsedEndDateOnly
      ? endOfDay(parsedEndDateOnly)
      : req.query.endDate
        ? new Date(req.query.endDate)
        : new Date();
    const rangeStartParam = parsedStartDateOnly
      ? startOfDay(parsedStartDateOnly)
      : req.query.startDate
        ? new Date(req.query.startDate)
        : null;

    const ipKey = `dash:ip:${req.ip}`;
    const userKey = `dash:user:${userId}`;
    if (
      !rateLimitDual(
        userKey,
        ipKey,
        APP_CONFIG.rateLimitDashboardUser,
        APP_CONFIG.rateLimitDashboardIp
      )
    ) {
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }

    const rangeStart = rangeStartParam || startOfDay(subtractDays(rangeEnd, days - 1));
    const prevRangeStart = subtractDays(rangeStart, days);
    const prevRangeEnd = subtractDays(rangeStart, 1);

    const fetchRange = (from, to) => getCheckinsInRange(userId, from.toISOString(), to.toISOString());

    const currentRows = await fetchRange(rangeStart, rangeEnd);
    const prevRows = await fetchRange(prevRangeStart, prevRangeEnd);

    const metrics = ['sleep', 'mood', 'energy', 'stress', 'hydration'];

    const buildDailyMap = (rows) => {
      const map = {};
      rows.forEach((row) => {
        const key = startOfDay(row.created_at).toISOString();
        map[key] = map[key] || { count: 0 };
        metrics.forEach((m) => {
          map[key][m] = (map[key][m] || 0) + (Number(row[m]) || 0);
        });
        map[key].count += 1;
      });
      return map;
    };

    // Use selected-period averaging for all ranges:
    // 1) average multiple check-ins within each day
    // 2) average across every day in the selected window (missing days count as 0)
    const avgFromWindow = (dailyMap, dayList, metric) => {
      if (!dayList.length) return 0;
      const total = dayList.reduce((sum, day) => {
        const entry = dailyMap[day.toISOString()];
        if (!entry || entry.count <= 0) return sum;
        return sum + entry[metric] / entry.count;
      }, 0);
      return total / dayList.length;
    };

    const currentByDay = buildDailyMap(currentRows);
    const prevByDay = buildDailyMap(prevRows);
    const currentDayList = buildDayListInclusive(rangeStart, rangeEnd);
    const prevDayList = buildDayListInclusive(prevRangeStart, prevRangeEnd);
    const currentAvg = Object.fromEntries(metrics.map((m) => [m, avgFromWindow(currentByDay, currentDayList, m)]));
    const prevAvg = Object.fromEntries(metrics.map((m) => [m, avgFromWindow(prevByDay, prevDayList, m)]));

    const seriesMap = {};
    metrics.forEach((m) => (seriesMap[m] = []));

    currentDayList.forEach((d) => {
      const key = d.toISOString();
      const entry = currentByDay[key];
      metrics.forEach((m) => {
        const val = entry ? entry[m] / entry.count : null;
        seriesMap[m].push({ date: d.toISOString(), value: val });
      });
    });

    const latest = currentRows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
    const todayScores = {};
    metrics.forEach((m) => (todayScores[m] = latest ? Number(latest[m]) || 0 : null));

    const insights = [];
    if (currentRows.length > 0) {
      metrics.forEach((m) => {
        const delta = currentAvg[m] - prevAvg[m];
        if (delta > 0.5) insights.push({ title: `${m} improving`, body: `${m} scores are trending up vs last period.` });
        if (delta < -0.5) insights.push({ title: `${m} dipping`, body: `${m} scores dipped vs last period; consider small adjustments.` });
      });
      if (insights.length === 0) {
        insights.push({ title: 'Keep the streak', body: 'Consistent check-ins help Atlas personalize guidance.' });
      }
    }

    return res.json({
      days,
      averages: currentAvg,
      deltas: Object.fromEntries(metrics.map((m) => [m, currentAvg[m] - prevAvg[m]])),
      series: seriesMap,
      todayScores,
      insights,
    });
  } catch (error) {
    console.error('Error in /api/dashboard:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleNotificationsGet(req, res) {
  try {
    const userId = req.user.userId;
    const ipKey = `notify:ip:${req.ip}`;
    const userKey = `notify:user:${userId}`;
    if (
      !rateLimitDual(
        userKey,
        ipKey,
        APP_CONFIG.rateLimitNotifyUser,
        APP_CONFIG.rateLimitNotifyIp
      )
    ) {
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }

    const data = await getSetting(`notifications_${userId}`);
    const preferences = normalizeNotificationPreferences(data?.value || DEFAULT_NOTIFICATION_PREFERENCES);
    return res.json({
      preferences,
    });
  } catch (error) {
    console.error('Error in /api/notifications GET:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleNotificationsSet(req, res) {
  try {
    const userId = req.user.userId;
    const ipKey = `notify:ip:${req.ip}`;
    const userKey = `notify:user:${userId}`;
    if (
      !rateLimitDual(
        userKey,
        ipKey,
        APP_CONFIG.rateLimitNotifyUser,
        APP_CONFIG.rateLimitNotifyIp
      )
    ) {
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }

    const prefs = req.body || {};
    const clean = normalizeNotificationPreferences(prefs);

    await upsertSetting(`notifications_${userId}`, clean);

    return res.json({ preferences: clean });
  } catch (error) {
    console.error('Error in /api/notifications POST:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function searchKnowledge(query) {
  if (!query || typeof query !== 'string') return [];
  const cleaned = query.trim();
  if (!cleaned) return [];

  return withPersistence(
    'searchKnowledge',
    async () => {
      const { data, error } = await supabase
        .from('kb_documents')
        .select('id,title,content')
        .textSearch('search_vector', cleaned, { config: 'english', type: 'plain' })
        .limit(5);

      if (error) {
        console.error('KB search error:', error.message);
        return [];
      }
      return data || [];
    },
    async () => searchMemoryKnowledge(cleaned)
  );
}

async function handleAdminMetrics(_req, res) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const metrics = await withPersistence(
      'handleAdminMetrics',
      async () => {
        const countTable = async (table, builder) => {
          let query = supabase.from(table).select('*', { count: 'exact', head: true });
          if (builder) {
            query = builder(query);
          }
          const { count, error } = await query;
          if (error) throw error;
          return count || 0;
        };

        return {
          totalUsers: await countTable('users'),
          totalSessions: await countTable('sessions'),
          totalMessages: await countTable('messages'),
          messagesToday: await countTable('messages', (q) =>
            q.gte('created_at', todayStart.toISOString())
          ),
          safetyBlocks: await countTable('messages', (q) =>
            q.eq('content', MEDICAL_BOUNDARY_MESSAGE)
          ),
        };
      },
      async () => ({
        totalUsers: memoryStore.users.size,
        totalSessions: memoryStore.sessions.length,
        totalMessages: memoryStore.messages.length,
        messagesToday: memoryStore.messages.filter(
          (message) => message.created_at >= todayStart.toISOString()
        ).length,
        safetyBlocks: memoryStore.messages.filter(
          (message) => message.content === MEDICAL_BOUNDARY_MESSAGE
        ).length,
      })
    );

    return res.json(metrics);
  } catch (error) {
    console.error('Error in /api/admin/metrics:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAdminLogs(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const logs = await withPersistence(
      'handleAdminLogs',
      async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('id, session_id, role, content, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      },
      async () =>
        memoryStore.messages
          .slice()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, limit)
          .map((message) => cloneData(message))
    );

    return res.json({ logs });
  } catch (error) {
    console.error('Error in /api/admin/logs:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAdminSessions(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const sessions = await withPersistence(
      'handleAdminSessions',
      async () => {
        const { data, error } = await supabase
          .from('sessions')
          .select('id, user_id, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      },
      async () =>
        memoryStore.sessions
          .slice()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, limit)
          .map((session) => cloneData(session))
    );

    return res.json({ sessions });
  } catch (error) {
    console.error('Error in /api/admin/sessions:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleAdminSettingsGet(_req, res) {
  return res.json({
    settings: {
      temperature: runtimeSettings.temperature,
      maxTokens: runtimeSettings.maxTokens,
      maxContextMessages: runtimeSettings.maxContextMessages,
    },
  });
}

async function handleAdminSettingsUpdate(req, res) {
  try {
    const { temperature, maxTokens, maxContextMessages } = req.body || {};

    if (typeof temperature === 'number') {
      runtimeSettings.temperature = Math.max(0, Math.min(2, temperature));
      await upsertSetting('temperature', { temperature: runtimeSettings.temperature });
    }
    if (typeof maxTokens === 'number') {
      runtimeSettings.maxTokens = Math.max(50, Math.min(800, maxTokens));
      await upsertSetting('maxTokens', { maxTokens: runtimeSettings.maxTokens });
    }
    if (typeof maxContextMessages === 'number') {
      runtimeSettings.maxContextMessages = Math.max(4, Math.min(50, maxContextMessages));
      await upsertSetting('maxContextMessages', {
        maxContextMessages: runtimeSettings.maxContextMessages,
      });
    }

    return res.json({
      settings: {
        temperature: runtimeSettings.temperature,
        maxTokens: runtimeSettings.maxTokens,
        maxContextMessages: runtimeSettings.maxContextMessages,
      },
    });
  } catch (error) {
    console.error('Error in /api/admin/settings:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

app.get('/health', (_req, res) => {
  return res.json({
    status: 'ok',
    app: 'atlas',
    persistenceMode,
  });
});

// Routes

app.get('/api/ai-health', requireAuth, async (_req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: APP_CONFIG.openaiModel,
      messages: [
        { role: 'system', content: 'Reply with exactly: ok' },
        { role: 'user', content: 'health check' },
      ],
      max_completion_tokens: 5,
      temperature: 0,
    });
    return res.json({
      status: 'ok',
      model: APP_CONFIG.openaiModel,
      sample: completion.choices?.[0]?.message?.content?.trim() || '',
    });
  } catch (error) {
    console.error('AI health check failed:', error?.message || error);
    return res.status(503).json({
      status: 'error',
      model: APP_CONFIG.openaiModel,
      error: error.message,
    });
  }
});

app.post('/api/chat', requireAuth, handleChat);
app.get('/api/history', requireAuth, handleHistory);
app.post('/api/reset', requireAuth, handleReset);
app.get('/api/sessions', requireAuth, handleSessions);
app.delete('/api/sessions/:sessionId', requireAuth, handleDeleteSession);

app.post('/api/auth/signup', handleSignup);
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/me', requireAuth, handleMe);
app.post('/api/auth/profile', requireAuth, handleProfileUpdate);
app.post('/api/auth/logout-all', requireAuth, handleLogoutAll);
app.delete('/api/auth/account', requireAuth, handleDeleteAccount);
app.post('/api/auth/request-reset', handleRequestReset);
app.post('/api/auth/reset', handleResetPassword);
app.post('/api/auth/guest', handleGuestLogin);
app.post('/api/auth/onboarding-complete', requireAuth, handleOnboardingComplete);
app.get('/api/checkin/today', requireAuth, handleCheckinToday);
app.post('/api/checkin', requireAuth, handleCheckin);
app.get('/api/dashboard', requireAuth, handleDashboard);
app.get('/api/notifications', requireAuth, handleNotificationsGet);
app.post('/api/notifications', requireAuth, handleNotificationsSet);
app.post('/api/notifications/test', requireAuth, handleNotificationsTest);
app.post('/api/notifications/welcome', requireAuth, handleNotificationsWelcome);

app.get('/api/admin/metrics', requireAdmin, handleAdminMetrics);
app.get('/api/admin/logs', requireAdmin, handleAdminLogs);
app.get('/api/admin/sessions', requireAdmin, handleAdminSessions);
app.get('/api/admin/settings', requireAdmin, handleAdminSettingsGet);
app.post('/api/admin/settings', requireAdmin, handleAdminSettingsUpdate);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

async function handleServerListenError(error, port) {
  const atlasAlreadyRunning =
    error?.code === 'EADDRINUSE' ? await probeAtlasHealth(port) : false;
  const result = buildListenFailureResult(error, port, atlasAlreadyRunning);

  if (result.level === 'log') {
    console.log(result.message);
  } else {
    console.error(result.message);
  }

  process.exit(result.exitCode);
}

async function start() {
  try {
    await ensureAdminSeed();
    await loadSettingsFromDb();
    startReminderScheduler();
  } catch (error) {
    console.error('Startup warning:', error.message);
  }

  const server = http.createServer(app);
  server.on('error', (error) => {
    void handleServerListenError(error, APP_CONFIG.port);
  });
  server.listen(APP_CONFIG.port, () => {
    console.log(`Atlas server running at http://localhost:${APP_CONFIG.port}`);
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = {
  app,
  start,
};
