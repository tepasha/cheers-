import React, { useState, useEffect } from 'react';
import { Beer, ChevronRight, Lock, ShieldCheck, WifiOff, Database } from 'lucide-react';
import { ChatThread } from '../../types';
import { firestoreSyncService } from '../../services/firestoreSyncService';

interface ChatListViewProps {
  chats: ChatThread[];
  onSelectChat: (chat: ChatThread) => void;
  onQuickDiscover: () => void;
}

export const ChatListView: React.FC<ChatListViewProps> = ({
  chats,
  onSelectChat,
  onQuickDiscover,
}) => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsub = firestoreSyncService.onNetworkStatusChange((online, basement) => {
      setIsOffline(!online || basement);
    });
    return unsub;
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-y-auto no-scrollbar select-none">
      {/* Top Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5 leading-none">
            Діалоги та тости 💬
          </h2>
          <p className="text-[10px] text-neutral-400">Спільні келихи у реальному часі</p>
        </div>

        <div className="flex items-center gap-1.5">
          {isOffline && (
            <div 
              className="flex items-center gap-1 text-[9px] bg-amber-950/80 border border-amber-500/40 text-amber-300 px-2 py-1 rounded-lg font-medium shadow-sm"
              title="Підвальний бар: Локальний кеш IndexedDB активний"
            >
              <WifiOff className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>Офлайн-кеш</span>
            </div>
          )}

          <div 
            id="chats-e2ee-badge"
            className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 shadow-sm flex items-center justify-center select-none"
            title="Захищено наскрізним шифруванням"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Offline basement bar notice if disconnected */}
      {isOffline && (
        <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-lg bg-neutral-900/90 border border-amber-500/30 flex items-center gap-2 text-[10px] text-neutral-300">
          <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Усі діалоги завантажені з локального кешу. Ви можете писати тости — вони відправляться при виході з підвалу.</span>
        </div>
      )}

      {/* Matches Horizontal Scroll Strip (Нові метчі) */}
      <div className="px-4 pt-3 pb-2 border-b border-neutral-900">
        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-[10px]">
          Свіжі метчі (Готові випити)
        </span>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {chats.map((c) => (
            <button
              key={c.id}
              type="button"
              id={`quick-match-avatar-${c.id}`}
              onClick={() => onSelectChat(c)}
              className="flex flex-col items-center gap-1 min-w-[58px] group"
            >
              <div className="relative">
                <div className="w-13 h-13 rounded-full border-2 border-amber-400/80 p-0.5 group-hover:scale-105 transition shadow-md">
                  <img
                    src={c.buddy.avatar}
                    alt={c.buddy.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                {c.buddy.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
                )}
                {c.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-extrabold flex items-center justify-center shadow">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-neutral-300 font-medium truncate max-w-[58px]">
                {c.buddy.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Threads List */}
      <div className="flex-1 p-2 space-y-1">
        {chats.length > 0 ? (
          chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              id={`chat-thread-${chat.id}`}
              onClick={() => onSelectChat(chat)}
              className="w-full p-3 rounded-2xl bg-neutral-900/40 hover:bg-neutral-900/90 border border-transparent hover:border-neutral-800 transition flex items-center gap-3 text-left group"
            >
              <div className="relative">
                <img
                  src={chat.buddy.avatar}
                  alt={chat.buddy.name}
                  className="w-12 h-12 rounded-full object-cover border border-neutral-700"
                />
                {chat.buddy.online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                    {chat.buddy.name}
                  </h4>
                  <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                    <Lock className="w-2.5 h-2.5 text-emerald-500/80" title="Захищено E2EE" />
                    <span>{chat.lastMessageTime}</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-300 truncate">
                  {chat.lastMessage}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-1">
                  <span>📍 {chat.buddy.locationName}</span>
                  <span>•</span>
                  <span className="text-amber-400/90">{chat.buddy.favoriteBars[0]}</span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 transition" />
            </button>
          ))
        ) : (
          <div className="p-6 text-center text-xs text-neutral-400">
            <Beer className="w-10 h-10 text-amber-500/40 mx-auto mb-2" />
            <p>У вас поки немає активних діалогів.</p>
            <button
              type="button"
              id="empty-chats-discover-btn"
              onClick={onQuickDiscover}
              className="mt-3 px-3 py-1.5 bg-amber-500 text-neutral-950 font-bold rounded-lg"
            >
              Знайти компанію
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
