import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Lock, Check, Clock, Mic, Volume2 } from 'lucide-react';
import { Message } from '../../types';

interface AudioMessageBubbleProps {
  message: Message;
  isMe: boolean;
  isInspected: boolean;
  onToggleInspect: () => void;
}

export const AudioMessageBubble: React.FC<AudioMessageBubbleProps> = ({
  message,
  isMe,
  isInspected,
  onToggleInspect,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(message.audioDuration || 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, [message.audioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackRate;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio playback error:', err);
        setIsPlaying(false);
      });
    }
  };

  const handleSpeedChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = progress * (duration || audio.duration || 1);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  // Pseudo waveform bars (20 bars) based on message id hash
  const barHeights = React.useMemo(() => {
    const seed = (message.id || 'voice').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Array.from({ length: 22 }).map((_, i) => {
      const val = Math.sin((seed + i * 13) * 0.4) * 0.5 + 0.5;
      return Math.floor(val * 16) + 6; // between 6px and 22px
    });
  }, [message.id]);

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      onClick={onToggleInspect}
      className={`rounded-2xl p-3 shadow-md max-w-[85%] transition cursor-pointer ${
        isMe
          ? 'bg-amber-500 text-neutral-950 rounded-br-none hover:brightness-105'
          : 'bg-neutral-900 text-neutral-100 border border-neutral-800 rounded-bl-none hover:border-neutral-700'
      }`}
    >
      {/* Audio element */}
      {message.audioUrl && (
        <audio ref={audioRef} src={message.audioUrl} preload="metadata" />
      )}

      {/* Header Info */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center ${
              isMe ? 'bg-neutral-950/15 text-neutral-950' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <Mic className="w-3 h-3" />
          </div>
          <span
            className={`text-[11px] font-bold tracking-tight ${
              isMe ? 'text-neutral-950' : 'text-amber-300'
            }`}
          >
            Голосове повідомлення
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSpeedChange}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition ${
              isMe
                ? 'bg-neutral-950/15 hover:bg-neutral-950/25 text-neutral-950'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
            title="Швидкість відтворення"
          >
            {playbackRate}x
          </button>
          <Lock
            className={`w-2.5 h-2.5 ${isMe ? 'text-neutral-950/60' : 'text-emerald-400'}`}
            title="Захищено наскрізним шифруванням"
          />
        </div>
      </div>

      {/* Player Controls & Waveform */}
      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow transition active:scale-95 ${
            isMe
              ? 'bg-neutral-950 hover:bg-neutral-900 text-amber-400'
              : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
          }`}
          title={isPlaying ? 'Пауза' : 'Слухати'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform & Scrubber */}
        <div className="flex-1 space-y-1">
          <div
            onClick={handleSeek}
            className="h-7 flex items-center gap-[2.5px] cursor-pointer relative py-1"
            title="Перемотати аудіо"
          >
            {barHeights.map((h, idx) => {
              const barPercent = (idx / barHeights.length) * 100;
              const isPlayed = barPercent <= currentPercent;
              return (
                <div
                  key={idx}
                  style={{ height: `${h}px` }}
                  className={`flex-1 rounded-full transition-all duration-75 ${
                    isMe
                      ? isPlayed
                        ? 'bg-neutral-950'
                        : 'bg-neutral-950/30'
                      : isPlayed
                        ? 'bg-amber-400'
                        : 'bg-neutral-700'
                  }`}
                />
              );
            })}
          </div>

          {/* Time & status */}
          <div
            className={`flex items-center justify-between text-[10px] font-mono leading-none ${
              isMe ? 'text-neutral-950/80 font-medium' : 'text-neutral-400'
            }`}
          >
            <span>
              {isPlaying ? formatSeconds(currentTime) : formatSeconds(duration)}
            </span>
            <div className="flex items-center gap-1">
              <Volume2 className="w-2.5 h-2.5 opacity-60" />
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inspected Details */}
      {isInspected && (
        <div
          className={`mt-2.5 pt-2 border-t text-[9px] font-mono break-all leading-tight ${
            isMe ? 'border-neutral-950/20 text-neutral-950' : 'border-neutral-800 text-neutral-400'
          }`}
        >
          <div className="flex items-center gap-1 font-bold mb-0.5">
            <Lock className="w-2.5 h-2.5 text-emerald-500" />
            Захист аудіоповідомлення у Firestore:
          </div>
          <div>Аудіопотік: base64/audio-container ({message.audioDuration || 0} сек)</div>
          <div>Шифротекст метаданих: {message.cipherPayload || 'aes-256-gcm-encrypted'}</div>
        </div>
      )}

      {/* Footer / Timestamp */}
      <div
        className={`text-[9px] text-right mt-1.5 flex items-center justify-end gap-1 ${
          isMe ? 'text-neutral-950/70 font-semibold' : 'text-neutral-400'
        }`}
      >
        {message.hasPendingWrites ? (
          <span
            className="flex items-center gap-0.5 font-bold"
            title="Збережено у локальному кеші IndexedDB"
          >
            <Clock className="w-2 h-2 animate-spin" />
            <span>В кеші</span>
          </span>
        ) : (
          isMe && <Check className="w-2.5 h-2.5" />
        )}
        <span>{message.timestamp}</span>
      </div>
    </div>
  );
};
