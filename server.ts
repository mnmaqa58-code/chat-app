import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';

dotenv.config({ path: ['.env.local', '.env'] });

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------- database
const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      max: 10,
      // Railway's public proxy needs SSL; the private network (postgres.railway.internal) does not
      ssl: /rlwy\.net/.test(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
    })
  : null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL,
  password_hash    TEXT,
  display_name     TEXT NOT NULL,
  age              SMALLINT NOT NULL CHECK (age >= 18),
  country_code     CHAR(2) NOT NULL,
  country_name     TEXT NOT NULL,
  country_flag     TEXT NOT NULL,
  avatar_url       TEXT NOT NULL,
  bio              TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'offline',
  last_seen        TIMESTAMPTZ,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  spoken_languages TEXT[] NOT NULL DEFAULT '{}',
  interests        TEXT[] NOT NULL DEFAULT '{}',
  is_demo          BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users (lower(username));

CREATE TABLE IF NOT EXISTS user_settings (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language            TEXT NOT NULL DEFAULT 'en',
  theme               TEXT NOT NULL DEFAULT 'dark-emerald',
  show_online_status  BOOLEAN NOT NULL DEFAULT TRUE,
  sound_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  enter_to_send       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- one shared conversation per pair of users (user_a/user_b are stored in sorted order)
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  user_a      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);

-- per-user view of a conversation (pin, "deleted" for me, history cut-off)
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  hidden           BOOLEAN NOT NULL DEFAULT FALSE,
  cleared_at       TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name      TEXT NOT NULL,
  body             TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read')),
  media_url        TEXT,
  is_voice         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_for      TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conv_created_idx ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_conv_updated_idx ON messages (conversation_id, updated_at);
`;

async function ensureSchema() {
  if (!pool) return;
  // The first version of the schema had per-owner conversations and was never used by the app.
  // Recreate those two tables once; the new layout has no owner_id column, so this never runs again.
  const old = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'owner_id'`
  );
  if (old.rowCount) await pool.query('DROP TABLE IF EXISTS messages, conversations CASCADE');
  await pool.query(SCHEMA_SQL);
}

// ---------------------------------------------------------------- helpers
const LANGS = ['en', 'es', 'fr', 'de', 'tr', 'ar', 'ja'];
const THEMES = ['dark-emerald', 'deep-forest', 'midnight-jade', 'mint-dark'];

const hits = new Map<string, number[]>();
const rateLimited = (key: string, max: number, windowMs = 60_000) => {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
};

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);
const strList = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v)
    ? v.map((x) => clip(x, maxLen).trim()).filter(Boolean).slice(0, maxItems)
    : [];
const convIdFor = (a: string, b: string) => (a < b ? `conv_${a}_${b}` : `conv_${b}_${a}`);
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// columns that build the public "User" shape (alias u = users, s = user_settings)
const USER_COLS = `
  u.id, u.username, u.display_name, u.age, u.country_code, u.country_name, u.country_flag,
  u.avatar_url, u.bio, u.joined_at, u.spoken_languages, u.interests,
  CASE WHEN COALESCE(s.show_online_status, TRUE) THEN u.last_seen END AS last_seen,
  CASE WHEN COALESCE(s.show_online_status, TRUE) AND u.last_seen > now() - interval '45 seconds'
       THEN 'online' ELSE 'offline' END AS status_calc`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const toUser = (r: Row) => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  age: r.age,
  country: { code: String(r.country_code).trim(), name: r.country_name, flag: r.country_flag },
  avatarUrl: r.avatar_url,
  bio: r.bio,
  status: r.status_calc ?? 'offline',
  lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : undefined,
  joinedDate: 'Joined ' + new Date(r.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  spokenLanguages: r.spoken_languages,
  interests: r.interests,
});

const toSettings = (r: Row | undefined) => ({
  language: r?.language ?? 'en',
  theme: r?.theme ?? 'dark-emerald',
  showOnlineStatus: r?.show_online_status ?? true,
  soundEnabled: r?.sound_enabled ?? true,
  enterToSend: r?.enter_to_send ?? true,
});

const toMessage = (r: Row, mediaFlagOnly = false) => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  senderName: r.sender_name,
  text: r.body,
  createdAt: new Date(r.created_at).toISOString(),
  status: r.status,
  mediaUrl: mediaFlagOnly ? (r.has_media ? 'attached' : null) : r.media_url,
  isVoice: r.is_voice,
  deleted: r.deleted === true,
});

async function loadUser(id: string): Promise<{ user: ReturnType<typeof toUser>; settings: ReturnType<typeof toSettings> } | null> {
  const r = await pool!.query(
    `SELECT ${USER_COLS}, s.language, s.theme, s.show_online_status, s.sound_enabled, s.enter_to_send
       FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = $1`,
    [id]
  );
  if (!r.rowCount) return null;
  const user = toUser(r.rows[0]);
  user.status = 'online';
  return { user, settings: toSettings(r.rows[0]) };
}

async function newSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await pool!.query('INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)', [sha(token), userId]);
  return token;
}

// ---------------------------------------------------------------- express
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '6mb' }));

interface AuthedRequest extends Request {
  userId?: string;
  token?: string;
}

type Handler = (req: AuthedRequest, res: Response) => Promise<unknown>;
const route =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req as AuthedRequest, res).catch((err) => {
      console.error(`${req.method} ${req.path} failed:`, err instanceof Error ? err.message : err);
      if (!res.headersSent) res.status(500).json({ error: 'server_error' });
      else next(err);
    });
  };

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: Boolean(pool) });
});

app.use('/api', (_req, res, next) => {
  if (!pool) {
    res.status(503).json({ error: 'database_not_configured' });
    return;
  }
  next();
});

// auth middleware: checks the Bearer token and refreshes last_seen (heartbeat)
const auth = (req: Request, res: Response, next: NextFunction) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  pool!
    .query('SELECT user_id FROM sessions WHERE token_hash = $1', [sha(token)])
    .then(async (r) => {
      if (!r.rowCount) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      (req as AuthedRequest).userId = r.rows[0].user_id;
      (req as AuthedRequest).token = token;
      await pool!.query('UPDATE users SET last_seen = now() WHERE id = $1', [r.rows[0].user_id]);
      next();
    })
    .catch((err) => {
      console.error('auth failed:', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'server_error' });
    });
};
// ------------------------------------------------------------- auth routes
app.post(
  '/api/auth/register',
  route(async (req, res) => {
    if (rateLimited(`reg:${req.ip}`, 10)) return res.status(429).json({ error: 'rate_limited' });
    const b = (req.body || {}) as Row;

    const username = clip(b.username, 40).trim();
    const password = String(b.password ?? '');
    const displayName = clip(b.displayName, 40).trim() || username;
    const age = Math.floor(Number(b.age));
    const country = (b.country || {}) as Row;
    const countryCode = clip(country.code, 2).toUpperCase();
    const avatarUrl = String(b.avatarUrl ?? '');

    if (!/^\S{2,30}$/u.test(username)) return res.status(400).json({ error: 'invalid' });
    if (password.length < 6) return res.status(400).json({ error: 'weakPassword' });
    if (!Number.isFinite(age) || age < 18) return res.status(400).json({ error: 'mustBe18' });
    if (!/^[A-Z]{2}$/.test(countryCode)) return res.status(400).json({ error: 'invalid' });
    if (!avatarUrl) return res.status(400).json({ error: 'invalid' });
    if (avatarUrl.length > 700_000) return res.status(400).json({ error: 'avatarTooLarge' });

    const language = LANGS.includes(b.language) ? b.language : 'en';
    const theme = THEMES.includes(b.theme) ? b.theme : 'dark-emerald';
    const id = `u_${crypto.randomUUID()}`;
    const hash = await bcrypt.hash(password, 10);

    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (id, username, password_hash, display_name, age, country_code, country_name, country_flag,
                            avatar_url, bio, status, last_seen, spoken_languages, interests)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'online',now(),$11,$12)`,
        [
          id,
          username,
          hash,
          displayName,
          Math.min(99, age),
          countryCode,
          clip(country.name, 60) || countryCode,
          clip(country.flag, 8),
          avatarUrl,
          clip(b.bio, 300).trim() || 'Excited to chat and discover people around the world!',
          ['English'],
          ['Chat', 'Travel', 'Culture'],
        ]
      );
      await client.query('INSERT INTO user_settings (user_id, language, theme) VALUES ($1,$2,$3)', [id, language, theme]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if ((err as { code?: string }).code === '23505') return res.status(409).json({ error: 'usernameTaken' });
      throw err;
    } finally {
      client.release();
    }

    const token = await newSession(id);
    const me = await loadUser(id);
    res.json({ token, ...me });
  })
);

app.post(
  '/api/auth/login',
  route(async (req, res) => {
    if (rateLimited(`login:${req.ip}`, 20)) return res.status(429).json({ error: 'rate_limited' });
    const username = clip(req.body?.username, 40).trim();
    const password = String(req.body?.password ?? '');
    const r = await pool!.query('SELECT id, password_hash FROM users WHERE lower(username) = lower($1)', [username]);
    const row = r.rows[0] as Row | undefined;
    const ok = await bcrypt.compare(password, row?.password_hash || DUMMY_HASH);
    if (!row || !row.password_hash || !ok) return res.status(401).json({ error: 'invalidCredentials' });
    const token = await newSession(row.id);
    await pool!.query('UPDATE users SET last_seen = now() WHERE id = $1', [row.id]);
    const me = await loadUser(row.id);
    res.json({ token, ...me });
  })
);

app.post(
  '/api/auth/logout',
  auth,
  route(async (req, res) => {
    await pool!.query('DELETE FROM sessions WHERE token_hash = $1', [sha(req.token!)]);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------ profile routes
app.get(
  '/api/me',
  auth,
  route(async (req, res) => {
    const me = await loadUser(req.userId!);
    if (!me) return res.status(401).json({ error: 'unauthorized' });
    res.json(me);
  })
);

app.put(
  '/api/me',
  auth,
  route(async (req, res) => {
    const b = (req.body || {}) as Row;
    const cur = await pool!.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const u = cur.rows[0] as Row | undefined;
    if (!u) return res.status(401).json({ error: 'unauthorized' });

    const displayName = b.displayName !== undefined ? clip(b.displayName, 40).trim() || u.display_name : u.display_name;
    let age = u.age;
    if (b.age !== undefined) {
      const n = Math.floor(Number(b.age));
      if (!Number.isFinite(n) || n < 18) return res.status(400).json({ error: 'mustBe18' });
      age = Math.min(99, n);
    }
    const country = (b.country || {}) as Row;
    const hasCountry = /^[A-Za-z]{2}$/.test(String(country.code ?? ''));
    const avatarUrl = b.avatarUrl !== undefined ? String(b.avatarUrl) : u.avatar_url;
    if (!avatarUrl || avatarUrl.length > 700_000) return res.status(400).json({ error: 'avatarTooLarge' });

    await pool!.query(
      `UPDATE users SET display_name=$2, age=$3, country_code=$4, country_name=$5, country_flag=$6,
              avatar_url=$7, bio=$8, spoken_languages=$9, interests=$10 WHERE id=$1`,
      [
        req.userId,
        displayName,
        age,
        hasCountry ? String(country.code).toUpperCase() : u.country_code,
        hasCountry ? clip(country.name, 60) : u.country_name,
        hasCountry ? clip(country.flag, 8) : u.country_flag,
        avatarUrl,
        b.bio !== undefined ? clip(b.bio, 300).trim() : u.bio,
        b.spokenLanguages !== undefined ? strList(b.spokenLanguages, 8, 30) : u.spoken_languages,
        b.interests !== undefined ? strList(b.interests, 10, 30) : u.interests,
      ]
    );
    const me = await loadUser(req.userId!);
    res.json(me);
  })
);

app.put(
  '/api/me/settings',
  auth,
  route(async (req, res) => {
    const b = (req.body || {}) as Row;
    const sets: string[] = [];
    const vals: unknown[] = [req.userId];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (LANGS.includes(b.language)) add('language', b.language);
    if (THEMES.includes(b.theme)) add('theme', b.theme);
    if (typeof b.showOnlineStatus === 'boolean') add('show_online_status', b.showOnlineStatus);
    if (typeof b.soundEnabled === 'boolean') add('sound_enabled', b.soundEnabled);
    if (typeof b.enterToSend === 'boolean') add('enter_to_send', b.enterToSend);
    if (sets.length) {
      await pool!.query(
        `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [req.userId]
      );
      await pool!.query(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = $1`, vals);
    }
    const me = await loadUser(req.userId!);
    res.json(me?.settings);
  })
);

app.delete(
  '/api/me',
  auth,
  route(async (req, res) => {
    await pool!.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.json({ ok: true });
  })
);

// everyone except me (the Explore tab)
app.get(
  '/api/users',
  auth,
  route(async (req, res) => {
    const r = await pool!.query(
      `SELECT ${USER_COLS} FROM users u LEFT JOIN user_settings s ON s.user_id = u.id
        WHERE u.id <> $1 ORDER BY u.last_seen DESC NULLS LAST, u.joined_at DESC LIMIT 300`,
      [req.userId]
    );
    res.json(r.rows.map(toUser));
  })
);

// ------------------------------------------------------- conversation routes
async function listConversations(uid: string, onlyId?: string) {
  // anything addressed to me that I have not seen yet is now "delivered"
  await pool!.query(
    `UPDATE messages SET status = 'delivered', updated_at = now()
      WHERE status = 'sent' AND sender_id <> $1
        AND conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = $1)`,
    [uid]
  );
  const r = await pool!.query(
    `SELECT c.id, c.updated_at AS conv_updated, m.is_pinned,
            ${USER_COLS},
            lm.id AS lm_id, lm.sender_id AS lm_sender_id, lm.sender_name AS lm_sender_name, lm.body AS lm_body,
            lm.status AS lm_status, lm.is_voice AS lm_is_voice, lm.created_at AS lm_created_at,
            (lm.media_url IS NOT NULL) AS lm_has_media,
            (SELECT count(*)::int FROM messages x
              WHERE x.conversation_id = c.id AND x.sender_id <> $1 AND x.status <> 'read'
                AND NOT ($1 = ANY(x.deleted_for))
                AND (m.cleared_at IS NULL OR x.created_at > m.cleared_at)) AS unread
       FROM conversations c
       JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = $1
       JOIN users u ON u.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
       LEFT JOIN user_settings s ON s.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT x.* FROM messages x
          WHERE x.conversation_id = c.id AND NOT ($1 = ANY(x.deleted_for))
            AND (m.cleared_at IS NULL OR x.created_at > m.cleared_at)
          ORDER BY x.created_at DESC LIMIT 1
       ) lm ON TRUE
      WHERE m.hidden = FALSE ${onlyId ? 'AND c.id = $2' : ''}
      ORDER BY m.is_pinned DESC, COALESCE(lm.created_at, c.updated_at) DESC`,
    onlyId ? [uid, onlyId] : [uid]
  );
  return r.rows.map((row: Row) => ({
    id: row.id,
    participant: toUser(row),
    lastMessage: row.lm_id
      ? toMessage(
          {
            id: row.lm_id,
            conversation_id: row.id,
            sender_id: row.lm_sender_id,
            sender_name: row.lm_sender_name,
            body: row.lm_body,
            created_at: row.lm_created_at,
            status: row.lm_status,
            has_media: row.lm_has_media,
            is_voice: row.lm_is_voice,
          },
          true
        )
      : null,
    unreadCount: row.unread,
    isPinned: row.is_pinned,
    updatedAt: new Date(row.lm_created_at ?? row.conv_updated).getTime(),
  }));
}

async function memberOf(convId: string, uid: string): Promise<Row | null> {
  const r = await pool!.query('SELECT * FROM conversation_members WHERE conversation_id = $1 AND user_id = $2', [convId, uid]);
  return (r.rows[0] as Row) ?? null;
}

app.get(
  '/api/conversations',
  auth,
  route(async (req, res) => {
    res.json(await listConversations(req.userId!));
  })
);

// open (or create) the chat with another user
app.post(
  '/api/conversations',
  auth,
  route(async (req, res) => {
    const me = req.userId!;
    const other = clip(req.body?.participantId, 100);
    if (!other || other === me) return res.status(400).json({ error: 'invalid' });
    const exists = await pool!.query('SELECT 1 FROM users WHERE id = $1', [other]);
    if (!exists.rowCount) return res.status(404).json({ error: 'not_found' });

    const [a, b] = me < other ? [me, other] : [other, me];
    const id = convIdFor(me, other);
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO conversations (id, user_a, user_b) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [id, a, b]
      );
      // for me the chat is open; for the other person it stays hidden until the first message
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, hidden) VALUES ($1,$2,FALSE)
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET hidden = FALSE`,
        [id, me]
      );
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, hidden) VALUES ($1,$2,TRUE)
         ON CONFLICT (conversation_id, user_id) DO NOTHING`,
        [id, other]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    const [conv] = await listConversations(me, id);
    res.json(conv ?? null);
  })
);

app.get(
  '/api/conversations/:id/messages',
  auth,
  route(async (req, res) => {
    const me = req.userId!;
    const convId = String(req.params.id);
    const mem = await memberOf(convId, me);
    if (!mem) return res.status(404).json({ error: 'not_found' });

    // incoming messages are "delivered" as soon as the recipient fetches them
    await pool!.query(
      `UPDATE messages SET status = 'delivered', updated_at = now()
        WHERE conversation_id = $1 AND sender_id <> $2 AND status = 'sent'`,
      [convId, me]
    );

    const since = Number(req.query.since);
    const incremental = Number.isFinite(since) && since > 0;
    const r = await pool!.query(
      incremental
        ? `SELECT *, ($2 = ANY(deleted_for)) AS deleted FROM messages
            WHERE conversation_id = $1 AND updated_at > to_timestamp($3 / 1000.0)
              AND ($4::timestamptz IS NULL OR created_at > $4)
            ORDER BY created_at LIMIT 500`
        : `SELECT * FROM (
             SELECT *, FALSE AS deleted FROM messages
              WHERE conversation_id = $1 AND NOT ($2 = ANY(deleted_for))
                AND ($4::timestamptz IS NULL OR created_at > $4)
              ORDER BY created_at DESC LIMIT 500
           ) t ORDER BY created_at`,
      incremental ? [convId, me, since, mem.cleared_at] : [convId, me, null, mem.cleared_at]
    );
    res.json({ messages: r.rows.map((row: Row) => toMessage(row)), serverTime: Date.now() });
  })
);

app.post(
  '/api/conversations/:id/messages',
  auth,
  route(async (req, res) => {
    const me = req.userId!;
    const convId = String(req.params.id);
    if (rateLimited(`msg:${me}`, 120)) return res.status(429).json({ error: 'rate_limited' });
    const mem = await memberOf(convId, me);
    if (!mem) return res.status(404).json({ error: 'not_found' });

    const text = clip(req.body?.text, 4000).trim();
    const mediaUrl = req.body?.mediaUrl ? String(req.body.mediaUrl) : null;
    if (!text && !mediaUrl) return res.status(400).json({ error: 'empty' });
    if (mediaUrl && mediaUrl.length > 4_500_000) return res.status(413).json({ error: 'too_large' });

    const wantedId = String(req.body?.id ?? '');
    const id = /^msg_[\w-]{4,60}$/.test(wantedId) ? wantedId : `msg_${crypto.randomUUID()}`;
    const who = await pool!.query('SELECT display_name FROM users WHERE id = $1', [me]);

    const ins = await pool!.query(
      `INSERT INTO messages (id, conversation_id, sender_id, sender_name, body, media_url, is_voice)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING RETURNING *, FALSE AS deleted`,
      [id, convId, me, who.rows[0]?.display_name ?? '', text, mediaUrl, Boolean(req.body?.isVoice)]
    );
    if (!ins.rowCount) return res.status(409).json({ error: 'duplicate' });

    await pool!.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [convId]);
    // a new message brings the chat back for both people (even if someone had deleted it)
    await pool!.query('UPDATE conversation_members SET hidden = FALSE WHERE conversation_id = $1', [convId]);
    res.json(toMessage(ins.rows[0]));
  })
);

app.post(
  '/api/conversations/:id/read',
  auth,
  route(async (req, res) => {
    const convId = String(req.params.id);
    if (!(await memberOf(convId, req.userId!))) return res.status(404).json({ error: 'not_found' });
    await pool!.query(
      `UPDATE messages SET status = 'read', updated_at = now()
        WHERE conversation_id = $1 AND sender_id <> $2 AND status <> 'read'`,
      [convId, req.userId]
    );
    res.json({ ok: true });
  })
);

app.put(
  '/api/conversations/:id/pin',
  auth,
  route(async (req, res) => {
    const convId = String(req.params.id);
    if (!(await memberOf(convId, req.userId!))) return res.status(404).json({ error: 'not_found' });
    await pool!.query('UPDATE conversation_members SET is_pinned = $3 WHERE conversation_id = $1 AND user_id = $2', [
      convId,
      req.userId,
      Boolean(req.body?.pinned),
    ]);
    res.json({ ok: true });
  })
);

// "delete chat" only removes it for me and cuts off the old history; the other person keeps theirs
app.delete(
  '/api/conversations/:id',
  auth,
  route(async (req, res) => {
    const convId = String(req.params.id);
    if (!(await memberOf(convId, req.userId!))) return res.status(404).json({ error: 'not_found' });
    await pool!.query(
      `UPDATE conversation_members SET hidden = TRUE, is_pinned = FALSE, cleared_at = now()
        WHERE conversation_id = $1 AND user_id = $2`,
      [convId, req.userId]
    );
    res.json({ ok: true });
  })
);

// "delete message" hides it for me only
app.delete(
  '/api/messages/:id',
  auth,
  route(async (req, res) => {
    const r = await pool!.query(
      `UPDATE messages SET deleted_for = array_append(deleted_for, $2), updated_at = now()
        WHERE id = $1 AND NOT ($2 = ANY(deleted_for))
          AND conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = $2)`,
      [req.params.id, req.userId]
    );
    res.json({ ok: true, changed: r.rowCount });
  })
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// ---------------------------------------------------------------- start
async function start() {
  if (pool) {
    try {
      await ensureSchema();
      console.log('Database ready');
    } catch (err) {
      console.error('Database setup failed:', err instanceof Error ? err.message : err);
    }
  } else {
    console.warn('DATABASE_URL is not set - the API will answer 503');
  }

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
