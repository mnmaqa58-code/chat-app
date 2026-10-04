import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, Conversation, Message, UserSettings, ActiveTab } from '../types';
import { TRANSLATIONS, Translations } from '../data/translations';

interface AppContextType {
  currentUser: User | null;
  authReady: boolean;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  exploreUsers: User[];
  settings: UserSettings;
  t: Translations;
  isTypingMap: Record<string, boolean>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    data: {
      username: string;
      password: string;
      displayName: string;
      age: number;
      country: User['country'];
      avatarUrl: string;
      bio?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  deleteAccount: () => void;
  updateProfile: (data: Partial<User>) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  startOrOpenChat: (user: User) => string;
  sendMessage: (conversationId: string, text: string, mediaUrl?: string, isVoice?: boolean) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  deleteConversation: (conversationId: string) => void;
  togglePinConversation: (conversationId: string) => void;
  markConversationAsRead: (conversationId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Web Audio sound effects (pure synthetic Web Audio, no external audio files required)
const playChime = (type: 'send' | 'receive' | 'call') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'send') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'receive') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(620, ctx.currentTime);
      osc1.frequency.setValueAtTime(840, ctx.currentTime + 0.08);
      osc2.frequency.setValueAtTime(1040, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start(ctx.currentTime + 0.08);
      osc1.stop(ctx.currentTime + 0.22);
      osc2.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // Ignore audio permission restrictions if browser hasn't had user interaction
  }
};

const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  theme: 'dark-emerald',
  showOnlineStatus: true,
  soundEnabled: true,
  enterToSend: true,
};

// ---- API helpers: all accounts, chats and messages live on the server (PostgreSQL) ----
const TOKEN_KEY = 'emerald_token';

class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_KEY); // read synchronously, before any await
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty body
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? 'request_failed');
  return data as T;
}

interface ServerMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string | null;
  isVoice?: boolean;
  deleted?: boolean;
}

interface ServerConversation {
  id: string;
  participant: User;
  lastMessage: ServerMessage | null;
  unreadCount: number;
  isPinned: boolean;
  updatedAt: number;
}

interface SessionPayload {
  token: string;
  user: User;
  settings: UserSettings;
}

// Must match the id the server builds for a pair of users
const convIdFor = (a: string, b: string) => (a < b ? `conv_${a}_${b}` : `conv_${b}_${a}`);

const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const toMessage = (m: ServerMessage): Message => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  senderName: m.senderName,
  text: m.text,
  timestamp: fmtStamp(m.createdAt),
  createdAt: m.createdAt,
  status: m.status,
  mediaUrl: m.mediaUrl || undefined,
  isVoice: m.isVoice || undefined,
});

// Merge server updates into the list we already show (new, changed and deleted messages)
const mergeMessages = (existing: Message[], incoming: ServerMessage[]): Message[] => {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const s of incoming) {
    if (s.deleted) map.delete(s.id);
    else map.set(s.id, toMessage(s));
  }
  return [...map.values()].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
};

// Conversation list only needs a preview, so don't duplicate big image/audio data URLs there
const slimMessage = (m: Message): Message => ({ ...m, mediaUrl: m.mediaUrl ? 'attached' : undefined });

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Language/theme are remembered on this device so the sign-in screen already looks right
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('emerald_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chats');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [exploreUsers, setExploreUsers] = useState<User[]>([]);
  const [isTypingMap] = useState<Record<string, boolean>>({}); // real people: no simulated typing

  // Always-fresh values for timers/async callbacks (avoids stale closures)
  const latest = useRef({ conversations, messages, activeConversationId, activeTab, settings, currentUser });
  latest.current = { conversations, messages, activeConversationId, activeTab, settings, currentUser };

  const syncRef = useRef<Record<string, number>>({}); // per chat: server time of the last message sync
  const pendingConvs = useRef<Map<string, Promise<unknown>>>(new Map()); // chats being created on the server
  const seenLastMsg = useRef<Record<string, string>>({}); // last message id seen per chat (for the sound)
  const convsLoaded = useRef(false);

  // Settings -> DOM (theme, language, text direction)
  useEffect(() => {
    localStorage.setItem('emerald_settings', JSON.stringify(settings));
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.lang = settings.language;
    root.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  }, [settings]);

  const clearLocalState = () => {
    syncRef.current = {};
    pendingConvs.current.clear();
    seenLastMsg.current = {};
    convsLoaded.current = false;
    setConversations([]);
    setMessages({});
    setExploreUsers([]);
    setActiveConversationId(null);
    setActiveTab('chats');
  };

  const resetSession = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    clearLocalState();
    setCurrentUser(null);
  };

  const startSession = (data: SessionPayload) => {
    sessionStorage.setItem(TOKEN_KEY, data.token);
    clearLocalState();
    setSettings(data.settings);
    setCurrentUser(data.user);
  };

  // Restore the session after a page reload
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionStorage.getItem(TOKEN_KEY)) {
        setAuthReady(true);
        return;
      }
      try {
        const me = await api<{ user: User; settings: UserSettings }>('/me');
        if (cancelled) return;
        setSettings(me.settings);
        setCurrentUser(me.user);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) sessionStorage.removeItem(TOKEN_KEY);
      }
      if (!cancelled) setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApiError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) resetSession();
  };

  const refreshConversations = async () => {
    const me = latest.current.currentUser;
    if (!me) return;
    try {
      const list = await api<ServerConversation[]>('/conversations');
      if (latest.current.currentUser?.id !== me.id) return;
      const { activeConversationId: activeId, activeTab: tab, settings: st } = latest.current;

      let shouldChime = false;
      const mapped: Conversation[] = list.map((sc) => {
        const lm = sc.lastMessage ? toMessage(sc.lastMessage) : undefined;
        let unread = sc.unreadCount;
        // chat is open on screen: what arrives counts as read right away
        if (activeId === sc.id && tab === 'chats' && unread > 0) {
          unread = 0;
          api(`/conversations/${sc.id}/read`, { method: 'POST' }).catch(() => {});
        }
        if (lm && convsLoaded.current && seenLastMsg.current[sc.id] !== lm.id && lm.senderId !== me.id) {
          shouldChime = true;
        }
        if (lm) seenLastMsg.current[sc.id] = lm.id;
        return {
          id: sc.id,
          participantId: sc.participant.id,
          participant: sc.participant,
          lastMessage: lm,
          unreadCount: unread,
          isPinned: sc.isPinned,
          updatedAt: sc.updatedAt,
        };
      });
      convsLoaded.current = true;

      setConversations((prev) => {
        const serverIds = new Set(mapped.map((c) => c.id));
        // keep chats that are still being created on the server
        const keep = prev.filter((c) => pendingConvs.current.has(c.id) && !serverIds.has(c.id));
        return [...keep, ...mapped];
      });
      if (shouldChime && st.soundEnabled) playChime('receive');
    } catch (e) {
      handleApiError(e);
    }
  };

  const refreshMessages = async (convId: string) => {
    const me = latest.current.currentUser;
    if (!me) return;
    const since = syncRef.current[convId];
    try {
      const data = await api<{ messages: ServerMessage[]; serverTime: number }>(
        `/conversations/${convId}/messages${since ? `?since=${since}` : ''}`
      );
      if (latest.current.currentUser?.id !== me.id) return;
      // small overlap so changes made right at the boundary are never missed
      syncRef.current[convId] = data.serverTime - 5000;
      if (since && data.messages.length === 0) return;
      setMessages((prev) => ({ ...prev, [convId]: mergeMessages(prev[convId] ?? [], data.messages) }));
    } catch (e) {
      handleApiError(e); // 404 = chat is not on the server yet (just opened): try again on the next tick
    }
  };

  const refreshExplore = async () => {
    if (!latest.current.currentUser) return;
    try {
      setExploreUsers(await api<User[]>('/users'));
    } catch (e) {
      handleApiError(e);
    }
  };

  // Poll chats (also acts as the "online" heartbeat) and the people list
  useEffect(() => {
    if (!currentUser) return;
    refreshConversations();
    refreshExplore();
    const chats = setInterval(() => {
      if (!document.hidden) refreshConversations();
    }, 4000);
    const people = setInterval(() => {
      if (!document.hidden && latest.current.activeTab === 'explore') refreshExplore();
    }, 15000);
    return () => {
      clearInterval(chats);
      clearInterval(people);
    };
  }, [currentUser?.id]);

  // Poll the messages of the chat that is open
  useEffect(() => {
    if (!currentUser || !activeConversationId) return;
    refreshMessages(activeConversationId);
    const timer = setInterval(() => {
      if (!document.hidden) refreshMessages(activeConversationId);
    }, 3000);
    return () => clearInterval(timer);
  }, [currentUser?.id, activeConversationId]);

  useEffect(() => {
    if (currentUser && activeTab === 'explore') refreshExplore();
  }, [activeTab]);

  const login: AppContextType['login'] = async (username, password) => {
    try {
      startSession(await api<SessionPayload>('/auth/login', { method: 'POST', body: { username, password } }));
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.code : 'network' };
    }
  };

  const register: AppContextType['register'] = async (data) => {
    try {
      const body = { ...data, language: settings.language, theme: settings.theme };
      startSession(await api<SessionPayload>('/auth/register', { method: 'POST', body }));
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof ApiError ? e.code : 'network' };
    }
  };

  const logout = () => {
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    resetSession();
  };

  const deleteAccount = () => {
    api('/me', { method: 'DELETE' }).catch(() => {});
    resetSession();
  };

  const updateProfile = (data: Partial<User>) => {
    const me = latest.current.currentUser;
    if (!me) return;
    setCurrentUser({ ...me, ...data });
    api<{ user: User }>('/me', { method: 'PUT', body: data })
      .then((r) => setCurrentUser(r.user))
      .catch(() => {
        // could not save: go back to what the server has
        api<{ user: User }>('/me').then((r) => setCurrentUser(r.user)).catch(handleApiError);
      });
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    if (latest.current.currentUser) {
      api('/me/settings', { method: 'PUT', body: newSettings }).catch(() => {});
    }
  };

  const startOrOpenChat = (user: User): string => {
    const me = latest.current.currentUser;
    const id = me ? convIdFor(me.id, user.id) : `conv_${user.id}`;
    const exists = latest.current.conversations.some((c) => c.id === id);
    if (me && !exists) {
      // show the chat right away, create it on the server in the background
      const newConv: Conversation = { id, participantId: user.id, participant: user, unreadCount: 0, updatedAt: Date.now() };
      setConversations((prev) => (prev.some((c) => c.id === id) ? prev : [newConv, ...prev]));
      const created = api('/conversations', { method: 'POST', body: { participantId: user.id } })
        .catch(() => setConversations((prev) => prev.filter((c) => c.id !== id)))
        .then(() => {
          pendingConvs.current.delete(id);
          refreshConversations();
        });
      pendingConvs.current.set(id, created);
    }
    setActiveConversationId(id);
    setActiveTab('chats');
    return id;
  };

  const deleteConversation = (convId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    setMessages((prev) => {
      const { [convId]: _removed, ...rest } = prev;
      return rest;
    });
    delete syncRef.current[convId];
    if (activeConversationId === convId) setActiveConversationId(null);
    api(`/conversations/${convId}`, { method: 'DELETE' }).catch(() => {});
  };

  const togglePinConversation = (convId: string) => {
    const conv = latest.current.conversations.find((c) => c.id === convId);
    if (!conv) return;
    const pinned = !conv.isPinned;
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, isPinned: pinned } : c)));
    api(`/conversations/${convId}/pin`, { method: 'PUT', body: { pinned } }).catch(() => {});
  };

  const markConversationAsRead = (convId: string) => {
    const conv = latest.current.conversations.find((c) => c.id === convId);
    if (!conv || conv.unreadCount === 0) return;
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)));
    api(`/conversations/${convId}/read`, { method: 'POST' }).catch(() => {});
  };

  const deleteMessage = (convId: string, messageId: string) => {
    const remaining = (latest.current.messages[convId] ?? []).filter((m) => m.id !== messageId);
    setMessages((prev) => ({ ...prev, [convId]: remaining }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, lastMessage: remaining.length ? slimMessage(remaining[remaining.length - 1]) : undefined }
          : c
      )
    );
    api(`/messages/${messageId}`, { method: 'DELETE' }).catch(() => {});
  };

  const sendMessage = (conversationId: string, text: string, mediaUrl?: string, isVoice?: boolean) => {
    const me = latest.current.currentUser;
    if (!me || (!text.trim() && !mediaUrl)) return;
    if (!latest.current.conversations.some((c) => c.id === conversationId)) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      conversationId,
      senderId: me.id,
      senderName: me.displayName,
      text: text.trim(),
      timestamp: fmtStamp(new Date().toISOString()),
      createdAt: new Date().toISOString(),
      status: 'sent',
      mediaUrl,
      isVoice,
    };

    // show it immediately, confirm with the server in the background
    setMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), newMsg] }));
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, lastMessage: slimMessage(newMsg), updatedAt: Date.now() } : c))
    );
    if (latest.current.settings.soundEnabled) playChime('send');

    // if the chat is still being created on the server, wait for that first
    const ready = pendingConvs.current.get(conversationId) ?? Promise.resolve();
    ready
      .then(() =>
        api<ServerMessage>(`/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: { id: newMsg.id, text: newMsg.text, mediaUrl, isVoice },
        })
      )
      .then((saved) => {
        setMessages((prev) => ({ ...prev, [conversationId]: mergeMessages(prev[conversationId] ?? [], [saved]) }));
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          resetSession();
          return;
        }
        // not sent: take it back off the screen
        setMessages((prev) => ({ ...prev, [conversationId]: (prev[conversationId] ?? []).filter((m) => m.id !== newMsg.id) }));
        window.alert('Message could not be sent. Please try again.');
      });
  };

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.en;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        authReady,
        activeTab,
        setActiveTab,
        activeConversationId,
        setActiveConversationId,
        conversations,
        messages,
        exploreUsers,
        settings,
        t,
        isTypingMap,
        login,
        register,
        logout,
        deleteAccount,
        updateProfile,
        updateSettings,
        startOrOpenChat,
        sendMessage,
        deleteMessage,
        deleteConversation,
        togglePinConversation,
        markConversationAsRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
