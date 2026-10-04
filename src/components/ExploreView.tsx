import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { COUNTRIES } from '../data/countries';
import { Search, Filter, MessageSquare, Globe, Sparkles, X, Check } from 'lucide-react';

interface ExploreViewProps {
  onInspectUser: (user: User) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ onInspectUser }) => {
  const { exploreUsers, currentUser, startOrOpenChat, t } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>('all');
  const [onlineOnly, setOnlineOnly] = useState<boolean>(false);

  // Available unique countries from users
  const availableCountries = useMemo(() => {
    const list = Array.from(new Set(exploreUsers.map((u) => u.country.code)));
    return COUNTRIES.filter((c) => list.includes(c.code));
  }, [exploreUsers]);

  // Filtering logic
  const filteredUsers = useMemo(() => {
    return exploreUsers.filter((user) => {
      // Don't show current logged in user in explore
      if (currentUser && user.id === currentUser.id) return false;

      // Online only filter
      if (onlineOnly && user.status !== 'online') return false;

      // Country filter
      if (selectedCountry !== 'all' && user.country.code !== selectedCountry) return false;

      // Age range filter
      if (selectedAgeRange === '18-24' && (user.age < 18 || user.age > 24)) return false;
      if (selectedAgeRange === '25-30' && (user.age < 25 || user.age > 30)) return false;
      if (selectedAgeRange === '31+' && user.age < 31) return false;

      // Search query (name, username, bio, country, interests)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = user.displayName.toLowerCase().includes(q);
        const matchUser = user.username.toLowerCase().includes(q);
        const matchCountry = user.country.name.toLowerCase().includes(q);
        const matchBio = user.bio.toLowerCase().includes(q);
        const matchInterests = user.interests.some((item) => item.toLowerCase().includes(q));
        if (!matchName && !matchUser && !matchCountry && !matchBio && !matchInterests) {
          return false;
        }
      }

      return true;
    });
  }, [exploreUsers, currentUser, onlineOnly, selectedCountry, selectedAgeRange, searchQuery]);

  const hasActiveFilters =
    selectedCountry !== 'all' || selectedAgeRange !== 'all' || onlineOnly || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCountry('all');
    setSelectedAgeRange('all');
    setOnlineOnly(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Globe className="w-3.5 h-3.5" />
            <span>{t.extra.globalDiscovery}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {t.explore.title}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-300/70 mt-1 max-w-xl">
            {t.explore.subtitle}
          </p>
        </div>

        {/* Total stats counter */}
        <div className="flex items-center gap-3 text-xs text-emerald-300/70">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-900/60 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white tabular-nums">
              {exploreUsers.filter((u) => u.status === 'online').length}
            </span>
            <span>{t.extra.onlineNow}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-900/60">
            <span className="font-semibold text-white tabular-nums">{exploreUsers.length}</span>
            <span className="ml-1">{t.extra.members}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[var(--s-092218)] border border-emerald-900/60 rounded-2xl p-3.5 sm:p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-emerald-400/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t.explore.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl pl-9 pr-3 py-2.5 border border-emerald-800/60 focus:outline-none focus:border-emerald-500 placeholder:text-emerald-400/40 transition-colors"
            />
          </div>

          {/* Country Filter */}
          <div className="relative">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2.5 border border-emerald-800/60 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
            >
              <option value="all">{t.explore.allCountries}</option>
              {availableCountries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Age Range Filter */}
          <div className="relative">
            <select
              value={selectedAgeRange}
              onChange={(e) => setSelectedAgeRange(e.target.value)}
              className="w-full bg-[var(--s-0d2e21)] text-emerald-50 text-xs rounded-xl px-3 py-2.5 border border-emerald-800/60 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer appearance-none"
            >
              <option value="all">{t.explore.allAges}</option>
              <option value="18-24">18 – 24 {t.explore.ageYears}</option>
              <option value="25-30">25 – 30 {t.explore.ageYears}</option>
              <option value="31+">31+ {t.explore.ageYears}</option>
            </select>
          </div>

          {/* Online Only Toggle & Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlineOnly(!onlineOnly)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer min-h-[38px] ${
                onlineOnly
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-[var(--s-0d2e21)] text-emerald-300 border-emerald-800/60 hover:border-emerald-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlineOnly ? 'bg-white' : 'bg-emerald-400'}`} />
              <span className="truncate">{t.explore.onlineOnly}</span>
            </button>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="p-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-300 transition-colors cursor-pointer"
                title={t.explore.resetFilters}
                aria-label={t.explore.resetFilters}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
        <div className="bg-[var(--s-092218)] border border-emerald-900/40 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-3">
            <Filter className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">{t.explore.noUsersFound}</h3>
          <p className="text-xs text-emerald-400/60 mt-1 max-w-sm">
            {t.extra.noUsersHint}
          </p>
          <button
            onClick={handleResetFilters}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {t.explore.resetFilters}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user) => {
            const isOnline = user.status === 'online';

            return (
              <div
                key={user.id}
                className="group relative bg-[var(--s-092218)] hover:bg-[var(--s-0c2b1e)] border border-emerald-900/60 hover:border-emerald-700/60 rounded-2xl p-4 transition-all duration-200 flex flex-col shadow-sm"
              >
                {/* Top card row: Avatar, Name, Country */}
                <div className="flex items-start gap-3.5 mb-3">
                  <div
                    className="relative flex-shrink-0 cursor-pointer"
                    onClick={() => onInspectUser(user)}
                  >
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-14 h-14 rounded-2xl object-cover border border-emerald-600/40 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <span
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--s-092218)] ${
                        isOnline
                          ? 'bg-emerald-400'
                          : user.status === 'away'
                          ? 'bg-amber-400'
                          : 'bg-zinc-500'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3
                        onClick={() => onInspectUser(user)}
                        className="text-sm font-semibold text-white truncate cursor-pointer hover:text-emerald-300 transition-colors"
                      >
                        {user.displayName}
                      </h3>
                      <span className="text-sm shrink-0">{user.country.flag}</span>
                    </div>

                    <p className="text-[11px] text-emerald-400/70 truncate">@{user.username}</p>

                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-300/60">
                      <span>{user.age} {t.explore.ageYears}</span>
                      <span>·</span>
                      <span className="truncate">{user.country.name}</span>
                    </div>
                  </div>
                </div>

                {/* Bio text */}
                <p className="text-xs text-emerald-200/80 line-clamp-2 mb-3 leading-relaxed flex-1">
                  {user.bio}
                </p>

                {/* Interests tags as clean quiet typography (zero-pill discipline) */}
                <div className="text-[11px] text-emerald-400/70 mb-3 truncate">
                  {user.interests.slice(0, 3).map((interest, idx) => (
                    <span key={interest}>
                      {interest}
                      {idx < Math.min(user.interests.length, 3) - 1 && <span className="mx-1 opacity-50">·</span>}
                    </span>
                  ))}
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-emerald-950/80">
                  <button
                    onClick={() => startOrOpenChat(user)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer min-h-[38px]"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{t.explore.startChat}</span>
                  </button>

                  <button
                    onClick={() => onInspectUser(user)}
                    className="py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-300 hover:text-white text-xs font-medium transition-colors cursor-pointer min-h-[38px]"
                  >
                    {t.explore.profileDetails}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
