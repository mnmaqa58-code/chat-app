import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';

interface CallModalProps {
  partner: User;
  type: 'voice' | 'video';
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ partner, type, onClose }) => {
  const { t } = useApp();
  const [status, setStatus] = useState<'calling' | 'connected'>('calling');
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'voice');
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Local camera preview for video calls (stops as soon as the camera is switched off or the call ends)
  useEffect(() => {
    if (isVideoOff) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError(true);
          setIsVideoOff(true);
        }
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [isVideoOff]);

  useEffect(() => {
    const connectTimer = setTimeout(() => {
      setStatus('connected');
    }, 2200);

    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (status === 'connected') {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-[var(--s-092218)] border border-emerald-800/60 p-6 flex flex-col items-center shadow-2xl text-center overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mb-5 mt-2">
          <div className="relative">
            <img
              src={partner.avatarUrl}
              alt={partner.displayName}
              className="w-24 h-24 rounded-full object-cover border-2 border-emerald-400/80 shadow-lg"
              referrerPolicy="no-referrer"
            />
            {status === 'calling' && (
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-60" />
            )}
          </div>
          <span className="absolute bottom-1 right-1 text-base">{partner.country.flag}</span>
        </div>

        <h3 className="text-lg font-semibold text-white tracking-tight">{partner.displayName}</h3>
        <p className="text-xs text-emerald-300/70 mt-0.5">@{partner.username}</p>

        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-850 text-xs font-medium text-emerald-300">
          <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-bounce'}`} />
          <span>{status === 'connected' ? formatDuration(seconds) : t.chats.calling}</span>
        </div>

        {/* Ambient simulated audio wave */}
        {status === 'connected' && (
          <div className="flex items-center gap-1 my-6 h-6">
            {[40, 70, 95, 60, 80, 50, 90, 65, 45].map((height, i) => (
              <span
                key={i}
                className="w-1 bg-emerald-400/80 rounded-full animate-pulse"
                style={{
                  height: `${height}%`,
                  animationDelay: `${i * 120}ms`,
                  animationDuration: '900ms',
                }}
              />
            ))}
          </div>
        )}

        {status === 'calling' && <div className="h-6 my-6 text-xs text-emerald-400/70">{t.extra.connectingAudio}</div>}

        {!isVideoOff && (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-32 h-24 rounded-xl object-cover border border-emerald-700/60 mb-3 -scale-x-100"
          />
        )}
        {cameraError && <p className="text-xs text-red-300 mb-3">{t.extra.noCameraAccess}</p>}

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 mt-2 w-full pt-4 border-t border-emerald-900/50">
          <button
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={onClose}
            aria-label="End call"
            className="min-h-[52px] min-w-[52px] rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-950 transition-transform active:scale-95 cursor-pointer"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            aria-label={isVideoOff ? 'Enable camera' : 'Disable camera'}
            className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isVideoOff ? 'bg-emerald-900/40 text-emerald-400/50 border border-emerald-900/50' : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
