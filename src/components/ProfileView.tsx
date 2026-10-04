import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings as SettingsIcon,
  Edit3,
  Calendar,
  Globe,
  MessageSquare,
  Shield,
  Heart,
  BookOpen,
} from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';
import { SettingsModal } from './SettingsModal';

export const ProfileView: React.FC = () => {
  const { currentUser, conversations, t } = useApp();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!currentUser) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
      {/* Profile Card Header */}
      <div className="relative bg-[var(--s-092218)] border border-emerald-900/60 rounded-3xl p-6 sm:p-8 shadow-lg overflow-hidden mb-6">
        {/* Decorative backdrop light */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar with status */}
          <div className="relative flex-shrink-0">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover border-2 border-emerald-500/60 shadow-xl shadow-emerald-950"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-1 right-1 text-2xl filter drop-shadow">
              {currentUser.country.flag}
            </span>
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {currentUser.displayName}
                  </h1>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/40">
                    {currentUser.age} {t.explore.ageYears}
                  </span>
                </div>
                <p className="text-xs text-emerald-400/80 font-mono mt-0.5">
                  @{currentUser.username}
                </p>
              </div>

              {/* Action Buttons: Edit Profile & Settings */}
              <div className="flex items-center justify-center sm:justify-end gap-2">
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-all duration-150 cursor-pointer min-h-[40px]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t.profile.editProfile}</span>
                </button>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-200 hover:text-white text-xs font-medium transition-colors cursor-pointer min-h-[40px]"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span>{t.profile.settings}</span>
                </button>
              </div>
            </div>

            {/* Country & Joined */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-emerald-300/70 mt-3">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentUser.country.name}</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentUser.joinedDate}</span>
              </span>
            </div>

            {/* Bio text */}
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-4 leading-relaxed max-w-2xl bg-[var(--s-0b281c)] p-3.5 rounded-2xl border border-emerald-900/50">
              {currentUser.bio}
            </p>
          </div>
        </div>

        {/* Numeric Metrics (with tabular figures) */}
        <div className="grid grid-cols-3 gap-3 pt-6 mt-6 border-t border-emerald-950/80">
          <div className="text-center p-3 rounded-2xl bg-[var(--s-061c12)] border border-emerald-900/40">
            <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
              {conversations.length}
            </div>
            <div className="text-[11px] text-emerald-400/70 mt-0.5">{t.profile.activeChats}</div>
          </div>
          <div className="text-center p-3 rounded-2xl bg-[var(--s-061c12)] border border-emerald-900/40">
            <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
              {currentUser.spokenLanguages.length}
            </div>
            <div className="text-[11px] text-emerald-400/70 mt-0.5">{t.profile.languagesCount}</div>
          </div>
          <div className="text-center p-3 rounded-2xl bg-[var(--s-061c12)] border border-emerald-900/40">
            <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
              {currentUser.interests.length}
            </div>
            <div className="text-[11px] text-emerald-400/70 mt-0.5">{t.explore.interests}</div>
          </div>
        </div>
      </div>

      {/* Profile Details Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spoken Languages */}
        <div className="bg-[var(--s-092218)] border border-emerald-900/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>{t.profile.spokenLanguages}</span>
          </div>
          <div className="text-xs text-emerald-200/80 leading-relaxed">
            {currentUser.spokenLanguages.map((lang, idx) => (
              <span key={lang}>
                {lang}
                {idx < currentUser.spokenLanguages.length - 1 && (
                  <span className="mx-2 text-emerald-600">·</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Interests & Passions */}
        <div className="bg-[var(--s-092218)] border border-emerald-900/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-white mb-3">
            <Heart className="w-4 h-4 text-emerald-400" />
            <span>{t.profile.interests}</span>
          </div>
          <div className="text-xs text-emerald-200/80 leading-relaxed">
            {currentUser.interests.map((interest, idx) => (
              <span key={interest}>
                {interest}
                {idx < currentUser.interests.length - 1 && (
                  <span className="mx-2 text-emerald-600">·</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && <EditProfileModal onClose={() => setIsEditOpen(false)} />}

      {/* Settings Modal */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};
