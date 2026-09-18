import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Beer, 
  MapPin, 
  Check, 
  Sparkles, 
  X,
  ShieldCheck,
  Lock,
  Eye,
  WifiOff,
  Clock,
  UserPlus,
  UserCheck,
  AlertOctagon,
  ShieldAlert,
  UserX,
  MoreVertical,
  Users,
  Trash2,
} from 'lucide-react';
import { ChatThread, Message, ChatParticipant, BuddyProfile } from '../../types';
import { sounds } from '../../services/soundService';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { friendsService } from '../../services/friendsService';
import { safetyModerationService } from '../../services/safetyModerationService';
import { ToastModal } from './ToastModal';
import { SecurityInspectionModal } from './SecurityInspectionModal';
import { SosEmergencyModal } from './SosEmergencyModal';
import { QuickReportModal } from './QuickReportModal';
import { DeleteChatConfirmModal } from './DeleteChatConfirmModal';
import { GroupInfoModal } from './GroupInfoModal';

interface ChatRoomViewProps {
  chat: ChatThread;
  buddies?: BuddyProfile[];
  onBack: () => void;
  onSendMessage: (
    chatId: string, 
    messageText: string, 
    type?: 'text' | 'cheers' | 'location_proposal', 
    proposal?: Message['proposalData'],
    senderOverride?: { senderId: string; senderName: string; senderAvatar?: string }
  ) => void;
  onDeleteChat?: (chatId: string) => void;
  onAddParticipants?: (chatId: string, newParticipants: ChatParticipant[]) => void;
}

export const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  chat,
  buddies = [],
  onBack,
  onSendMessage,
  onDeleteChat,
  onAddParticipants,
}) => {
  const [inputText, setInputText] = useState('');
  const [showToastsModal, setShowToastsModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [inspectedMessageId, setInspectedMessageId] = useState<string | null>(null);
  const [proposalBar, setProposalBar] = useState(chat.buddy.favoriteBars[0] || 'Squat 17b');
  const [proposalTime, setProposalTime] = useState('Сьогодні о 20:30');
  const [isTyping, setIsTyping] = useState(false);
  const [floatingGlasses, setFloatingGlasses] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isBasementMode, setIsBasementMode] = useState(false);
  const [isFriend, setIsFriend] = useState<boolean>(() => friendsService.isFriend(chat.buddy.id));
  const [showSosModal, setShowSosModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState<boolean>(() =>
    safetyModerationService.isUserBlocked(chat.buddy.id)
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubNetwork = firestoreSyncService.onNetworkStatusChange((online, basement) => {
      setIsOnline(online);
      setIsBasementMode(basement);
    });

    const unsubFriend = friendsService.subscribe(() => {
      setIsFriend(friendsService.isFriend(chat.buddy.id));
    });

    const unsubSafety = safetyModerationService.subscribe(() => {
      setIsBlocked(safetyModerationService.isUserBlocked(chat.buddy.id));
    });

    return () => {
      unsubNetwork();
      unsubFriend();
      unsubSafety();
    };
  }, [chat.buddy.id]);

  const handleToggleFriend = () => {
    friendsService.toggleFriend(chat.buddy);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages, isTyping]);

  // Trigger floating beer toast visual animation
  const triggerCheersVisual = () => {
    sounds.playClink();
    const newGlasses = Array.from({ length: 6 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 200 - 100,
      y: Math.random() * -180 - 50,
    }));
    setFloatingGlasses(newGlasses);
    setTimeout(() => {
      setFloatingGlasses([]);
    }, 1500);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sounds.playMessageSent();
    onSendMessage(chat.id, inputText.trim(), 'text');
    setInputText('');

    // Simulate buddy typing and reply
    triggerBuddyReply('text');
  };

  const handleSendToast = (toastText: string) => {
    triggerCheersVisual();
    onSendMessage(chat.id, toastText, 'cheers');
    setShowToastsModal(false);

    triggerBuddyReply('cheers');
  };

  const handleSendLocationProposal = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playMessageSent();
    onSendMessage(chat.id, `Запропонував зустріч у ${proposalBar}`, 'location_proposal', {
      barName: proposalBar,
      address: `${chat.buddy.locationName}`,
      time: proposalTime,
      status: 'pending',
    });
    setShowLocationModal(false);

    triggerBuddyReply('location');
  };

  const triggerBuddyReply = (context: 'text' | 'cheers' | 'location') => {
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        sounds.playMessageSent();

        let reply = 'Домовились! Буду радий побачитись)';
        if (context === 'cheers') {
          reply = chat.isGroup 
            ? 'Дзинь усім! 🍻 Піднімаймо келихи за нашу чудову компанію!' 
            : 'Дзинь! 🍻 Будьмо! До дна за хорошу зустріч!';
        } else if (context === 'location') {
          reply = `Чудовий вибір! Обожнюю ${proposalBar}. Забронюю стіл або буду там трохи раніше! 🥂`;
        } else {
          const replies = chat.isGroup ? [
            'Круто! Я підійду близько 20:00.',
            'Супер, беру нам по келиху крафту!',
            'Підтримую, якраз поруч з локацією!',
            'Хто ще сьогодні буде? Має бути весело 🍻',
          ] : [
            'Круто! Я якраз закінчую справи і можу підійти.',
            'Супер, беру нам по келиху крафту!',
            'Підтримую, атмосфера там зараз дуже затишна.',
          ];
          reply = replies[Math.floor(Math.random() * replies.length)];
        }

        if (chat.isGroup && chat.participants && chat.participants.length > 0) {
          const nonMe = chat.participants.filter((p) => p.id !== 'me');
          const randomMember = nonMe[Math.floor(Math.random() * nonMe.length)] || chat.participants[0];
          onSendMessage(chat.id, reply, 'text', undefined, {
            senderId: randomMember.id,
            senderName: randomMember.name,
            senderAvatar: randomMember.avatar,
          });
        } else {
          onSendMessage(chat.id, reply, 'text');
        }
      }, 1600);
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 relative select-none overflow-hidden">
      {/* Top Chat Bar */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            id="chat-back-btn"
            onClick={onBack}
            className="p-1 rounded-full text-neutral-400 hover:text-white transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            onClick={() => {
              if (chat.isGroup) {
                sounds.playTap();
                setShowGroupInfoModal(true);
              }
            }}
            className={`relative shrink-0 ${chat.isGroup ? 'cursor-pointer hover:opacity-90 transition' : ''}`}
          >
            <img
              src={chat.isGroup ? (chat.groupAvatar || chat.buddy.avatar) : chat.buddy.avatar}
              alt={chat.isGroup ? (chat.groupName || chat.buddy.name) : chat.buddy.name}
              className="w-9 h-9 rounded-full object-cover border border-amber-400/50"
              referrerPolicy="no-referrer"
            />
            {chat.isGroup ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center font-bold text-[8px] ring-2 ring-neutral-950">
                👥
              </span>
            ) : (
              chat.buddy.online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-neutral-950" />
              )
            )}
          </div>

          <div 
            onClick={() => {
              if (chat.isGroup) {
                sounds.playTap();
                setShowGroupInfoModal(true);
              }
            }}
            className={`min-w-0 ${chat.isGroup ? 'cursor-pointer' : ''}`}
          >
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none truncate">
              <span>{chat.isGroup ? (chat.groupName || chat.buddy.name) : chat.buddy.name}</span>
              {!chat.isGroup && (
                <span className="text-[10px] text-amber-400 font-normal">
                  ({chat.buddy.distanceKm} км)
                </span>
              )}
            </h3>
            <p className="text-[10px] text-neutral-400 truncate mt-0.5">
              {chat.isGroup
                ? `${chat.participants?.length || 0} учасників • Натисніть для інфо`
                : chat.buddy.online ? 'Онлайн • Шукає компанію' : 'Був(ла) нещодавно'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* If Group: Group details button, If Direct: Friend status button */}
          {chat.isGroup ? (
            <button
              type="button"
              id="chat-group-info-pill-btn"
              onClick={() => {
                sounds.playTap();
                setShowGroupInfoModal(true);
              }}
              className="px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition active:scale-95"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Учасники</span>
            </button>
          ) : (
            <button
              type="button"
              id="chat-toggle-friend-btn"
              onClick={handleToggleFriend}
              className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition active:scale-95 ${
                isFriend
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-amber-400 border-neutral-800'
              }`}
              title={isFriend ? 'У ваших друзях (клікніть щоб видалити)' : 'Додати до друзів'}
            >
              {isFriend ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden xs:inline">Друг</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xs:inline">+ Друг</span>
                </>
              )}
            </button>
          )}

          {/* Non-clickable E2EE Security Badge (icon only, no text) */}
          <div
            id="header-e2ee-badge"
            className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-sm select-none"
            title="Захищено наскрізним шифруванням"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>

          {/* Quick toast / clink button in header */}
          <button
            type="button"
            id="header-cheers-btn"
            onClick={() => handleSendToast('Будьмо! 🍻')}
            className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
            title="Швидкий тост Дзинь!"
          >
            <Beer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Дзинь!</span>
          </button>

          {/* SOS Safety Emergency Button */}
          <button
            type="button"
            id="chat-sos-btn"
            onClick={() => {
              sounds.playPop();
              setShowSosModal(true);
            }}
            className="px-2 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 text-[10px] font-extrabold flex items-center gap-1 transition active:scale-95 shadow-sm"
            title="SOS: Екстрена безпека та кодове слово для бармена"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>SOS</span>
          </button>

          {/* Safety & Moderation Options Dropdown Toggle */}
          <div className="relative">
            <button
              type="button"
              id="chat-more-options-btn"
              onClick={() => setShowSafetyMenu(!showSafetyMenu)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="Безпека та опції"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showSafetyMenu && (
              <div className="absolute right-0 top-8 w-56 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95">
                {chat.isGroup && (
                  <button
                    type="button"
                    id="chat-menu-group-info-btn"
                    onClick={() => {
                      setShowSafetyMenu(false);
                      setShowGroupInfoModal(true);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white flex items-center gap-2 transition"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>Інформація про групу</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowSafetyMenu(false);
                    setShowSosModal(true);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition"
                >
                  <AlertOctagon className="w-4 h-4 text-red-400" />
                  <span>SOS: Екстрена безпека</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSafetyMenu(false);
                    setShowReportModal(true);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white flex items-center gap-2 transition"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Поскаржитися на акаунт</span>
                </button>

                {!chat.isGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSafetyMenu(false);
                      safetyModerationService.blockUser(
                        chat.buddy.id,
                        chat.buddy.name,
                        chat.buddy.avatar,
                        'Заблоковано в меню чату'
                      );
                      setIsBlocked(true);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-semibold text-neutral-300 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition"
                  >
                    <UserX className="w-4 h-4 text-red-400" />
                    <span>Заблокувати співрозмовника</span>
                  </button>
                )}

                {onDeleteChat && (
                  <div className="pt-1 border-t border-neutral-800">
                    <button
                      type="button"
                      id="chat-menu-delete-btn"
                      onClick={() => {
                        setShowSafetyMenu(false);
                        setShowDeleteConfirmModal(true);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span>{chat.isGroup ? 'Видалити груповий чат' : 'Видалити цей чат'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Basement Bar Offline Cache Notification Banner */}
      {(isBasementMode || !isOnline) && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-amber-950/50 border border-amber-500/30 text-xs shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Режим підвального бару (Офлайн)</span>
            </div>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-medium">
              IndexedDB Кеш
            </span>
          </div>
          <p className="text-[10px] text-neutral-300 mt-1 leading-snug">
            Зв'язок слабкий або відсутній. Повідомлення й тости зберігаються локально та будуть доставлені щойно ви підніметесь нагору.
          </p>
        </div>
      )}

      {/* Floating Animated Toast Emojis */}
      {floatingGlasses.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
          {floatingGlasses.map((glass) => (
            <span
              key={glass.id}
              className="absolute text-4xl animate-clink transition-all duration-700"
              style={{
                transform: `translate(${glass.x}px, ${glass.y}px)`,
                opacity: 0.9,
              }}
            >
              🍻
            </span>
          ))}
        </div>
      )}

      {/* Messages List Area */}
      <div className="flex-1 p-3 overflow-y-auto no-scrollbar space-y-2.5">
        <div className="text-center my-1.5">
          <div
            id="room-e2ee-indicator"
            className="inline-flex items-center gap-1.5 text-[10px] bg-neutral-900/90 text-neutral-400 px-3 py-1 rounded-full border border-neutral-800 select-none"
          >
            <Lock className="w-2.5 h-2.5 text-emerald-400" />
            <span>Наскрізне шифрування • Cloud Firestore</span>
          </div>
        </div>

        {chat.messages.map((msg) => {
          const isInspected = inspectedMessageId === msg.id;

          if (msg.type === 'cheers') {
            return (
              <div
                key={msg.id}
                className={`flex my-2 ${msg.isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  onClick={() => setInspectedMessageId(isInspected ? null : msg.id)}
                  className="bg-gradient-to-tr from-amber-600/30 to-amber-500/10 border border-amber-500/40 rounded-2xl p-3 max-w-[85%] shadow-lg cursor-pointer transition hover:border-amber-400/60"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl animate-bounce">🍻</span>
                      <span className="text-xs font-bold text-amber-300">Тост / Будьмо!</span>
                    </div>
                    <span className="text-emerald-400/90 flex items-center" title="Захищено шифруванням">
                      <Lock className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium italic">"{msg.text}"</p>
                  
                  {isInspected && (
                    <div className="mt-2 pt-1.5 border-t border-amber-500/30 text-[9px] font-mono text-amber-200/80 break-all leading-tight">
                      <div className="flex items-center gap-1 text-emerald-300 font-bold mb-0.5">
                        <Eye className="w-2.5 h-2.5" /> Шифротекст у Firestore:
                      </div>
                      {msg.cipherPayload || `enc:v1:aes256:${btoa(encodeURIComponent(msg.text)).slice(0, 24)}...`}
                    </div>
                  )}

                  <div className="text-[9px] text-amber-400/80 flex items-center justify-end gap-1 mt-1">
                    {msg.hasPendingWrites && (
                      <span className="flex items-center gap-0.5 text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded font-mono text-[8px]" title="Збережено в локальному кеші IndexedDB. Чекає на вихід з підвалу для синхронізації з хмарою">
                        <Clock className="w-2 h-2 animate-spin text-amber-400" />
                        <span>В кеші</span>
                      </span>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          }

          if (msg.type === 'location_proposal' && msg.proposalData) {
            return (
              <div
                key={msg.id}
                className={`flex my-2 ${msg.isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className="bg-neutral-900 border border-amber-500/50 rounded-2xl p-3.5 max-w-[88%] shadow-xl">
                  <div className="flex items-center justify-between mb-1.5 text-amber-400 font-bold text-xs">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>Пропозиція зустрічі в барі</span>
                    </div>
                    <span className="text-emerald-400/90 flex items-center" title="Захищено шифруванням">
                      <Lock className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-0.5">
                    {msg.proposalData.barName}
                  </h4>
                  <p className="text-[11px] text-neutral-400 mb-2">
                    📍 {msg.proposalData.address} • 🕒 {msg.proposalData.time}
                  </p>

                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      id={`accept-proposal-btn-${msg.id}`}
                      onClick={() => {
                        sounds.playClink();
                        triggerBuddyReply('cheers');
                      }}
                      className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[11px] font-bold rounded-lg transition"
                    >
                      Прийняти пропозицію
                    </button>
                  </div>
                  <div className="text-[9px] text-neutral-400 flex items-center justify-end gap-1 mt-1.5">
                    {msg.hasPendingWrites && (
                      <span className="flex items-center gap-0.5 text-amber-400 font-mono text-[8px]" title="Збережено в офлайн-кеші">
                        <Clock className="w-2 h-2 animate-spin" />
                        <span>В кеші</span>
                      </span>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-1.5 ${msg.isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!msg.isMe && (
                <img
                  src={msg.senderAvatar || (chat.isGroup ? chat.groupAvatar : chat.buddy.avatar)}
                  alt={msg.senderName || chat.buddy.name}
                  className="w-6 h-6 rounded-full object-cover mb-0.5 shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}

              <div
                onClick={() => setInspectedMessageId(isInspected ? null : msg.id)}
                className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed cursor-pointer transition ${
                  msg.isMe
                    ? 'bg-amber-500 text-neutral-950 font-medium rounded-br-none shadow-sm hover:brightness-105'
                    : 'bg-neutral-900 text-neutral-100 border border-neutral-800 rounded-bl-none shadow-sm hover:border-neutral-700'
                }`}
                title="Натисніть, щоб переглянути шифротекст"
              >
                {chat.isGroup && !msg.isMe && (
                  <span className="text-[10px] font-bold text-amber-400 block mb-0.5">
                    {msg.senderName || 'Учасник'}
                  </span>
                )}
                <p>{msg.text}</p>

                {isInspected && (
                  <div className={`mt-1.5 pt-1.5 border-t text-[9px] font-mono break-all leading-tight ${
                    msg.isMe ? 'border-neutral-950/20 text-neutral-900' : 'border-neutral-800 text-neutral-400'
                  }`}>
                    <div className="flex items-center gap-1 font-bold mb-0.5">
                      <Lock className="w-2.5 h-2.5 text-emerald-500" />
                      Шифротекст у Firestore (E2EE):
                    </div>
                    <span>{msg.cipherPayload || `enc:v1:aes256:${btoa(encodeURIComponent(msg.text)).slice(0, 32)}...`}</span>
                  </div>
                )}

                <div
                  className={`text-[9px] text-right mt-0.5 flex items-center justify-end gap-1 ${
                    msg.isMe ? 'text-neutral-900/70 font-semibold' : 'text-neutral-400'
                  }`}
                >
                  <Lock className="w-2 h-2 text-emerald-500" title="Захищено наскрізним шифруванням" />
                  {msg.hasPendingWrites ? (
                    <span className="flex items-center gap-0.5 text-amber-900 font-bold" title="Збережено у локальному кеші IndexedDB (чекає на звʼязок для хмари)">
                      <Clock className="w-2 h-2 animate-spin" />
                      <span>В кеші</span>
                    </span>
                  ) : (
                    msg.isMe && <Check className="w-2.5 h-2.5" />
                  )}
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Live typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 text-neutral-400 text-xs pl-8">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[11px] italic">{chat.buddy.name} друкує тост...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Blocked Interlocutor Notice or Active Chat Input */}
      {isBlocked ? (
        <div className="p-4 bg-neutral-900/95 border-t border-red-500/30 text-center space-y-2 z-20 animate-in fade-in">
          <div className="text-red-400 text-xs font-bold flex items-center justify-center gap-1.5">
            <UserX className="w-4 h-4" />
            <span>Співрозмовника заблоковано</span>
          </div>
          <p className="text-[11px] text-neutral-400 max-w-[280px] mx-auto">
            Чат заморожено для вашої безпеки. {chat.buddy.name} не може надсилати вам повідомлення або бачити вас.
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition"
            >
              Повернутися до чатів
            </button>
            <button
              type="button"
              onClick={() => {
                safetyModerationService.unblockUser(chat.buddy.id);
                setIsBlocked(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white text-xs font-medium transition"
            >
              Розблокувати
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Action Pills (Локація, Тости, тощо) */}
          <div className="px-3 py-1.5 bg-neutral-900/50 border-t border-neutral-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              id="quick-toasts-btn"
              onClick={() => setShowToastsModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-semibold whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3" />
              <span>Обрати тост 🍻</span>
            </button>

            <button
              type="button"
              id="propose-location-btn"
              onClick={() => setShowLocationModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-[11px] font-medium whitespace-nowrap"
            >
              <MapPin className="w-3 h-3 text-rose-400" />
              <span>Запропонувати бар</span>
            </button>

            <button
              type="button"
              id="send-cheers-action"
              onClick={() => handleSendToast('Будьмо! 🍻')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-[11px] font-medium whitespace-nowrap"
            >
              <Beer className="w-3 h-3 text-amber-400" />
              <span>Келих пива</span>
            </button>
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSend}
            className="p-2.5 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2 z-20"
          >
            <input
              type="text"
              id="chat-message-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Напишіть повідомлення чи тост..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-neutral-100 placeholder-neutral-500 text-xs focus:outline-none focus:border-amber-400"
            />

            <button
              type="submit"
              id="chat-send-btn"
              disabled={!inputText.trim()}
              className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 flex items-center justify-center transition shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}

      {/* Rich Toasts Picker Modal */}
      <ToastModal
        isOpen={showToastsModal}
        onClose={() => setShowToastsModal(false)}
        onSelectToast={handleSendToast}
        title="Виберіть тост до келиха 🍻"
        allowCustom={true}
      />

      {/* Location Proposal Modal */}
      {showLocationModal && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm z-50 flex flex-col justify-end p-2">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400" />
                Запропонувати зустріч у закладі
              </h3>
              <button
                type="button"
                id="close-loc-modal-btn"
                onClick={() => setShowLocationModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-200 bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendLocationProposal} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Бар / Локація</label>
                <input
                  type="text"
                  id="proposal-bar-input"
                  value={proposalBar}
                  onChange={(e) => setProposalBar(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-400 mb-1">Час зустрічі</label>
                <input
                  type="text"
                  id="proposal-time-input"
                  value={proposalTime}
                  onChange={(e) => setProposalTime(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  id="cancel-proposal-btn"
                  onClick={() => setShowLocationModal(false)}
                  className="flex-1 py-2 rounded-xl bg-neutral-800 text-neutral-300 font-semibold text-xs"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  id="submit-proposal-btn"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition"
                >
                  Надіслати картку зустрічі
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security & Cryptography Inspector Modal */}
      <SecurityInspectionModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        chatId={chat.id}
        buddyName={chat.buddy.name}
      />

      {/* SOS Emergency Modal */}
      <SosEmergencyModal
        isOpen={showSosModal}
        onClose={() => setShowSosModal(false)}
        interlocutorId={chat.buddy.id}
        interlocutorName={chat.buddy.name}
        venueName={proposalBar}
        onInterlocutorBlocked={() => {
          setIsBlocked(true);
        }}
      />

      {/* Quick Report Modal */}
      <QuickReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetId={chat.buddy.id}
        targetType="chat"
        targetName={chat.buddy.name}
        targetAvatar={chat.buddy.avatar}
        onSuccess={(blocked) => {
          if (blocked) {
            setIsBlocked(true);
          }
        }}
      />

      {/* Delete Chat Confirmation Modal */}
      <DeleteChatConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        onConfirmDelete={() => {
          setShowDeleteConfirmModal(false);
          if (onDeleteChat) {
            onDeleteChat(chat.id);
          }
          onBack();
        }}
        chatTitle={chat.isGroup ? (chat.groupName || chat.buddy.name) : chat.buddy.name}
        isGroup={!!chat.isGroup}
      />

      {/* Group Info Modal */}
      {chat.isGroup && (
        <GroupInfoModal
          isOpen={showGroupInfoModal}
          onClose={() => setShowGroupInfoModal(false)}
          chat={chat}
          buddies={buddies}
          onAddParticipants={(newParticipants) => {
            if (onAddParticipants) {
              onAddParticipants(chat.id, newParticipants);
            }
          }}
          onDeleteGroup={() => {
            setShowGroupInfoModal(false);
            setShowDeleteConfirmModal(true);
          }}
        />
      )}
    </div>
  );
};
