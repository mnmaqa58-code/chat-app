/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HeaderNav } from './components/HeaderNav';
import { BottomTabBar } from './components/BottomTabBar';
import { ChatsView } from './components/ChatsView';
import { ExploreView } from './components/ExploreView';
import { ProfileView } from './components/ProfileView';
import { AuthView } from './components/AuthView';
import { UserDetailsModal } from './components/UserDetailsModal';
import { User } from './types';

const MainApp: React.FC = () => {
  const { currentUser, activeTab, authReady } = useApp();
  const [inspectedUser, setInspectedUser] = useState<User | null>(null);

  if (!authReady) {
    return <div className="min-h-screen bg-[var(--s-05170f)]" />;
  }

  if (!currentUser) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--s-05170f)] text-emerald-50 selection:bg-emerald-600 selection:text-white transition-colors duration-200">
      {/* Top Bar Contract (3 Zones) */}
      <HeaderNav />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-x-hidden">
        {activeTab === 'chats' && <ChatsView onInspectUser={(user) => setInspectedUser(user)} />}
        {activeTab === 'explore' && <ExploreView onInspectUser={(user) => setInspectedUser(user)} />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      {/* Mobile Ergonomic Bottom Tab Bar */}
      <BottomTabBar />

      {/* User Inspection Modal from Explore or Chats */}
      {inspectedUser && (
        <UserDetailsModal user={inspectedUser} onClose={() => setInspectedUser(null)} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
