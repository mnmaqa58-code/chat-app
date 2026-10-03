import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { User, Conversation, Message, UserSettings, ActiveTab } from '../types';
import { INITIAL_EXPLORE_USERS, SMART_AUTO_REPLIES, AVATAR_PRESETS } from '../data/mockUsers';
import { DEFAULT_COUNTRY } from '../data/countries';
import { TRANSLATIONS, Translations } from '../data/translations';

interface StoredAccount {
  user: User;
  passwordHash: string;
}

interface AppContextType {
  currentUser: User | null;
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
  login: (username: string, password: string) => { success: boolean; error?: string };
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
  ) => { success: boolean; error?: string };
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

// Seed initial default demo user
const DEFAULT_DEMO_USER: User = {
  id: 'user_default_me',
  username: 'jade_traveler',
  displayName: 'Jordan Vance',
  age: 26,
  country: { code: 'US', name: 'United States', flag: '🇺🇸' },
  avatarUrl: AVATAR_PRESETS[0],
  bio: 'Visual creator & dark-mode minimalist. Passionate about global cultures, architecture, and hiking.',
  status: 'online',
  joinedDate: 'Joined October 2024',
  spokenLanguages: ['English', 'Spanish'],
  interests: ['Photography', 'Hiking', 'Coffee', 'Design', 'Architecture'],
};

// Seed initial demo conversations with Elena and Alex
const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_elena',
    participantId: INITIAL_EXPLORE_USERS[0].id,
    participant: INITIAL_EXPLORE_USERS[0],
    lastMessage: {
      id: 'msg_init_1',
      conversationId: 'conv_elena',
      senderId: INITIAL_EXPLORE_USERS[0].id,
      senderName: INITIAL_EXPLORE_USERS[0].displayName,
      text: "Hey! Loved your profile. Are you working on any new creative projects?",
      timestamp: '10:42 AM',
      status: 'read',
    },
    unreadCount: 1,
    isPinned: true,
    updatedAt: Date.now() - 1000 * 60 * 15,
  },
  {
    id: 'conv_alex',
    participantId: INITIAL_EXPLORE_USERS[1].id,
    participant: INITIAL_EXPLORE_USERS[1],
    lastMessage: {
      id: 'msg_init_2',
      conversationId: 'conv_alex',
      senderId: 'user_default_me',
      senderName: 'Jordan Vance',
      text: "Nice to meet you Alex! San Francisco trails must be amazing this time of year.",
      timestamp: 'Yesterday',
      status: 'read',
    },
    unreadCount: 0,
    isPinned: false,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12,
  },
];

// ---- Per-account storage: every account keeps its own chats and messages ----
const convKey = (uid: string) => `emerald_convs_${uid}`;
const msgKey = (uid: string, convId: string) => `emerald_msgs_${uid}_${convId}`;
const LEGACY_CONVS_KEY = 'emerald_conversations';
const legacyMsgKey = (convId: string) => `emerald_msgs_${convId}`;

const readJSON = <T,>(key: string): T | null => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};

const loadConversations = (uid: string | null): Conversation[] => {
  if (!uid) return [];
  const saved = readJSON<Conversation[]>(convKey(uid));
  if (saved) return saved;
  // First run for the demo account: pick up data written by the old single-user version
  if (uid === DEFAULT_DEMO_USER.id) return readJSON<Conversation[]>(LEGACY_CONVS_KEY) ?? SEED_CONVERSATIONS;
  return [];
};

const loadMessages = (uid: string | null, convs: Conversation[]): Record<string, Message[]> => {
  const map: Record<string, Message[]> = {};
  if (!uid) return map;
  for (const c of convs) {
    const stored =
      readJSON<Message[]>(msgKey(uid, c.id)) ??
      (uid === DEFAULT_DEMO_USER.id ? readJSON<Message[]>(legacyMsgKey(c.id)) : null);
    map[c.id] = stored ?? (c.lastMessage ? [c.lastMessage] : []);
  }
  return map;
};

// Conversation list only needs a preview, so don't duplicate big image/audio data URLs there
const slimMessage = (m: Message): Message => ({ ...m, mediaUrl: m.mediaUrl ? 'attached' : undefined });

const fmtTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('emerald_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('emerald_current_user');
      if (saved) return JSON.parse(saved);
      return DEFAULT_DEMO_USER;
    } catch {
      return DEFAULT_DEMO_USER;
    }
  });

  const [accounts, setAccounts] = useState<StoredAccount[]>(() => {
    try {
      const saved = localStorage.getItem('emerald_accounts');
      if (saved) return JSON.parse(saved);
      return [{ user: DEFAULT_DEMO_USER, passwordHash: 'password123' }];
    } catch {
      return [{ user: DEFAULT_DEMO_USER, passwordHash: 'password123' }];
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('chats');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Whose chats are currently loaded (kept in sync with conversations/messages in one batch)
  const [owner, setOwner] = useState<string | null>(currentUser?.id ?? null);
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations(owner));
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => loadMessages(owner, conversations));
  const [isTypingMap, setIsTypingMap] = useState<Record<string, boolean>>({});

  const savedMsgsRef = useRef<Record<string, Message[]>>({ ...messages });
  const aiDisabledRef = useRef(false);

  // Always-fresh values for timers/async callbacks (avoids stale closures)
  const latest = useRef({ conversations, messages, activeConversationId, activeTab, settings, currentUser });
  latest.current = { conversations, messages, activeConversationId, activeTab, settings, currentUser };

  // Explore shows the built-in members plus every account registered on this device
  const exploreUsers = useMemo(() => {
    const builtInIds = new Set(INITIAL_EXPLORE_USERS.map((u) => u.id));
    const registered = accounts
      .map((a) => a.user)
      .filter((u) => !builtInIds.has(u.id) && u.id !== currentUser?.id);
    return [...INITIAL_EXPLORE_USERS, ...registered];
  }, [accounts, currentUser?.id]);

  const switchOwner = (user: User | null) => {
    const uid = user?.id ?? null;
    const convs = loadConversations(uid);
    const msgs = loadMessages(uid, convs);
    savedMsgsRef.current = { ...msgs };
    setOwner(uid);
    setConversations(convs);
    setMessages(msgs);
    setIsTypingMap({});
    setActiveConversationId(null);
  };

  // Settings -> DOM (theme, language, text direction)
  useEffect(() => {
    localStorage.setItem('emerald_settings', JSON.stringify(settings));
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.lang = settings.language;
    root.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  }, [settings]);

  useEffect(() => {
    if (currentUser) localStorage.setItem('emerald_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('emerald_current_user');
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('emerald_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (owner && currentUser?.id === owner) {
      try {
        localStorage.setItem(convKey(owner), JSON.stringify(conversations));
      } catch {
        // storage full
      }
    }
  }, [conversations, owner, currentUser?.id]);

  useEffect(() => {
    if (!owner || currentUser?.id !== owner) return;
    for (const [cid, list] of Object.entries(messages)) {
      if (savedMsgsRef.current[cid] === list) continue;
      try {
        localStorage.setItem(msgKey(owner, cid), JSON.stringify(list));
      } catch {
        // storage full (large images/voice notes) - keep working in memory
      }
      savedMsgsRef.current[cid] = list;
    }
  }, [messages, owner, currentUser?.id]);

  const login = (username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const found = accounts.find(
      (a) => a.user.username.toLowerCase() === cleanUsername && a.passwordHash === password
    );
    if (found) {
      setCurrentUser(found.user);
      switchOwner(found.user);
      return { success: true };
    }
    return { success: false, error: 'invalidCredentials' };
  };

  const register: AppContextType['register'] = (data) => {
    const cleanUsername = data.username.trim().toLowerCase();
    if (accounts.some((a) => a.user.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'usernameTaken' };
    }
    if (!(data.age >= 18)) {
      return { success: false, error: 'mustBe18' };
    }

    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: data.username.trim(),
      displayName: data.displayName.trim() || data.username.trim(),
      age: Math.min(99, Math.floor(data.age)),
      country: data.country || DEFAULT_COUNTRY,
      avatarUrl: data.avatarUrl || AVATAR_PRESETS[0],
      bio: data.bio?.trim() || 'Excited to chat and discover people around the world!',
      status: 'online',
      joinedDate: 'Joined just now',
      spokenLanguages: ['English'],
      interests: ['Chat', 'Travel', 'Culture'],
    };

    setAccounts((prev) => [...prev, { user: newUser, passwordHash: data.password }]);
    setCurrentUser(newUser);
    switchOwner(newUser);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    switchOwner(null);
    setActiveTab('chats');
  };

  const deleteAccount = () => {
    if (!currentUser) return;
    const uid = currentUser.id;
    // Wipe this account's chats and message archives from the device
    for (const c of latest.current.conversations) localStorage.removeItem(msgKey(uid, c.id));
    localStorage.removeItem(convKey(uid));
    setAccounts((prev) => prev.filter((a) => a.user.id !== uid));
    setCurrentUser(null);
    switchOwner(null);
    setActiveTab('chats');
  };

  const updateProfile = (data: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data };
    setCurrentUser(updated);
    setAccounts((prev) => prev.map((a) => (a.user.id === updated.id ? { ...a, user: updated } : a)));
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const startOrOpenChat = (user: User): string => {
    const existing = conversations.find((c) => c.participantId === user.id);
    if (existing) {
      setActiveConversationId(existing.id);
      setActiveTab('chats');
      return existing.id;
    }
    const newConvId = `conv_${user.id}_${Date.now()}`;
    const newConv: Conversation = {
      id: newConvId,
      participantId: user.id,
      participant: user,
      unreadCount: 0,
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setMessages((prev) => ({ ...prev, [newConvId]: [] }));
    setActiveConversationId(newConvId);
    setActiveTab('chats');
    return newConvId;
  };

  const deleteConversation = (convId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    setMessages((prev) => {
      const { [convId]: _removed, ...rest } = prev;
      return rest;
    });
    delete savedMsgsRef.current[convId];
    if (owner) localStorage.removeItem(msgKey(owner, convId));
    if (activeConversationId === convId) setActiveConversationId(null);
  };

  const togglePinConversation = (convId: string) => {
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, isPinned: !c.isPinned } : c)));
  };

  const markConversationAsRead = (convId: string) => {
    setConversations((prev) => {
      if (!prev.some((c) => c.id === convId && c.unreadCount > 0)) return prev;
      return prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c));
    });
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
  };

  const fetchAiReply = async (
    partner: User,
    userName: string,
    history: { from: 'me' | 'them'; text: string }[]
  ): Promise<string | null> => {
    if (aiDisabledRef.current) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          userName,
          history,
          partner: {
            displayName: partner.displayName,
            country: partner.country.name,
            bio: partner.bio,
            interests: partner.interests,
            spokenLanguages: partner.spokenLanguages,
          },
        }),
      });
      if (res.status === 503 || res.status === 404) aiDisabledRef.current = true; // no key / no server: stop trying
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.text === 'string' && data.text.trim() ? data.text.trim() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const sendMessage = (conversationId: string, text: string, mediaUrl?: string, isVoice?: boolean) => {
    const me = latest.current.currentUser;
    if (!me || (!text.trim() && !mediaUrl)) return;
    const conv = latest.current.conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      conversationId,
      senderId: me.id,
      senderName: me.displayName,
      text: text.trim(),
      timestamp: fmtTime(),
      status: 'sent',
      mediaUrl,
      isVoice,
    };

    const history = [...(latest.current.messages[conversationId] ?? []), newMsg].slice(-12).map((m) => ({
      from: (m.senderId === me.id ? 'me' : 'them') as 'me' | 'them',
      text: m.isVoice ? '[voice message]' : m.mediaUrl && !m.text ? '[photo]' : m.text,
    }));

    setMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] ?? []), newMsg] }));
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, lastMessage: slimMessage(newMsg), updatedAt: Date.now() } : c))
    );
    if (latest.current.settings.soundEnabled) playChime('send');

    // sent -> delivered
    setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map((m) =>
          m.id === newMsg.id && m.status === 'sent' ? { ...m, status: 'delivered' } : m
        ),
      }));
    }, 500);

    // Partner "types", then answers (Gemini via /api/reply, canned replies as fallback)
    const partner = conv.participant;
    const startedAt = Date.now();
    setTimeout(() => setIsTypingMap((prev) => ({ ...prev, [conversationId]: true })), 800);

    fetchAiReply(partner, me.displayName, history).then((aiText) => {
      const pool = SMART_AUTO_REPLIES[partner.id] || SMART_AUTO_REPLIES.default;
      const replyText = aiText ?? pool[Math.floor(Math.random() * pool.length)];
      const wait = Math.max(0, 2400 - (Date.now() - startedAt));

      setTimeout(() => {
        setIsTypingMap((prev) => ({ ...prev, [conversationId]: false }));
        const now = latest.current;
        // Chat deleted or account switched while we were waiting
        if (now.currentUser?.id !== me.id || !now.conversations.some((c) => c.id === conversationId)) return;

        const replyMsg: Message = {
          id: `msg_reply_${Date.now()}`,
          conversationId,
          senderId: partner.id,
          senderName: partner.displayName,
          text: replyText,
          timestamp: fmtTime(),
          status: 'read',
        };
        const isViewing = now.activeConversationId === conversationId && now.activeTab === 'chats';

        setMessages((prev) => ({
          ...prev,
          [conversationId]: [
            ...(prev[conversationId] ?? []).map((m) =>
              m.senderId === me.id && m.status !== 'read' ? { ...m, status: 'read' as const } : m
            ),
            replyMsg,
          ],
        }));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: replyMsg, unreadCount: isViewing ? 0 : c.unreadCount + 1, updatedAt: Date.now() }
              : c
          )
        );
        if (now.settings.soundEnabled) playChime('receive');
      }, wait);
    });
  };

  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.en;

  return (
    <AppContext.Provider
      value={{
        currentUser,
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
