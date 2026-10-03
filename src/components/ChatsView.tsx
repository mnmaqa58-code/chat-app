import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Message, User } from '../types';
import {
  Search,
  Send,
  Phone,
  Video,
  ArrowLeft,
  Smile,
  Image as ImageIcon,
  CheckCheck,
  Check,
  Compass,
  Pin,
  MoreVertical,
  Trash2,
  Info,
  Mic,
  Square,
  Paperclip,
  PinOff,
} from 'lucide-react';
import { CallModal } from './CallModal';

const COMMON_EMOJIS = ['😊', '👋', '✨', '🌿', '🔥', '❤️', '✈️', '☕', '🎉', '🙌'];

const PHOTO_PRESETS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80',
];

// Downscale photos picked from the device so they fit comfortably in localStorage
const resizeImage = (file: File, maxSide = 900): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const formatClock = (secs: number) =>
  `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

interface ChatsViewProps {
  onInspectUser?: (user: User) => void;
}

export const ChatsView: React.FC<ChatsViewProps> = ({ onInspectUser }) => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    currentUser,
    sendMessage,
    deleteConversation,
    togglePinConversation,
    deleteMessage,
    markConversationAsRead,
    messages: allMessages,
    settings,
    isTypingMap,
    t,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenuForConv, setShowMenuForConv] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ partner: User; type: 'voice' | 'video' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Messages live in the app context (per account, persisted there)
  const messages: Message[] = activeConversationId ? allMessages[activeConversationId] ?? [] : [];

  useEffect(() => {
    if (activeConversationId) markConversationAsRead(activeConversationId);
  }, [activeConversationId]);

  // Close the conversation dropdown when clicking anywhere else
  useEffect(() => {
    if (!showMenuForConv) return;
    const close = () => setShowMenuForConv(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showMenuForConv]);

  const previewOf = (m?: Message) =>
    !m ? '' : m.isVoice ? `🎤 ${t.extra.voiceMessage}` : m.mediaUrl && !m.text ? `📷 ${t.chats.photoSent}` : m.text;

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTypingMap[activeConversationId || '']]);

  const handleSend = () => {
    if (!inputText.trim() || !activeConversationId) return;
    sendMessage(activeConversationId, inputText);
    setInputText('');
    setShowEmojiPicker(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return; // don't hijack IME confirmation (Japanese etc.)
    const wantsSend = settings.enterToSend ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (wantsSend) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendPhoto = (url: string) => {
    if (!activeConversationId) return;
    sendMessage(activeConversationId, '', url);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeConversationId || !file.type.startsWith('image/')) return;
    try {
      sendMessage(activeConversationId, '', await resizeImage(file));
      setShowEmojiPicker(false);
    } catch {
      // unreadable image - ignore
    }
  };

  // ---- Voice messages (MediaRecorder) ----
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordConvRef = useRef<string | null>(null);

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!activeConversationId || isRecording) return;
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      recordConvRef.current = activeConversationId;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setIsRecording(false);
        const convId = recordConvRef.current; // null = cancelled (conversation changed)
        if (!convId || chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') sendMessage(convId, '', reader.result, true);
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecordSeconds(0);
      setIsRecording(true);
      recordTimerRef.current = setInterval(() => setRecordSeconds((sec) => sec + 1), 1000);
    } catch {
      setMediaError(t.extra.noMicAccess);
    }
  };

  // Auto-stop at 60 s
  useEffect(() => {
    if (isRecording && recordSeconds >= 60) stopRecording();
  }, [recordSeconds, isRecording]);

  // Discard an in-progress recording if the user leaves the conversation
  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recordConvRef.current = null;
        recorderRef.current.stop();
      }
    },
    [activeConversationId]
  );

  const filteredConversations = [...conversations]
    .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || b.updatedAt - a.updatedAt)
    .filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.participant.displayName.toLowerCase().includes(q) ||
      c.participant.username.toLowerCase().includes(q) ||
      previewOf(c.lastMessage).toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full h-[calc(100vh-3.5rem-4rem)] md:h-[calc(100vh-3.5rem)] max-w-7xl mx-auto flex overflow-hidden">
      {/* LEFT: Conversation List */}
      <div
        className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col bg-[var(--s-071d14)] border-r border-emerald-950/80 ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Search header */}
        <div className="p-3.5 border-b border-emerald-950/60">
          <div className="relative">
            <Search className="w-4 h-4 text-emerald-400/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t.chats.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--s-0b261b)] text-emerald-100 text-xs rounded-xl pl-9 pr-3 py-2 border border-emerald-900/60 focus:outline-none focus:border-emerald-500/60 placeholder:text-emerald-400/40 transition-colors"
            />
          </div>
        </div>

        {/* Conversation list rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-emerald-950/40">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-3">
                <Compass className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-emerald-200">{t.chats.noChats}</p>
              <p className="text-xs text-emerald-400/60 mt-1 max-w-[200px] leading-relaxed">
                {t.chats.noChatsSub}
              </p>
              <button
                onClick={() => setActiveTab('explore')}
                className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>{t.chats.exploreUsersBtn}</span>
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === activeConversationId;
              const isTyping = isTypingMap[conv.id];

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                  }}
                  className={`group relative flex items-center gap-3 p-3.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--s-0f3424)] border-l-4 border-emerald-400'
                      : 'hover:bg-[var(--s-0a2318)]'
                  }`}
                >
                  {/* Avatar + Status Indicator */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={conv.participant.avatarUrl}
                      alt={conv.participant.displayName}
                      className="w-12 h-12 rounded-full object-cover border border-emerald-600/30"
                      referrerPolicy="no-referrer"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--s-071d14)] ${
                        conv.participant.status === 'online'
                          ? 'bg-emerald-400'
                          : conv.participant.status === 'away'
                          ? 'bg-amber-400'
                          : 'bg-zinc-500'
                      }`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold text-white truncate">
                          {conv.participant.displayName}
                        </span>
                        <span className="text-xs shrink-0">{conv.participant.country.flag}</span>
                        {conv.isPinned && <Pin className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-emerald-300/50 font-medium tabular-nums shrink-0">
                        {conv.lastMessage?.timestamp || ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-emerald-200/70 truncate">
                        {isTyping ? (
                          <span className="text-emerald-400 font-medium animate-pulse">
                            {t.chats.typing}
                          </span>
                        ) : conv.lastMessage ? (
                          previewOf(conv.lastMessage)
                        ) : (
                          <span className="text-emerald-400/40 italic">{t.extra.startChatting}</span>
                        )}
                      </p>

                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Context menu trigger */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenuForConv(showMenuForConv === conv.id ? null : conv.id);
                    }}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 p-1 text-emerald-400/60 hover:text-emerald-200 rounded transition-opacity"
                    aria-label="Conversation options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown menu */}
                  {showMenuForConv === conv.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-10 z-20 w-44 bg-[var(--s-092218)] border border-emerald-800 rounded-xl shadow-xl py-1"
                    >
                      <button
                        onClick={() => {
                          togglePinConversation(conv.id);
                          setShowMenuForConv(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-emerald-200 hover:bg-emerald-500/10 flex items-center gap-2"
                      >
                        {conv.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        <span>{conv.isPinned ? t.extra.unpinChat : t.extra.pinChat}</span>
                      </button>
                      <button
                        onClick={() => {
                          deleteConversation(conv.id);
                          setShowMenuForConv(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.extra.deleteChat}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: Active Chat Room */}
      <div
        className={`flex-1 flex flex-col bg-[var(--s-05170f)] ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Top Bar of active conversation */}
            <div className="h-16 px-4 bg-[var(--s-082015)] border-b border-emerald-950/80 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => setActiveConversationId(null)}
                  className="md:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center text-emerald-300 hover:text-white cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div
                  className="relative cursor-pointer"
                  onClick={() => onInspectUser?.(activeConversation.participant)}
                >
                  <img
                    src={activeConversation.participant.avatarUrl}
                    alt={activeConversation.participant.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-emerald-500/50"
                    referrerPolicy="no-referrer"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--s-082015)] ${
                      activeConversation.participant.status === 'online'
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                    }`}
                  />
                </div>

                <div
                  className="min-w-0 cursor-pointer"
                  onClick={() => onInspectUser?.(activeConversation.participant)}
                >
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold text-white truncate">
                      {activeConversation.participant.displayName}
                    </h2>
                    <span className="text-xs">{activeConversation.participant.country.flag}</span>
                    <span className="text-[11px] text-emerald-400/70 font-medium">
                      {activeConversation.participant.age}y
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300/60 truncate">
                    {isTypingMap[activeConversation.id] ? (
                      <span className="text-emerald-400 font-medium">{t.chats.typing}</span>
                    ) : activeConversation.participant.status === 'online' ? (
                      <span className="text-emerald-400">{t.chats.online}</span>
                    ) : (
                      activeConversation.participant.lastSeen || t.chats.offline
                    )}
                    <span className="mx-1">·</span>
                    <span>{activeConversation.participant.country.name}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() =>
                    setActiveCall({ partner: activeConversation.participant, type: 'voice' })
                  }
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/40 transition-colors cursor-pointer"
                  aria-label={t.chats.voiceCall}
                  title={t.chats.voiceCall}
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setActiveCall({ partner: activeConversation.participant, type: 'video' })
                  }
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/40 transition-colors cursor-pointer"
                  aria-label={t.chats.videoCall}
                  title={t.chats.videoCall}
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onInspectUser?.(activeConversation.participant)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/40 transition-colors cursor-pointer"
                  aria-label="User Info"
                  title="Profile Info"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-[var(--s-05170f)] to-[var(--s-04130c)]">
              {/* Partner profile header intro badge */}
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <img
                  src={activeConversation.participant.avatarUrl}
                  alt={activeConversation.participant.displayName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500/40 shadow-lg shadow-emerald-950 mb-2"
                  referrerPolicy="no-referrer"
                />
                <h3 className="text-sm font-semibold text-white">
                  {activeConversation.participant.displayName}
                </h3>
                <p className="text-xs text-emerald-300/70 max-w-sm mt-1 px-4 leading-relaxed">
                  {activeConversation.participant.bio}
                </p>
                <div className="mt-2 text-[11px] text-emerald-400/60">
                  {activeConversation.participant.country.flag} {activeConversation.participant.country.name} · {activeConversation.participant.age} {t.explore.ageYears}
                </div>
              </div>

              {/* Message bubbles */}
              {messages.map((msg) => {
                const isMe = msg.senderId === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                        isMe
                          ? 'bg-emerald-600 text-white rounded-br-xs'
                          : 'bg-[var(--s-0e2d1f)] text-emerald-50 border border-emerald-800/40 rounded-bl-xs'
                      }`}
                    >
                      {msg.mediaUrl && msg.isVoice && (
                        <audio controls src={msg.mediaUrl} className="max-w-[240px] h-9 mb-1" />
                      )}
                      {msg.mediaUrl && !msg.isVoice && (
                        <div className="mb-2 rounded-xl overflow-hidden max-w-[280px]">
                          <img
                            src={msg.mediaUrl}
                            alt="Media shared"
                            className="w-full h-auto object-cover rounded-lg"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {msg.text && <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>}

                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] tabular-nums ${
                          isMe ? 'text-emerald-100/70' : 'text-emerald-400/60'
                        }`}
                      >
                        <button
                          onClick={() => deleteMessage(activeConversation.id, msg.id)}
                          className="opacity-50 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                          aria-label={t.extra.deleteMessage}
                          title={t.extra.deleteMessage}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span>{msg.timestamp}</span>
                        {isMe && (
                          <span>
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-200/50" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-emerald-200/70" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTypingMap[activeConversation.id] && (
                <div className="flex items-center gap-2">
                  <div className="bg-[var(--s-0e2d1f)] border border-emerald-800/40 rounded-2xl rounded-bl-xs px-3.5 py-2.5 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Starters & Media Drawer */}
            <div className="px-4 py-1.5 bg-[var(--s-071c13)] border-t border-emerald-950/60 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
              <span className="text-[11px] text-emerald-400/50 font-medium shrink-0">
                {t.chats.quickGreetings}:
              </span>
              {[
                `Hello from ${currentUser?.country.name}! 👋`,
                'How is your week going?',
                'Loved your bio!',
                'What are your favorite hobbies?',
              ].map((starter, i) => (
                <button
                  key={i}
                  onClick={() => {
                    sendMessage(activeConversation.id, starter);
                  }}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--s-0b281c)] hover:bg-emerald-900/60 border border-emerald-800/40 text-emerald-200 text-xs transition-colors cursor-pointer"
                >
                  {starter}
                </button>
              ))}
            </div>

            {/* Emoji Quick Picker Popup */}
            {showEmojiPicker && (
              <div className="px-4 py-2 bg-[var(--s-092218)] border-t border-emerald-900/50 flex items-center gap-2 overflow-x-auto">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                      inputRef.current?.focus();
                    }}
                    className="text-lg p-1.5 hover:bg-emerald-900/50 rounded-lg transition-transform active:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
                <span className="h-4 w-px bg-emerald-800/60 mx-1" />
                <button
                  onClick={() => handleSendPhoto(PHOTO_PRESETS[0])}
                  className="px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-800 text-[11px] text-emerald-300 flex items-center gap-1 shrink-0"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{t.extra.samplePhoto}</span>
                </button>
              </div>
            )}

            {mediaError && (
              <div className="px-4 py-1.5 text-xs text-red-300 bg-red-950/40 border-t border-red-900/40">{mediaError}</div>
            )}

            {/* Bottom Message Input Bar */}
            <div className="p-3 bg-[var(--s-082015)] border-t border-emerald-950 flex items-center gap-2">
              {isRecording ? (
                <>
                  <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-950/30 border border-red-900/50 text-sm text-red-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="tabular-nums">{formatClock(recordSeconds)}</span>
                    <span className="text-xs text-red-300/70 truncate">{t.extra.recordVoice}</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950 cursor-pointer"
                    aria-label={t.extra.stopRecording}
                    title={t.extra.stopRecording}
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                      showEmojiPicker
                        ? 'bg-emerald-600/30 text-emerald-300'
                        : 'text-emerald-400/70 hover:text-emerald-200 hover:bg-emerald-900/40'
                    }`}
                    aria-label="Add emoji or photo"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-400/70 hover:text-emerald-200 hover:bg-emerald-900/40 transition-colors cursor-pointer"
                    aria-label={t.extra.attachPhoto}
                    title={t.extra.attachPhoto}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePick} className="hidden" />

                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      rows={1}
                      placeholder={t.chats.typeMessage}
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={handleKeyDown}
                      className="w-full resize-none bg-[var(--s-0d2a1d)] text-emerald-50 text-sm rounded-xl pl-3.5 pr-3 py-2.5 border border-emerald-850/80 focus:outline-none focus:border-emerald-500/80 placeholder:text-emerald-400/40 transition-colors shadow-inner block"
                    />
                  </div>

                  {inputText.trim() ? (
                    <button
                      onClick={handleSend}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950"
                      aria-label={t.chats.send}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all cursor-pointer bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300"
                      aria-label={t.extra.recordVoice}
                      title={t.extra.recordVoice}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          /* Empty state on desktop when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[var(--s-05170f)]">
            <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-4 shadow-lg">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-white">{t.extra.selectConversation}</h3>
            <p className="text-xs text-emerald-300/60 mt-1 max-w-xs leading-relaxed">
              {t.extra.selectConversationSub}
            </p>
            <button
              onClick={() => setActiveTab('explore')}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>{t.chats.exploreUsersBtn}</span>
            </button>
          </div>
        )}
      </div>

      {/* Simulated Live Call Modal */}
      {activeCall && (
        <CallModal
          partner={activeCall.partner}
          type={activeCall.type}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
};
