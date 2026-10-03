import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: ['.env.local', '.env'] });

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '64kb' }));

// --- tiny in-memory rate limit so a public deployment can't drain the API key
const hits = new Map<string, number[]>();
const rateLimited = (ip: string, max = 20, windowMs = 60_000) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
};

interface ReplyBody {
  partner?: {
    displayName?: string;
    country?: string;
    bio?: string;
    interests?: string[];
    spokenLanguages?: string[];
  };
  userName?: string;
  history?: { from: 'me' | 'them'; text: string }[];
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

app.post('/api/reply', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
    return;
  }
  if (rateLimited(req.ip || 'unknown')) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const body = (req.body || {}) as ReplyBody;
  const partner = body.partner || {};
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  if (history.length === 0 || history[history.length - 1].from !== 'me') {
    res.status(400).json({ error: 'history must end with a message from the user' });
    return;
  }

  const systemInstruction =
    `You are ${clip(partner.displayName, 60) || 'a friendly person'} from ${clip(partner.country, 60) || 'somewhere in the world'}, ` +
    `chatting with ${clip(body.userName, 60) || 'a new friend'} in a casual messenger app. ` +
    `About you: ${clip(partner.bio, 300)} ` +
    `Interests: ${(partner.interests || []).slice(0, 8).map((i) => clip(i, 40)).join(', ')}. ` +
    `Languages you speak: ${(partner.spokenLanguages || []).slice(0, 6).map((i) => clip(i, 30)).join(', ')}. ` +
    `Stay in character, reply in the language the other person is writing in, keep it to 1-2 short sentences, ` +
    `sound natural and warm, and never mention that you are an AI or a simulation.`;

  // Gemini wants alternating roles that start and end with "user"
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const m of history) {
    const role = m.from === 'me' ? 'user' : 'model';
    const text = clip(m.text, 600);
    if (!text) continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${text}`;
    else contents.push({ role, parts: [{ text }] });
  }
  while (contents.length && contents[0].role !== 'user') contents.shift();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction, maxOutputTokens: 160, temperature: 0.9 },
    });
    const text = (result.text || '').trim();
    if (!text) {
      res.status(502).json({ error: 'Empty response from model' });
      return;
    }
    res.json({ text });
  } catch (err) {
    console.error('Gemini error:', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Upstream model error' });
  }
});

async function start() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Emerald Chat running on http://localhost:${PORT}`));
}

start();
