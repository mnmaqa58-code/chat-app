export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  age: number;
  country: CountryOption;
  avatarUrl: string;
  bio: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string;
  joinedDate: string;
  spokenLanguages: string[];
  interests: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  createdAt?: string;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  isVoice?: boolean;
}

export interface Conversation {
  id: string;
  participantId: string;
  participant: User;
  lastMessage?: Message;
  unreadCount: number;
  isPinned?: boolean;
  updatedAt: number;
}

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'tr' | 'ar' | 'ja';

export type ThemeId = 'dark-emerald' | 'deep-forest' | 'midnight-jade' | 'mint-dark';

export interface UserSettings {
  language: LanguageCode;
  theme: ThemeId;
  showOnlineStatus: boolean;
  soundEnabled: boolean;
  enterToSend: boolean;
}

export type ActiveTab = 'chats' | 'explore' | 'profile';
