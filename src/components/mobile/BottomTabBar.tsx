import React from 'react';
import { Compass, MessageCircle, Map, User, Wine, Users } from 'lucide-react';
import { ActiveTab, AppLanguage } from '../../types';
import { t } from '../../services/i18nService';

interface BottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  unreadCount: number;
  activeHangoutsCount: number;
  friendsCount?: number;
  currentLanguage?: AppLanguage;
  showGamificationTooltip?: boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
  unreadCount,
  activeHangoutsCount,
  friendsCount,
  currentLanguage = 'uk',
  showGamificationTooltip = false,
}) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'discover',
      label: t('tab_discover', currentLanguage),
      icon: <Compass className="w-5 h-5" />,
    },
    {
      id: 'map',
      label: t('tab_map', currentLanguage),
      icon: <Map className="w-5 h-5" />,
    },
    {
      id: 'hangouts',
      label: t('tab_hangouts', currentLanguage),
      icon: <Wine className="w-5 h-5" />,
      badge: activeHangoutsCount > 0 ? activeHangoutsCount : undefined,
    },
    {
      id: 'friends',
      label: t('tab_friends', currentLanguage),
      icon: <Users className="w-5 h-5" />,
      badge: friendsCount !== undefined && friendsCount > 0 ? friendsCount : undefined,
    },
    {
      id: 'chats',
      label: t('tab_chats', currentLanguage),
      icon: <MessageCircle className="w-5 h-5" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      id: 'profile',
      label: t('tab_profile', currentLanguage),
      icon: <User className="w-5 h-5" />,
    },
  ];

  return (
    <nav
      id="mobile-bottom-tabs"
      aria-label="Нижня навігація додатку"
      className="bg-neutral-900/95 backdrop-blur-md border-t border-neutral-800/80 px-1 py-1.5 flex items-center justify-around z-30 select-none safe-bottom"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id || (tab.id === 'map' && activeTab === 'radar');
        return (
          <button
            key={tab.id}
            id={`tab-btn-${tab.id}`}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center relative py-1 px-1.5 sm:px-2 rounded-xl transition-all duration-200 ${
              isActive
                ? 'text-amber-400 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="relative">
              <span className={`transition-transform duration-200 block ${isActive ? 'scale-110' : 'scale-100'}`}>
                {tab.icon}
              </span>
              {tab.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-neutral-950 text-[9px] font-black rounded-full h-3.5 min-w-3.5 px-0.5 flex items-center justify-center shadow-sm">
                  {tab.badge}
                </span>
              )}
            </div>
            {tab.id === 'profile' && showGamificationTooltip && !isActive && (
              <span className="absolute -top-7 right-[-4px] bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap animate-bounce flex items-center gap-1 border border-amber-300 pointer-events-none z-30">
                <span>⚡ Рівні та XP</span>
              </span>
            )}
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[54px]">{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-0 w-4 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
