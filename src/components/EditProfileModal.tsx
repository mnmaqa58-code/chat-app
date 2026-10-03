import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { COUNTRIES } from '../data/countries';
import { AVATAR_PRESETS } from '../data/mockUsers';
import { X, Upload, Check, Camera } from 'lucide-react';

interface EditProfileModalProps {
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose }) => {
  const { currentUser, updateProfile, t } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [age, setAge] = useState<number>(currentUser?.age || 25);
  const [countryCode, setCountryCode] = useState(currentUser?.country.code || 'US');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || AVATAR_PRESETS[0]);
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [languagesText, setLanguagesText] = useState(
    currentUser?.spokenLanguages.join(', ') || 'English'
  );
  const [interestsText, setInterestsText] = useState(
    currentUser?.interests.join(', ') || 'Chat, Travel'
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

    const spokenLanguages = languagesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const interests = interestsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    updateProfile({
      displayName: displayName.trim() || currentUser?.displayName,
      age: Math.max(18, Math.min(100, Number(age))),
      country: selectedCountry,
      avatarUrl,
      bio: bio.trim(),
      spokenLanguages: spokenLanguages.length > 0 ? spokenLanguages : ['English'],
      interests: interests.length > 0 ? interests : ['Chat'],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--s-092218)] border border-emerald-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl my-8 text-emerald-50">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-emerald-900/60 mb-5">
          <h2 className="text-lg font-bold text-white tracking-tight">
            {t.profile.editProfile}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-900/50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Avatar (pp) Picker */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-2">
              {t.auth.profilePicture} (pp)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group">
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center text-white transition-opacity cursor-pointer"
                >
                  <Camera className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 w-full">
                <div className="text-[11px] text-emerald-400/80 mb-1.5">Choose preset avatar:</div>
                <div className="flex items-center gap-2 mb-2">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`relative w-10 h-10 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        avatarUrl === preset
                          ? 'border-emerald-400 scale-105 shadow-sm'
                          : 'border-emerald-900 hover:border-emerald-600'
                      }`}
                    >
                      <img
                        src={preset}
                        alt={`Preset ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {avatarUrl === preset && (
                        <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom File Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t.auth.uploadCustom}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-1">
              {t.auth.displayName}
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3.5 py-2.5 border border-emerald-800/80 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Age & Country Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Age */}
            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1">
                {t.auth.age} (18 – 99)
              </label>
              <input
                type="number"
                min={18}
                max={99}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3.5 py-2.5 border border-emerald-800/80 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1">
                {t.auth.country}
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2.5 border border-emerald-800/80 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-1">
              {t.profile.bio}
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others what you like to talk about..."
              className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl p-3 border border-emerald-800/80 focus:outline-none focus:border-emerald-500 transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Spoken Languages */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-1">
              {t.profile.spokenLanguages} (comma separated)
            </label>
            <input
              type="text"
              value={languagesText}
              onChange={(e) => setLanguagesText(e.target.value)}
              placeholder="English, Spanish, French..."
              className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3.5 py-2.5 border border-emerald-800/80 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Interests */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-1">
              {t.profile.interests} (comma separated)
            </label>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="Photography, Hiking, Music, Tech..."
              className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3.5 py-2.5 border border-emerald-800/80 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-5 mt-4 border-t border-emerald-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-300 text-xs font-medium transition-colors cursor-pointer"
          >
            {t.profile.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-colors cursor-pointer"
          >
            {t.profile.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
};
