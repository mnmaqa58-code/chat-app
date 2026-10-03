import React from 'react';
import { useApp } from '../context/AppContext';
import { MessageSquare, Compass, User, Sparkles } from 'lucide-react';
import { ActiveTab } from '../types';

export const HeaderNav: React.FC = () => {
  const { activeTab, setActiveTab, currentUser, t, conversations, settings } = useApp();

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'chats',
      label: t.tabs.chats,
      icon: <MessageSquare className="w-4 h-4" />,
      badge: totalUnread > 0 ? totalUnread : undefined,
    },
    {
      id: 'explore',
      label: t.tabs.explore,
      icon: <Compass className="w-4 h-4" />,
    },
    {
      id: 'profile',
      label: t.tabs.profile,
      icon: <User className="w-4 h-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-[var(--s-061a12)]/95 backdrop-blur-md border-b border-emerald-950/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-950">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
            Emerald<span className="text-emerald-400 font-semibold">Chat</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links for Tablet/Desktop */}
        <nav className="hidden md:flex items-center gap-1 bg-emerald-950/40 p-1 rounded-xl border border-emerald-900/40">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap min-h-[36px] ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                    : 'text-emerald-200/70 hover:text-white hover:bg-emerald-900/30'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-400 text-emerald-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Profile Quick Affordance */}
        <div className="flex items-center gap-2.5">
          {currentUser ? (
            <button
              onClick={() => setActiveTab('profile')}
              aria-label="View Profile"
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-900/50 transition-colors group cursor-pointer"
            >
              <div className="relative">
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.displayName}
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                  referrerPolicy="no-referrer"
                />
                {settings.showOnlineStatus && (
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[var(--s-061a12)]" />
                )}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-emerald-100 group-hover:text-white max-w-[100px] truncate">
                {currentUser.displayName}
              </span>
              <span className="text-xs">{currentUser.country.flag}</span>
            </button>
          ) : (
            <div className="text-xs text-emerald-400 font-medium">Guest</div>
          )}
        </div>
      </div>
    </header>
  );
};
