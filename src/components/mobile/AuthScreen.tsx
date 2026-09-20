import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wine, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Ban, 
  Eye, 
  EyeOff,
  Calendar
} from 'lucide-react';
import { sounds } from '../../services/soundService';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types';
import { calculateAge, formatAgeWithUnit } from '../../utils/ageUtils';

interface AuthScreenProps {
  currentUser: AuthUser;
  onAuthSuccess: (user: AuthUser) => void;
  onBackToLaunch?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentUser,
  onAuthSuccess,
}) => {
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');

  // Email form state
  const [email, setEmail] = useState(currentUser.email || 'tepasha.90@gmail.com');
  const [password, setPassword] = useState('budmo2026pass');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [birthDate, setBirthDate] = useState('1998-05-15');

  const registeredAge = calculateAge(birthDate);

  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setStatusNotice('Авторизація через Google Identity Services...');

    try {
      const user = await authService.loginWithGoogle();
      sounds.playMatchCheer();
      setStatusNotice('Успішний вхід! Завантаження профілю...');
      setTimeout(() => {
        setIsLoading(false);
        setStatusNotice(null);
        onAuthSuccess(user);
      }, 500);
    } catch {
      setIsLoading(false);
      setStatusNotice(null);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setStatusNotice('Перевірка даних...');
    setTimeout(() => {
      setIsLoading(false);
      setStatusNotice(null);
      sounds.playClink();

      const user = authService.loginWithEmail(email, undefined, birthDate);
      onAuthSuccess(user);
    }, 600);
  };

  return (
    <div
      id="app-auth-screen"
      className="relative flex-1 w-full h-full bg-neutral-950 flex flex-col justify-between p-4 overflow-y-auto no-scrollbar select-none"
    >
      {/* Top Bar with Title */}
      <div className="flex items-center justify-center pt-1 pb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Wine className="w-3.5 h-3.5" />
          <span>Будьмо! Авторизація</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4 max-w-sm mx-auto w-full py-2">
        {/* Header Hero */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/20 to-yellow-400/10 border border-amber-500/30 p-2 shadow-lg mb-1">
            <Wine className="w-7 h-7 text-amber-400 transform -rotate-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Вхід до «Будьмо!»
          </h2>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
            Знаходь компанію для посиденьок, створюй спільні сходки та безпечно спілкуйся у зашифрованих чатах
          </p>
        </div>

        {/* Method Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs font-semibold">
          <button
            type="button"
            id="auth-tab-google"
            onClick={() => setAuthMethod('google')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              authMethod === 'google'
                ? 'bg-amber-500 text-neutral-950 shadow font-bold'
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
            id="auth-tab-email"
            onClick={() => setAuthMethod('email')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              authMethod === 'email'
                ? 'bg-amber-500 text-neutral-950 shadow font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email / Пароль</span>
          </button>
        </div>

        {/* Status Notification Toast */}
        <AnimatePresence>
          {statusNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-amber-950/80 border border-amber-500/40 rounded-xl p-2.5 text-center text-xs text-amber-200 flex items-center justify-center gap-2 font-medium"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>{statusNotice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab 1: Google Authentication */}
        {authMethod === 'google' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* Primary Google Login Button */}
            <button
              type="button"
              id="auth-screen-google-primary-btn"
              onClick={() => handleGoogleSignIn()}
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-sm shadow-md flex items-center justify-center gap-3 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
              </svg>
              <span>Увійти через Google</span>
            </button>

            {/* Info note */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-400 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-200 font-semibold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Identity Services (OAuth 2.0)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                Безпечний вхід без паролів. Ім'я, фото профілю та email синхронізуються автоматично.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Email Authentication */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-3 animate-in fade-in duration-200">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-300">Електронна пошта</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-300">Пароль</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-9 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isRegisterMode && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-neutral-300">Дата народження</label>
                  {registeredAge !== null && (
                    <span className="text-[10px] text-amber-400 font-semibold">
                      Вік: {formatAgeWithUnit(registeredAge)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={birthDate}
                    max={new Date().toISOString().split('T')[0]}
                    min="1920-01-01"
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-bold text-xs shadow transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isRegisterMode ? 'Зареєструватися' : 'Увійти за Email'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-[11px] text-neutral-400 hover:text-neutral-200 transition"
              >
                {isRegisterMode ? 'Вже маєте акаунт? Увійти' : 'Не маєте акаунту? Зареєструватися'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer Security Badges */}
      <div className="pt-3 pb-1 space-y-1.5 border-t border-neutral-900 text-center">
        <div className="flex items-center justify-center gap-3 text-[10px] text-neutral-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>E2EE Шифрування</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Ban className="w-3 h-3 text-rose-400" />
            <span>РФ заблоковано</span>
          </span>
          <span>•</span>
          <span className="text-neutral-400">Cloud Firestore</span>
        </div>
        <p className="text-[9px] text-neutral-500">
          Будьмо! v2.4.0 • Безпечний пошук компанії у закладах України 🇺🇦
        </p>
      </div>
    </div>
  );
};
