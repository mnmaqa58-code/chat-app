import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LanguageCode, ThemeId } from '../types';
import {
  X,
  Languages,
  Palette,
  Bell,
  LogOut,
  Trash2,
  AlertTriangle,
  Check,
  Shield,
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { settings, updateSettings, logout, deleteAccount, t } = useApp();

  const [confirmLogOut, setConfirmLogOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const languages: { code: LanguageCode; name: string; nativeName: string; flag: string }[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  ];

  const themes: { id: ThemeId; label: string; previewColor: string; bgTone: string }[] = [
    {
      id: 'dark-emerald',
      label: t.themes['dark-emerald'],
      previewColor: '#10b981',
      bgTone: '#061a12',
    },
    {
      id: 'deep-forest',
      label: t.themes['deep-forest'],
      previewColor: '#059669',
      bgTone: '#07160d',
    },
    {
      id: 'midnight-jade',
      label: t.themes['midnight-jade'],
      previewColor: '#0d9488',
      bgTone: '#041517',
    },
    {
      id: 'mint-dark',
      label: t.themes['mint-dark'],
      previewColor: '#34d399',
      bgTone: '#03140e',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--s-092218)] border border-emerald-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl my-8 text-emerald-50">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-emerald-900/60 mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">{t.settings.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900/50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          {/* SECTION 1: Language */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2.5">
              <Languages className="w-4 h-4 text-emerald-400" />
              <span>{t.settings.language}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {languages.map((lang) => {
                const isSelected = settings.language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => updateSettings({ language: lang.code })}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'bg-emerald-700/50 border-emerald-400 text-white shadow-sm'
                        : 'bg-[var(--s-0d2e21)] border-emerald-900/60 text-emerald-200/80 hover:border-emerald-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Theme (Dark Green Family) */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2.5">
              <Palette className="w-4 h-4 text-emerald-400" />
              <span>{t.settings.theme} (Dark Green)</span>
            </div>
            <div className="space-y-2">
              {themes.map((theme) => {
                const isSelected = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => updateSettings({ theme: theme.id })}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'bg-emerald-700/50 border-emerald-400 text-white shadow-sm'
                        : 'bg-[var(--s-0d2e21)] border-emerald-900/60 text-emerald-200/80 hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center"
                        style={{ backgroundColor: theme.bgTone }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: theme.previewColor }}
                        />
                      </div>
                      <span>{theme.label}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: Privacy & Toggles */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>{t.settings.privacyAndNotifications}</span>
            </div>
            <div className="bg-[var(--s-0d2e21)] border border-emerald-900/60 rounded-2xl divide-y divide-emerald-900/40">
              <label className="flex items-center justify-between p-3 cursor-pointer min-h-[44px]">
                <span className="text-xs text-emerald-200">{t.settings.showOnlineStatus}</span>
                <input
                  type="checkbox"
                  checked={settings.showOnlineStatus}
                  onChange={(e) => updateSettings({ showOnlineStatus: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[var(--s-092218)] border-emerald-800"
                />
              </label>

              <label className="flex items-center justify-between p-3 cursor-pointer min-h-[44px]">
                <span className="text-xs text-emerald-200">{t.settings.soundEffects}</span>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[var(--s-092218)] border-emerald-800"
                />
              </label>

              <label className="flex items-center justify-between p-3 cursor-pointer min-h-[44px]">
                <span className="text-xs text-emerald-200">{t.settings.enterToSend}</span>
                <input
                  type="checkbox"
                  checked={settings.enterToSend}
                  onChange={(e) => updateSettings({ enterToSend: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[var(--s-092218)] border-emerald-800"
                />
              </label>
            </div>
          </div>

          {/* SECTION 4: Account Actions (Log Out & Delete Account) */}
          <div className="pt-2 border-t border-emerald-900/60">
            <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2.5">
              {t.settings.accountActions}
            </div>

            <div className="space-y-2">
              {/* Log Out Button */}
              {!confirmLogOut ? (
                <button
                  onClick={() => setConfirmLogOut(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t.settings.logOut}</span>
                </button>
              ) : (
                <div className="p-3 bg-emerald-950/90 border border-emerald-800 rounded-xl space-y-2">
                  <p className="text-xs text-emerald-200">{t.settings.logOutConfirm}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmLogOut(false)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-900/60 hover:bg-emerald-900 text-xs text-emerald-300"
                    >
                      {t.settings.cancel}
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        logout();
                      }}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                    >
                      {t.settings.logOut}
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Account (Danger Zone) */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/60 text-red-300 hover:text-red-200 text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.settings.deleteAccount}</span>
                </button>
              ) : (
                <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{t.settings.deleteAccountConfirm}</span>
                  </div>
                  <p className="text-xs text-red-200/80 leading-relaxed">
                    {t.settings.deleteWarning}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-xs text-emerald-300 border border-emerald-800/60 cursor-pointer"
                    >
                      {t.settings.cancel}
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        deleteAccount();
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-md shadow-red-950 cursor-pointer"
                    >
                      {t.settings.confirmDelete}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
