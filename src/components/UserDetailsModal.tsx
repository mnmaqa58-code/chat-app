import React from 'react';
import { User } from '../types';
import { useApp } from '../context/AppContext';
import { X, MessageSquare, Globe, Heart, BookOpen, Calendar, CheckCircle2 } from 'lucide-react';

interface UserDetailsModalProps {
  user: User | null;
  onClose: () => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose }) => {
  const { startOrOpenChat, t } = useApp();

  if (!user) return null;

  const handleStartChat = () => {
    startOrOpenChat(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[var(--s-092218)] border border-emerald-800/80 rounded-3xl p-6 shadow-2xl text-emerald-50 my-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900/50 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col items-center text-center mt-2 mb-5">
          <div className="relative mb-3">
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-500/80 shadow-lg shadow-emerald-950"
              referrerPolicy="no-referrer"
            />
            <span
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[var(--s-092218)] ${
                user.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <h2 className="text-lg font-bold text-white tracking-tight">{user.displayName}</h2>
            <span className="text-base">{user.country.flag}</span>
          </div>

          <p className="text-xs text-emerald-400/80 font-mono mt-0.5">@{user.username}</p>

          <div className="flex items-center gap-2 mt-2 text-xs text-emerald-300/80">
            <span>{user.age} {t.explore.ageYears}</span>
            <span>·</span>
            <span>{user.country.name}</span>
            <span>·</span>
            <span className="text-emerald-400">{user.status === 'online' ? t.chats.online : t.chats.away}</span>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-[var(--s-0b281c)] border border-emerald-900/60 rounded-2xl p-3.5 mb-4 text-xs text-emerald-100/90 leading-relaxed">
          {user.bio}
        </div>

        {/* Details list */}
        <div className="space-y-3 mb-6">
          {/* Spoken Languages */}
          <div className="bg-[var(--s-0b281c)]/60 border border-emerald-900/40 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.explore.languages}</span>
            </div>
            <div className="text-xs text-emerald-200/80">
              {user.spokenLanguages.join(' · ')}
            </div>
          </div>

          {/* Interests */}
          <div className="bg-[var(--s-0b281c)]/60 border border-emerald-900/40 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-1.5">
              <Heart className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.explore.interests}</span>
            </div>
            <div className="text-xs text-emerald-200/80">
              {user.interests.join(' · ')}
            </div>
          </div>

          {/* Joined date */}
          <div className="flex items-center gap-2 text-[11px] text-emerald-400/70 px-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{user.joinedDate}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleStartChat}
          className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t.explore.startChat}</span>
        </button>
      </div>
    </div>
  );
};
