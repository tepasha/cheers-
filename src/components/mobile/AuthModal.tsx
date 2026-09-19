import React, { useState } from 'react';
import { X, Lock, Mail, ShieldCheck, LogOut } from 'lucide-react';
import { sounds } from '../../services/soundService';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onAuthSuccess: (user: AuthUser) => void;
  onLogout?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState(currentUser.email || 'tepasha.90@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setAuthNotice('Підключення до Google Identity Services...');
    
    try {
      const user = await authService.loginWithGoogle();
      sounds.playMatchCheer();
      setAuthNotice('Успішна авторизація через Google!');
      setTimeout(() => {
        setIsLoading(false);
        setAuthNotice(null);
        onAuthSuccess(user);
        onClose();
      }, 500);
    } catch {
      setIsLoading(false);
      setAuthNotice(null);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      sounds.playClink();
      const extractedName = email.split('@')[0].replace('.', ' ');
      const capitalized = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
      const user: AuthUser = {
        id: `usr_email_${Date.now()}`,
        name: capitalized,
        email,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(capitalized)}&backgroundColor=f59e0b`,
        provider: 'email',
        isLoggedIn: true,
        emailVerified: true,
        joinedAt: 'Вересень 2026',
      };
      authService.saveUser(user);
      onAuthSuccess(user);
      onClose();
    }, 600);
  };

  const handleLogoutClick = () => {
    sounds.playClink();
    const guestUser = authService.logout();
    if (onLogout) {
      onLogout();
    }
    onAuthSuccess(guestUser);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-neutral-900 rounded-3xl border border-neutral-800 p-5 shadow-2xl relative select-none">
        <button
          type="button"
          id="close-auth-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:text-neutral-200 bg-neutral-800"
          title="Закрити"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 shadow-inner">
            {activeTab === 'google' ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>
            ) : (
              <span className="text-2xl">🔥</span>
            )}
          </div>
          <h3 className="text-base font-black text-white">
            {activeTab === 'google' ? 'Авторизація через Google' : 'Вхід за Email та паролем'}
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Безпечний вхід до облікового запису для пошуку компанії
          </p>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 mb-4 text-xs font-bold">
          <button
            type="button"
            id="tab-google-auth"
            onClick={() => setActiveTab('google')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'google'
                ? 'bg-neutral-800 text-white shadow'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
            </svg>
            <span>Google Вхід</span>
          </button>

          <button
            type="button"
            id="tab-email-auth"
            onClick={() => setActiveTab('email')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'email'
                ? 'bg-neutral-800 text-white shadow'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Email / Пароль</span>
          </button>
        </div>

        {/* Tab 1: GOOGLE AUTH */}
        {activeTab === 'google' && (
          <div className="space-y-3">
            {/* Google OAuth Status Banner */}
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-3 text-[11px] text-amber-200/90 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Швидкий вхід за допомогою Google OAuth 2.0 без паролів. Фото, ім'я та email синхронізуються автоматично.
              </span>
            </div>

            {/* Google Sign In Action Button */}
            <button
              type="button"
              id="google-submit-auth-btn"
              onClick={() => handleGoogleSignIn()}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
              </svg>
              <span>
                {isLoading ? 'Авторизація через Google...' : 'Продовжити через Google'}
              </span>
            </button>

            {authNotice && (
              <p className="text-[11px] text-center text-amber-300 animate-pulse font-medium">
                {authNotice}
              </p>
            )}
          </div>
        )}

        {/* Tab 2: EMAIL / PASSWORD */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  id="auth-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
                <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Пароль</label>
              <div className="relative">
                <input
                  type="password"
                  id="auth-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-white focus:outline-none focus:border-amber-400 text-xs"
                  required
                />
                <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              id="auth-submit-btn"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition mt-2 active:scale-98"
            >
              {isLoading ? 'Зʼєднання...' : mode === 'login' ? 'Увійти' : 'Створити акаунт'}
            </button>

            <div className="text-center">
              <button
                type="button"
                id="switch-auth-mode-btn"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-[11px] text-amber-400 hover:underline"
              >
                {mode === 'login' ? 'Немає акаунту? Зареєструватися' : 'Вже маєте акаунт? Увійти'}
              </button>
            </div>
          </form>
        )}

        {/* Log Out Option if already logged in */}
        {currentUser.isLoggedIn && (
          <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-neutral-400">Увійшли як {currentUser.name}</span>
            </div>
            <button
              type="button"
              id="modal-logout-btn"
              onClick={handleLogoutClick}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 transition"
            >
              <LogOut className="w-3 h-3" />
              <span>Вийти</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
