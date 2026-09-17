import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Key, Database, X, Check, Copy, Sparkles } from 'lucide-react';
import { cryptoService } from '../../services/cryptoService';
import { sounds } from '../../services/soundService';

interface SecurityInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  buddyName: string;
}

export const SecurityInspectionModal: React.FC<SecurityInspectionModalProps> = ({
  isOpen,
  onClose,
  chatId,
  buddyName,
}) => {
  const [testInput, setTestInput] = useState('Секретний тост у барі 🍻');
  const [testCipher, setTestCipher] = useState('');
  const [copied, setCopied] = useState(false);

  const securityInfo = cryptoService.getRoomFingerprint(chatId);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    cryptoService.encryptMessage(testInput, chatId).then((cipher) => {
      if (isMounted) setTestCipher(cipher);
    });
    return () => {
      isMounted = false;
    };
  }, [testInput, chatId, isOpen]);

  if (!isOpen) return null;

  const handleCopyFingerprint = () => {
    sounds.playTap();
    navigator.clipboard?.writeText?.(securityInfo.fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-neutral-950/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-4 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                Наскрізне шифрування
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-normal border border-emerald-500/30">
                  E2EE
                </span>
              </h3>
              <p className="text-[10px] text-neutral-400">Діалог із {buddyName}</p>
            </div>
          </div>

          <button
            type="button"
            id="close-security-modal-btn"
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status card */}
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Алгоритм криптозахисту:
            </span>
            <span className="text-amber-300 font-mono font-bold">
              {securityInfo.algorithm} ({securityInfo.keyLength})
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              Відбиток ключа кімнати:
            </span>
            <button
              type="button"
              id="copy-fingerprint-btn"
              onClick={handleCopyFingerprint}
              className="text-white hover:text-amber-300 font-mono text-[10px] bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700 flex items-center gap-1 transition"
              title="Скопіювати відбиток безпеки"
            >
              {securityInfo.fingerprint}
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              Cloud Firestore DB:
            </span>
            <span className="text-sky-300 font-mono text-[10px]">
              ai-studio-df109a92...
            </span>
          </div>
        </div>

        {/* Interactive encryption demonstration */}
        <div className="bg-neutral-950/90 border border-neutral-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-neutral-200">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Живий тест шифрування:
            </span>
            <span className="text-[10px] text-emerald-400 font-normal">Захищено на клієнті</span>
          </div>

          <div>
            <label className="block text-[10px] text-neutral-400 mb-1">
              Введіть тестовий текст для шифрування:
            </label>
            <input
              type="text"
              id="test-crypto-input"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              placeholder="Введіть фразу..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
              <span>Вигляд у Cloud Firestore (Шифротекст):</span>
              <span className="text-amber-400/90 font-mono text-[9px]">Нерозбірливі байти</span>
            </div>
            <div className="bg-black/60 border border-neutral-800 rounded-xl p-2 font-mono text-[9px] text-neutral-400 break-all leading-tight max-h-16 overflow-y-auto no-scrollbar">
              {testCipher || 'Генерація шифру...'}
            </div>
          </div>
        </div>

        {/* Explanatory bullet points */}
        <div className="text-[10px] text-neutral-400 space-y-1.5 bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-800/60">
          <p className="flex items-start gap-1.5">
            <span className="text-emerald-400 font-bold">•</span>
            <span>Ключ шифрування деривується на вашому пристрої за допомогою <strong>PBKDF2 SHA-256</strong>.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-emerald-400 font-bold">•</span>
            <span>Кожне повідомлення має унікальний криптографічний <strong>вектор ініціалізації (IV)</strong>.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <span className="text-emerald-400 font-bold">•</span>
            <span>Хмарна база бачить лише зашифрований шифротекст, гарантуючи конфіденційність переписки.</span>
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          id="accept-security-info-btn"
          onClick={onClose}
          className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs transition active:scale-98"
        >
          Зрозуміло, чат захищено
        </button>
      </div>
    </div>
  );
};
