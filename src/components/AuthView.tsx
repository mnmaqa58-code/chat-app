import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { COUNTRIES } from '../data/countries';
import { AVATAR_PRESETS } from '../data/mockUsers';
import { fileToAvatarDataUrl } from '../utils/image';
import { Sparkles, Upload, Check, Lock, User as UserIcon, AlertCircle, ArrowRight, Camera } from 'lucide-react';

const SERVER_DOWN = 'Cannot reach the server. Please try again in a moment.';

export const AuthView: React.FC = () => {
  const { login, register, t } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Login Form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regAge, setRegAge] = useState<number>(24);
  const [regCountryCode, setRegCountryCode] = useState<string>('US');
  const [regAvatarUrl, setRegAvatarUrl] = useState<string>(AVATAR_PRESETS[0]);
  const [regBio, setRegBio] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      fileToAvatarDataUrl(file).then(setRegAvatarUrl).catch(() => {});
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setErrorMessage(t.auth.fillAllFields);
      return;
    }

    setSubmitting(true);
    const res = await login(loginUsername, loginPassword);
    setSubmitting(false);
    if (!res.success) {
      setErrorMessage(res.error === 'network' ? SERVER_DOWN : t.auth.invalidCredentials);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (!regUsername.trim() || !regPassword.trim() || !regDisplayName.trim()) {
      setErrorMessage(t.auth.fillAllFields);
      return;
    }

    const country = COUNTRIES.find((c) => c.code === regCountryCode) || COUNTRIES[0];

    setSubmitting(true);
    const res = await register({
      username: regUsername,
      password: regPassword,
      displayName: regDisplayName,
      age: Number(regAge),
      country,
      avatarUrl: regAvatarUrl,
      bio: regBio.trim(),
    });
    setSubmitting(false);

    if (!res.success) {
      if (res.error === 'usernameTaken') {
        setErrorMessage(t.auth.usernameTaken);
      } else if (res.error === 'mustBe18') {
        setErrorMessage(t.extra.mustBe18);
      } else if (res.error === 'weakPassword') {
        setErrorMessage('Password must be at least 6 characters.');
      } else if (res.error === 'network') {
        setErrorMessage(SERVER_DOWN);
      } else {
        setErrorMessage(t.auth.fillAllFields);
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--s-05170f)] flex flex-col justify-center items-center p-4 sm:p-6 text-emerald-50">
      {/* Ambient background glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Wordmark & Intro */}
      <div className="text-center mb-6 z-10">
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 shadow-sm mb-3">
          <div className="w-5 h-5 rounded-md bg-emerald-600/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-emerald-300">
            Global Dark Green Messenger
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Emerald<span className="text-emerald-400 font-semibold">Chat</span>
        </h1>
        <p className="text-xs sm:text-sm text-emerald-300/70 mt-1 max-w-sm mx-auto">
          {mode === 'login' ? t.auth.loginSubtitle : t.auth.registerSubtitle}
        </p>
      </div>

      {/* Main Form Container */}
      <div className="w-full max-w-md bg-[var(--s-092218)] border border-emerald-850/90 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 transition-all">
        {/* Toggle Mode Segmented Control */}
        <div className="flex rounded-xl bg-[var(--s-061a12)] p-1 border border-emerald-900/60 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[36px] ${
              mode === 'login'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            {t.auth.loginButton}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[36px] ${
              mode === 'register'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            {t.auth.registerButton}
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1.5">
                {t.auth.username}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-emerald-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={loginUsername}
                  id="login-username" name="username" autoComplete="username"
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl pl-9 pr-3 py-2.5 border border-emerald-800/70 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1.5">
                {t.auth.password}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  id="login-password" name="password" autoComplete="current-password"
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl pl-9 pr-3 py-2.5 border border-emerald-800/70 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] mt-2"
            >
              <span>{t.auth.loginButton}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Avatar / Profile Picture ("pp") Choice */}
            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1.5">
                {t.auth.profilePicture} (pp)
              </label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={regAvatarUrl}
                    alt="Selected avatar"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1 bg-emerald-600 text-white rounded-full border border-[var(--s-092218)] shadow cursor-pointer"
                    title="Upload photo"
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="text-[11px] text-emerald-300/80 mb-1">Pick preset avatar:</div>
                  <div className="flex items-center gap-1.5">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setRegAvatarUrl(preset)}
                        className={`relative w-8 h-8 rounded-lg overflow-hidden border-2 transition-transform cursor-pointer ${
                          regAvatarUrl === preset ? 'border-emerald-400 scale-110' : 'border-emerald-900'
                        }`}
                      >
                        <img
                          src={preset}
                          alt={`Preset ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-300 hover:text-white cursor-pointer"
                      title="Upload custom image"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
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
                required
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                placeholder="e.g. Jordan Vance"
                className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2 border border-emerald-800/70 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  {t.auth.username}
                </label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  id="reg-username" name="username" autoComplete="username"
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="username"
                  className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2 border border-emerald-800/70 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  {t.auth.password}
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  id="reg-password" name="new-password" autoComplete="new-password" minLength={6}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2 border border-emerald-800/70 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Choose Age & Country */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  {t.auth.age} (18 – 99)
                </label>
                <input
                  type="number"
                  min={18}
                  max={99}
                  required
                  value={regAge}
                  onChange={(e) => setRegAge(Number(e.target.value))}
                  className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2 border border-emerald-800/70 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-emerald-200 mb-1">
                  {t.auth.country}
                </label>
                <select
                  value={regCountryCode}
                  onChange={(e) => setRegCountryCode(e.target.value)}
                  className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2 border border-emerald-800/70 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Bio */}
            <div>
              <label className="block text-xs font-semibold text-emerald-200 mb-1">
                Bio (Short status)
              </label>
              <textarea
                rows={2}
                value={regBio}
                onChange={(e) => setRegBio(e.target.value)}
                placeholder="A few words about you..."
                className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl p-2.5 border border-emerald-800/70 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
            >
              <span>{t.auth.registerButton}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
