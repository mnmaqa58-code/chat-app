import React from 'react';
import { useApp } from '../context/AppContext';
import { MessageSquare, Compass, User } from 'lucide-react';
import { ActiveTab } from '../types';

export const BottomTabBar: React.FC = () => {
  const { activeTab, setActiveTab, t, conversations } = useApp();

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'chats',
      label: t.tabs.chats,
      icon: <MessageSquare className="w-5 h-5" />,
      badge: totalUnread > 0 ? totalUnread : undefined,
    },
    {
      id: 'explore',
      label: t.tabs.explore,
      icon: <Compass className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: t.tabs.profile,
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--s-061a12)]/95 backdrop-blur-lg border-t border-emerald-950/80 px-4 pb-safe">
      <div className="grid grid-cols-3 items-center h-16 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors relative cursor-pointer ${
                isActive ? 'text-emerald-400 font-semibold' : 'text-emerald-300/60 hover:text-emerald-200'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
