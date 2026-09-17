import React, { useState, useMemo } from 'react';
import { 
  Beer, 
  X, 
  Search, 
  Dices, 
  Copy, 
  Check, 
  Send
} from 'lucide-react';
import { 
  ALL_TOASTS, 
  TOAST_CATEGORIES, 
  ToastItem, 
  getRandomToast 
} from '../../data/toastsData';
import { sounds } from '../../services/soundService';

interface ToastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToast?: (toastText: string) => void;
  title?: string;
  allowCustom?: boolean;
}

export const ToastModal: React.FC<ToastModalProps> = ({
  isOpen,
  onClose,
  onSelectToast,
  title = 'Скринька тостів 🍻',
  allowCustom = true,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedToastId, setHighlightedToastId] = useState<string | null>(null);
  const [customToastText, setCustomToastText] = useState('');

  // Filtered toasts
  const filteredToasts = useMemo(() => {
    return ALL_TOASTS.filter((toast) => {
      const matchesCategory = selectedCategory === 'all' || toast.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        toast.text.toLowerCase().includes(q) || 
        toast.categoryLabel.toLowerCase().includes(q) ||
        toast.tags.some((t) => t.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleRollRandom = () => {
    sounds.playClink();
    const random = getRandomToast(
      selectedCategory === 'all' ? undefined : (selectedCategory as ToastItem['category'])
    );
    setHighlightedToastId(random.id);
    
    // Smooth scroll to the picked toast element
    setTimeout(() => {
      const el = document.getElementById(`toast-item-${random.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleCopyToast = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playMessageSent();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToastText.trim()) return;
    if (onSelectToast) {
      onSelectToast(customToastText.trim());
      setCustomToastText('');
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex flex-col justify-end p-2 animate-in fade-in duration-200">
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-4 shadow-2xl flex flex-col max-h-[85%] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Beer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                {title}
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {filteredToasts.length} тостів
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">Колоритні тости під будь-який настрій та компанію</p>
            </div>
          </div>

          <button
            type="button"
            id="close-toasts-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions: Random Button + Search Bar */}
        <div className="py-2.5 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="roll-random-toast-btn"
              onClick={handleRollRandom}
              className="px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0 active:scale-95"
            >
              <Dices className="w-4 h-4" />
              <span>🎲 Випадковий</span>
            </button>

            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                id="search-toasts-input"
                placeholder="Пошук тосту за словами..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {TOAST_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  id={`cat-toast-btn-${cat.id}`}
                  onClick={() => {
                    sounds.playClink();
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 shrink-0 ${
                    isSelected
                      ? 'bg-amber-500 text-neutral-950 shadow-sm shadow-amber-500/30'
                      : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toasts List */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-1 pr-0.5">
          {filteredToasts.length === 0 ? (
            <div className="text-center py-8 space-y-2 text-neutral-500 text-xs">
              <Beer className="w-8 h-8 mx-auto text-neutral-600 opacity-50" />
              <p>За вашим запитом тостів не знайдено.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="text-amber-400 underline text-xs"
              >
                Скинути фільтри
              </button>
            </div>
          ) : (
            filteredToasts.map((toast) => {
              const isHighlighted = highlightedToastId === toast.id;

              return (
                <div
                  key={toast.id}
                  id={`toast-item-${toast.id}`}
                  className={`p-3 rounded-2xl border transition relative group ${
                    isHighlighted
                      ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10'
                      : 'bg-neutral-950 border-neutral-800/80 hover:border-amber-500/40 hover:bg-neutral-900/60'
                  }`}
                >
                  {/* Category Pill & Tag */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1 bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
                      <span>{toast.emoji}</span>
                      <span>{toast.categoryLabel}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        id={`copy-toast-btn-${toast.id}`}
                        onClick={(e) => handleCopyToast(toast.text, toast.id, e)}
                        className="p-1 rounded-md text-neutral-400 hover:text-amber-300 hover:bg-neutral-800 transition"
                        title="Скопіювати текст"
                      >
                        {copiedId === toast.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {onSelectToast && (
                        <button
                          type="button"
                          id={`send-toast-btn-${toast.id}`}
                          onClick={() => {
                            onSelectToast(toast.text);
                            onClose();
                          }}
                          className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-neutral-950 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          <span>Дзинь!</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toast text */}
                  <p 
                    onClick={() => {
                      if (onSelectToast) {
                        onSelectToast(toast.text);
                        onClose();
                      }
                    }}
                    className="text-xs text-neutral-200 font-medium leading-relaxed italic cursor-pointer hover:text-amber-200 transition"
                  >
                    «{toast.text}»
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Custom Toast Input (Optional) */}
        {allowCustom && onSelectToast && (
          <form onSubmit={handleSendCustom} className="pt-3 border-t border-neutral-800 shrink-0 flex gap-2">
            <input
              type="text"
              id="custom-toast-input"
              value={customToastText}
              onChange={(e) => setCustomToastText(e.target.value)}
              placeholder="Або напишіть свій авторський тост..."
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!customToastText.trim()}
              id="send-custom-toast-btn"
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition disabled:opacity-40 flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Будьмо!</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
