import React, { useState, useEffect } from 'react';
import { 
  Beer, 
  ChevronRight, 
  Lock, 
  ShieldCheck, 
  WifiOff, 
  Database, 
  Users, 
  Trash2, 
  Search, 
} from 'lucide-react';
import { ChatThread, BuddyProfile, ChatParticipant } from '../../types';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { sounds } from '../../services/soundService';
import { DeleteChatConfirmModal } from './DeleteChatConfirmModal';
import { CreateGroupChatModal } from './CreateGroupChatModal';

interface ChatListViewProps {
  chats: ChatThread[];
  buddies?: BuddyProfile[];
  onSelectChat: (chat: ChatThread) => void;
  onQuickDiscover: () => void;
  onDeleteChat?: (chatId: string) => void;
  onCreateGroupChat?: (groupData: {
    name: string;
    topic: string;
    avatar: string;
    participants: ChatParticipant[];
  }) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
}

export const ChatListView: React.FC<ChatListViewProps> = ({
  chats,
  buddies = [],
  onSelectChat,
  onQuickDiscover,
  onDeleteChat,
  onCreateGroupChat,
  currentUserId,
  currentUserName,
  currentUserAvatar,
}) => {
  const [isOffline, setIsOffline] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'direct' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatToDelete, setChatToDelete] = useState<ChatThread | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = firestoreSyncService.onNetworkStatusChange((online, basement) => {
      setIsOffline(!online || basement);
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const directChatsCount = chats.filter((c) => !c.isGroup).length;
  const groupChatsCount = chats.filter((c) => c.isGroup).length;

  const filteredChats = chats.filter((chat) => {
    // 1. Tab filter
    if (activeFilter === 'direct' && chat.isGroup) return false;
    if (activeFilter === 'groups' && !chat.isGroup) return false;

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = chat.isGroup 
        ? (chat.groupName || chat.buddy.name).toLowerCase().includes(q)
        : chat.buddy.name.toLowerCase().includes(q);
      const lastMsgMatch = chat.lastMessage.toLowerCase().includes(q);
      const topicMatch = chat.groupTopic?.toLowerCase().includes(q) || false;
      return titleMatch || lastMsgMatch || topicMatch;
    }
    return true;
  });

  const handleDeleteConfirm = () => {
    if (!chatToDelete) return;
    const title = chatToDelete.isGroup
      ? chatToDelete.groupName || chatToDelete.buddy.name
      : chatToDelete.buddy.name;
    
    if (onDeleteChat) {
      onDeleteChat(chatToDelete.id);
    }
    showToast(`Чат «${title}» видалено`);
    setChatToDelete(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-y-auto no-scrollbar select-none relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-amber-500/40 text-xs text-amber-300 font-semibold shadow-xl animate-in fade-in slide-in-from-top-2">
          {toastMsg}
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-20">
        <div>
          <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-1.5 leading-none">
            Діалоги та тости 💬
          </h2>
          <p className="text-[10px] text-neutral-400">Спільні келихи у реальному часі</p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Create Group Chat Button */}
          {onCreateGroupChat && (
            <button
              type="button"
              id="header-create-group-btn"
              onClick={() => {
                sounds.playTap();
                setIsCreateGroupOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
              title="Створити новий груповий чат"
            >
              <Users className="w-3.5 h-3.5" />
              <span>+ Група</span>
            </button>
          )}

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
        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block truncate mb-3">
          Свіжі метчі (Готові випити)
        </span>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pt-2 pb-1">
          {chats.map((c) => {
            const isGroup = !!c.isGroup;
            const displayName = isGroup ? (c.groupName || c.buddy.name) : c.buddy.name;
            const avatarImg = isGroup ? (c.groupAvatar || c.buddy.avatar) : c.buddy.avatar;
            return (
              <button
                key={c.id}
                type="button"
                id={`quick-match-avatar-${c.id}`}
                onClick={() => onSelectChat(c)}
                className="flex flex-col items-center gap-1 min-w-[58px] group"
              >
                <div className="relative">
                  <div className={`w-13 h-13 rounded-full border-2 p-0.5 group-hover:scale-105 transition shadow-md ${
                    isGroup ? 'border-amber-400' : 'border-amber-400/80'
                  }`}>
                    <img
                      src={avatarImg}
                      alt={displayName}
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {isGroup ? (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center font-bold text-[8px] ring-2 ring-neutral-950">
                      👥
                    </span>
                  ) : (
                    c.buddy.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
                    )
                  )}
                  {c.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-neutral-950 text-[10px] font-extrabold flex items-center justify-center shadow ring-2 ring-neutral-950">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-300 font-medium truncate max-w-[58px]">
                  {displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="px-3 pt-2.5 pb-1 space-y-2 border-b border-neutral-900/60">
        <div className="flex items-center justify-between gap-1.5">
          {/* Tabs: All / Direct / Groups */}
          <div className="flex items-center gap-1 bg-neutral-900/80 p-0.5 rounded-xl border border-neutral-800">
            <button
              type="button"
              id="filter-tab-all"
              onClick={() => {
                sounds.playTap();
                setActiveFilter('all');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                activeFilter === 'all'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Всі ({chats.length})
            </button>
            <button
              type="button"
              id="filter-tab-direct"
              onClick={() => {
                sounds.playTap();
                setActiveFilter('direct');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                activeFilter === 'direct'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Особисті ({directChatsCount})
            </button>
            <button
              type="button"
              id="filter-tab-groups"
              onClick={() => {
                sounds.playTap();
                setActiveFilter('groups');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                activeFilter === 'groups'
                  ? 'bg-amber-400 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Групи ({groupChatsCount})</span>
            </button>
          </div>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            id="chats-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук діалогів чи груп..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition"
          />
        </div>
      </div>

      {/* Chat Threads List */}
      <div className="flex-1 p-2 space-y-1">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat) => {
            const isGroup = !!chat.isGroup;
            const chatTitle = isGroup ? (chat.groupName || chat.buddy.name) : chat.buddy.name;
            const chatAvatar = isGroup ? (chat.groupAvatar || chat.buddy.avatar) : chat.buddy.avatar;
            const participantsCount = chat.participants?.length || 0;

            return (
              <div
                key={chat.id}
                id={`chat-thread-${chat.id}`}
                className="w-full p-2.5 rounded-2xl bg-neutral-900/40 hover:bg-neutral-900/90 border border-transparent hover:border-neutral-800 transition flex items-center gap-3 text-left group"
              >
                {/* Main clickable area to enter chat */}
                <div
                  onClick={() => onSelectChat(chat)}
                  className="flex-1 flex items-center gap-3 min-w-0 cursor-pointer"
                >
                  <div className="relative shrink-0">
                    <img
                      src={chatAvatar}
                      alt={chatTitle}
                      className="w-12 h-12 rounded-full object-cover border border-neutral-700"
                      referrerPolicy="no-referrer"
                    />
                    {isGroup ? (
                      <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center font-bold text-[8px] ring-2 ring-neutral-950">
                        👥
                      </span>
                    ) : (
                      chat.buddy.online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
                      )
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition truncate">
                          {chatTitle}
                        </h4>
                        {isGroup && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shrink-0">
                            {participantsCount} уч.
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-400 shrink-0">
                        <Lock className="w-2.5 h-2.5 text-emerald-500/80" title="Захищено E2EE" />
                        <span>{chat.lastMessageTime}</span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-300 truncate">
                      {chat.lastMessage}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-1">
                      {isGroup ? (
                        <span className="text-amber-400/90 truncate">
                          {chat.groupTopic || 'Груповий чат спільноти'}
                        </span>
                      ) : (
                        <>
                          <span>📍 {chat.buddy.locationName}</span>
                          <span>•</span>
                          <span className="text-amber-400/90">{chat.buddy.favoriteBars[0]}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side actions: Delete button & Chevron */}
                <div className="flex items-center gap-1 shrink-0">
                  {onDeleteChat && (
                    <button
                      type="button"
                      id={`delete-chat-btn-${chat.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playTap();
                        setChatToDelete(chat);
                      }}
                      className="p-1.5 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/15 transition"
                      title={isGroup ? 'Видалити груповий чат' : 'Видалити цей чат'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectChat(chat)}
                    className="p-1 text-neutral-500 group-hover:text-neutral-200 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-neutral-400 space-y-3">
            <Beer className="w-10 h-10 text-amber-500/40 mx-auto" />
            <div>
              {activeFilter === 'groups' ? (
                <>
                  <p className="font-semibold text-neutral-300">Немає групових чатів</p>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Створіть свій перший груповий чат для друзів, колег чи мітапу в барі!
                  </p>
                </>
              ) : activeFilter === 'direct' ? (
                <>
                  <p className="font-semibold text-neutral-300">Немає особистих діалогів</p>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Знайдіть співрозмовника у вкладці «Знайомства» або на мапі.
                  </p>
                </>
              ) : (
                <p>У вас поки немає активних діалогів.</p>
              )}
            </div>

            {activeFilter === 'groups' && onCreateGroupChat ? (
              <button
                type="button"
                id="empty-create-group-btn"
                onClick={() => {
                  sounds.playTap();
                  setIsCreateGroupOpen(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 mx-auto shadow-md"
              >
                <Users className="w-3.5 h-3.5" />
                <span>+ Створити груповий чат</span>
              </button>
            ) : (
              <button
                type="button"
                id="empty-chats-discover-btn"
                onClick={onQuickDiscover}
                className="px-3 py-1.5 bg-amber-500 text-neutral-950 font-bold rounded-lg"
              >
                Знайти компанію
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Chat Confirmation Modal */}
      <DeleteChatConfirmModal
        isOpen={!!chatToDelete}
        onClose={() => setChatToDelete(null)}
        onConfirmDelete={handleDeleteConfirm}
        chatTitle={
          chatToDelete
            ? chatToDelete.isGroup
              ? chatToDelete.groupName || chatToDelete.buddy.name
              : chatToDelete.buddy.name
            : ''
        }
        isGroup={!!chatToDelete?.isGroup}
      />

      {/* Create Group Chat Modal */}
      {onCreateGroupChat && (
        <CreateGroupChatModal
          isOpen={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
          buddies={buddies}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          onCreateGroup={(groupData) => {
            onCreateGroupChat(groupData);
            showToast(`Груповий чат «${groupData.name}» створено! 🍻`);
          }}
        />
      )}
    </div>
  );
};
