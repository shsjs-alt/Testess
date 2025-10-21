// components/video-player.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, Settings, PictureInPicture, X, Download, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import Image from 'next/image';


type StreamSource = {
  url: string;
  name: string; // Ex: "HD", "1080p"
  thumbnailUrl?: string;
}

type VideoPlayerProps = {
  sources: StreamSource[]
  title: string
  downloadUrl?: string
  onClose?: () => void
  rememberPositionKey?: string
  rememberPosition?: boolean
  hasNextEpisode?: boolean
  onNextEpisode?: () => void
  backdropPath?: string | null;
}

// Componente de Overlay inicial
const PlayerOverlay = ({ onPlay }: { onPlay: () => void }) => (
  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 cursor-pointer" onClick={onPlay}>
    <Button
      className="relative z-20 h-20 w-20 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center group pointer-events-none"
      aria-label="Assistir"
    >
      <Play className="h-10 w-10 text-white group-hover:scale-110 transition-transform fill-white" />
    </Button>
  </div>
);


export default function VideoPlayer({
  sources,
  title,
  downloadUrl,
  onClose,
  rememberPositionKey,
  rememberPosition = true,
  hasNextEpisode,
  onNextEpisode,
  backdropPath,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement & { webkitEnterFullscreen?: () => void }>(null)
  const thumbnailVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null)
  const progressWrapRef = useRef<HTMLDivElement>(null)
  
  const [isSandboxed, setIsSandboxed] = useState(false);
  const [adBlockerDetected, setAdBlockerDetected] = useState(false);
  const [checking, setChecking] = useState(true);

  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [currentSource, setCurrentSource] = useState(sources[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [pipSupported, setPipSupported] = useState(false)
  const [isPipActive, setIsPipActive] = useState(false)

  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [showSeekHint, setShowSeekHint] = useState<null | { dir: "fwd" | "back"; by: number }>(null)
  const [showSpeedHint, setShowSpeedHint] = useState(false)
  const [showContinueWatching, setShowContinueWatching] = useState(false)
  
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(true)
  const [showNextEpisodeOverlay, setShowNextEpisodeOverlay] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [endingTriggered, setEndingTriggered] = useState(false);
  
  const [settingsMenu, setSettingsMenu] = useState<'main' | 'quality' | 'playbackRate'>('main');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);

  const volumeKey = "video-player-volume"
  const autoplayKey = "video-player-autoplay-enabled"
  const positionKey = `video-pos:${rememberPositionKey || sources[0].url}`
  
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTapRef = useRef<{ time: number, side: 'left' | 'right' | 'center' }>({ time: 0, side: 'center' });
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const originalRateRef = useRef<number>(1)
  const spacebarDownTimer = useRef<NodeJS.Timeout | null>(null);
  const isSpeedingUpRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const adUrl = "https://otieu.com/4/10070814";
  const adInterval = 2 * 60 * 1000; // 2 minutos
  const lastAdTimeRef = useRef<number | null>(null);


  useEffect(() => {
    if (typeof window === 'undefined') {
      setChecking(false);
      return;
    }
    
    if (window.self !== window.top) {
      setIsSandboxed(true);
      setChecking(false);
      return;
    }

    const adBlockerCheck = () => {
      const bait = document.createElement('div');
      bait.innerHTML = '&nbsp;';
      bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad text-ads text-ad-text ad-text ad-banner';
      bait.setAttribute('aria-hidden', 'true');
      bait.style.position = 'absolute';
      bait.style.top = '-9999px';
      bait.style.left = '-9999px';
      bait.style.width = '1px';
      bait.style.height = '1px';
      document.body.appendChild(bait);

      requestAnimationFrame(() => {
         if (bait.offsetHeight === 0 || window.getComputedStyle(bait).display === 'none' || window.getComputedStyle(bait).visibility === 'hidden') {
             setAdBlockerDetected(true);
         }
         document.body.removeChild(bait);
         setChecking(false);
      });
    };

    setTimeout(adBlockerCheck, 100);
  }, []);

  const triggerAd = useCallback(() => {
    window.open(adUrl, "_blank");
    lastAdTimeRef.current = Date.now();
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [adUrl]);
  
  const handleInitialPlay = () => {
    triggerAd();
    setIsPlayerActive(true);
  };
  
  const handlePlayerAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-controls]')) return;
  
    if (lastAdTimeRef.current && Date.now() - lastAdTimeRef.current > adInterval) {
      triggerAd();
    } else {
      togglePlay();
    }
  };
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource?.url || !isPlayerActive) return;

    const savedTime = video.currentTime > 1 ? video.currentTime : 0;
    
    video.src = currentSource.url;
    
    const handleCanPlay = () => {
      if (video.currentTime < savedTime) {
        video.currentTime = savedTime;
      }
      video.play().catch(handleError);
    };
    
    video.addEventListener('canplay', handleCanPlay);

    setEndingTriggered(false);
    setShowNextEpisodeOverlay(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      if(video) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [currentSource, isPlayerActive]);

  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem(volumeKey)
      if (savedVolume) {
        const v = Number.parseFloat(savedVolume)
        setVolume(v)
        if (videoRef.current) videoRef.current.volume = v
      }
      
      const savedAutoplay = localStorage.getItem(autoplayKey);
      if (savedAutoplay !== null) {
        setIsAutoplayEnabled(JSON.parse(savedAutoplay));
      }

      if (rememberPosition) {
        const savedPos = localStorage.getItem(positionKey)
        if (savedPos) {
          const n = Number.parseFloat(savedPos)
          if (!Number.isNaN(n) && n > 5) {
            setShowContinueWatching(true)
          }
        }
      }
    } catch (e) { /* no-op */ }
  }, [positionKey, rememberPosition])

  useEffect(() => {
    if (!rememberPosition || !isPlayerActive) return
    const id = setInterval(() => {
      try {
        if (videoRef.current && videoRef.current.currentTime > 0) {
          localStorage.setItem(positionKey, String(videoRef.current.currentTime || 0))
        }
      } catch (e) { /* no-op */ }
    }, 1500)
    return () => clearInterval(id)
  }, [positionKey, rememberPosition, isPlayerActive])

  useEffect(() => {
    setPipSupported(typeof document !== "undefined" && "pictureInPictureEnabled" in document)
  }, [])
  
  const hideControls = useCallback(() => {
    setShowControls(false);
  }, []);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(hideControls, 3500);
  }, [hideControls]);

  useEffect(() => {
    if (!isPlayerActive) return;
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", resetControlsTimeout);
      container.addEventListener("mouseleave", hideControls);
      container.addEventListener("touchstart", resetControlsTimeout, { passive: true });
    }
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (container) {
        container.removeEventListener("mousemove", resetControlsTimeout);
        container.removeEventListener("mouseleave", hideControls);
        container.removeEventListener("touchstart", resetControlsTimeout);
      }
    };
  }, [isPlayerActive, resetControlsTimeout, hideControls]);
  
  useEffect(() => {
    if (!isSettingsOpen) {
      const timer = setTimeout(() => setSettingsMenu('main'), 150); 
      return () => clearTimeout(timer);
    }
  }, [isSettingsOpen]);


  const triggerNextEpisodeOverlay = useCallback(() => {
    if (endingTriggered || !isAutoplayEnabled || !hasNextEpisode || !onNextEpisode) return;
    setEndingTriggered(true);
    setShowNextEpisodeOverlay(true);
    setCountdown(5);
  }, [endingTriggered, isAutoplayEnabled, hasNextEpisode, onNextEpisode]);


  const handleLoadStart = () => {
    if (!isPlayerActive) return;
    setIsLoading(true)
    setError(null)
  }
  const handleCanPlay = () => {
    setIsLoading(false)
    setIsBuffering(false)
    const v = videoRef.current;
    if (v && showContinueWatching && rememberPosition) {
        const savedPos = localStorage.getItem(positionKey)
        const n = Number.parseFloat(savedPos || '0');
        if (!Number.isNaN(n) && n > 5) {
            v.currentTime = n;
        }
    }
  }
  
  const handleError = () => {
    setIsLoading(false)
    setIsBuffering(false)
    setError("Não foi possível carregar o vídeo.")
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    setCurrentTime(currentTime);
    if (duration > 0 && duration - currentTime < 10 && !endingTriggered) {
      triggerNextEpisodeOverlay();
    }
    try {
      const buf = videoRef.current.buffered;
      if (buf && buf.length > 0) { setBufferedEnd(buf.end(buf.length - 1)); }
    } catch {}
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration || 0)
  }

  const handleEnded = () => {
    triggerNextEpisodeOverlay();
    setIsPlaying(false)
  };

  const handlePlayNext = useCallback(() => {
    setShowNextEpisodeOverlay(false);
    onNextEpisode?.();
  }, [onNextEpisode]);

  const handleCancelAutoplay = () => {
    setShowNextEpisodeOverlay(false);
    setShowControls(true)
    if (videoRef.current) {
      videoRef.current.currentTime = videoRef.current.duration;
    }
  };
  
  useEffect(() => {
    if (showNextEpisodeOverlay) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            handlePlayNext();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); } };
  }, [showNextEpisodeOverlay, handlePlayNext]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
        v.play().catch(() => handleError());
    } else {
        v.pause();
    }
  }, []);

  const seek = useCallback((amount: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.min(Math.max(0, v.currentTime + amount), duration || v.duration || 0)
    setShowSeekHint({ dir: amount > 0 ? "fwd" : "back", by: Math.abs(amount) })
    setTimeout(() => setShowSeekHint(null), 700)
  }, [duration])

  const handleSeekSlider = (value: number[]) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = value[0]
    setCurrentTime(value[0])
  }

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const newMuted = !v.muted
    v.muted = newMuted
    setIsMuted(newMuted)
    if (!newMuted && v.volume === 0) {
      v.volume = 0.5
      setVolume(0.5)
    }
  }, [])

  const handleVolumeChange = (value: number[]) => {
    const v = videoRef.current
    if (!v) return
    const newVolume = value[0]
    v.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    try { localStorage.setItem(volumeKey, String(newVolume)) } catch { }
  }

  const handleVolumeMouseEnter = () => {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    setIsVolumeOpen(true);
  };
  
  const handleVolumeMouseLeave = () => {
    volumeTimeoutRef.current = setTimeout(() => {
        setIsVolumeOpen(false);
    }, 1500);
  };

  const toggleFullscreen = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Fallback para iOS
    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        // ✅ CORREÇÃO 1: Adicionado try...catch para ignorar o erro em desktops.
        try {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            await screen.orientation.lock('landscape');
          }
        } catch (e) {
          console.warn("Falha ao travar a orientação de tela:", e);
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Erro ao gerenciar fullscreen:", err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        // ✅ CORREÇÃO 1: Adicionado try...catch para ignorar o erro em desktops.
        try {
          if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            screen.orientation.unlock();
          }
        } catch (e) {
          console.warn("Falha ao destravar a orientação de tela:", e);
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return
    videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
    setSettingsMenu('main');
  }
  
  const changeQuality = (source: StreamSource) => {
      if(currentSource.url !== source.url){ setCurrentSource(source); }
      setSettingsMenu('main');
  }

  const toggleAutoplay = () => {
    setIsAutoplayEnabled(prev => {
      const newState = !prev;
      try { localStorage.setItem(autoplayKey, JSON.stringify(newState)); } catch (e) { /* no-op */ }
      return newState;
    });
  };

  const togglePip = useCallback(async () => {
    const v = videoRef.current
    if (!v || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) { await (document as any).exitPictureInPicture() } 
      else { await (v as any).requestPictureInPicture() }
    } catch (e) { console.error("Erro no PIP", e) }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onEnterPip = () => setIsPipActive(true)
    const onLeavePip = () => setIsPipActive(false)
    v.addEventListener("enterpictureinpicture", onEnterPip as any)
    v.addEventListener("leavepictureinpicture", onLeavePip as any)
    return () => {
      v.removeEventListener("enterpictureinpicture", onEnterPip as any)
      v.removeEventListener("leavepictureinpicture", onLeavePip as any)
    }
  }, [])

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) return "00:00"
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    const mm = String(minutes).padStart(2, "0")
    const ss = String(seconds).padStart(2, "0")
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
  }

  const retry = () => {
    setError(null);
    setIsLoading(true);
    const video = videoRef.current;
    if (video) {
        const url = new URL(currentSource.url);
        url.searchParams.set('retry_timestamp', Date.now().toString());
        const newSrc = url.toString();
        
        video.src = ''; 
        video.load();
        setTimeout(() => {
            video.src = newSrc;
            video.load();
            video.play().catch(e => {
              console.warn("Retry play failed", e)
              handleError();
            });
        }, 100);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPlayerActive) return;
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.getAttribute("role") === "slider")) return;
  
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        if (isSpeedingUpRef.current) return;
        spacebarDownTimer.current = setTimeout(() => {
          if (videoRef.current && isPlaying) {
            isSpeedingUpRef.current = true;
            originalRateRef.current = videoRef.current.playbackRate;
            videoRef.current.playbackRate = 2.0;
            setPlaybackRate(2.0);
            setShowSpeedHint(true);
          }
        }, 200);
      }
  
      switch (e.key.toLowerCase()) {
        case "k": e.preventDefault(); togglePlay(); break;
        case "f": toggleFullscreen(); break;
        case "m": toggleMute(); break;
        case "p": togglePip(); break;
        case "arrowright": seek(10); break;
        case "arrowleft": seek(-10); break;
        case "arrowup": e.preventDefault(); handleVolumeChange([Math.min(1, volume + 0.1)]); break;
        case "arrowdown": e.preventDefault(); handleVolumeChange([Math.max(0, volume - 0.1)]); break;
      }
    };
  
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isPlayerActive) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (spacebarDownTimer.current) {
          clearTimeout(spacebarDownTimer.current);
          spacebarDownTimer.current = null;
          if (!isSpeedingUpRef.current) { togglePlay(); }
        }
        if (isSpeedingUpRef.current) {
          if (videoRef.current) { videoRef.current.playbackRate = originalRateRef.current; }
          setPlaybackRate(originalRateRef.current);
          setShowSpeedHint(false);
          isSpeedingUpRef.current = false;
        }
      }
    };
  
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (spacebarDownTimer.current) clearTimeout(spacebarDownTimer.current);
    };
  }, [isPlayerActive, volume, togglePlay, toggleFullscreen, toggleMute, togglePip, seek, isPlaying]);

  const onProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !progressWrapRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const time = duration * pct;
    setHoverTime(time);
    if (thumbnailVideoRef.current && currentSource.thumbnailUrl && thumbnailVideoRef.current.readyState > 2) {
      thumbnailVideoRef.current.currentTime = time;
    }
  };

  const onProgressLeave = () => {
    setHoverTime(null);
  };

  const onMobileTap = (side: 'left' | 'right' | 'center') => {
    if (!isPlayerActive) return;
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current.time < 350 && lastTapRef.current.side === side;
    
    if (isDoubleTap) {
        if (side === 'left') seek(-10);
        else if (side === 'right') seek(10);
        else togglePlay();
        lastTapRef.current = { time: 0, side: 'center' };
    } else {
        if(side === 'center') {
            setShowControls(s => !s);
            if(showControls) {
                if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
            } else {
                resetControlsTimeout();
            }
        }
        lastTapRef.current = { time: now, side };
    }
  };

  const handleTouchStart = () => {
    if (!isPlayerActive) return;
    holdTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && isPlaying) {
        originalRateRef.current = videoRef.current.playbackRate
        videoRef.current.playbackRate = 2
        setShowSpeedHint(true)
      }
    }, 500)
  }

  const handleTouchEnd = () => {
    if (!isPlayerActive) return;
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    if (videoRef.current && videoRef.current.playbackRate === 2) {
      videoRef.current.playbackRate = originalRateRef.current
      setShowSpeedHint(false)
    }
  }

  const handleContinue = () => {
    setShowContinueWatching(false)
    if (videoRef.current) {
      videoRef.current.play()
    }
  }

  const handleRestart = () => {
    setShowContinueWatching(false)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play()
    }
  }

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  const hoverLeft =
    hoverTime !== null && duration > 0 && progressWrapRef.current
      ? Math.min(1, Math.max(0, hoverTime / duration)) * (progressWrapRef.current.clientWidth || 0)
      : 0
  
  const bufferPercentage = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  
  const currentSpeedLabel = playbackRate === 1 ? "Normal" : `${playbackRate}x`;

  if (checking) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (isSandboxed) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center text-center p-6 text-white">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
        <p className="max-w-md text-zinc-300">Precisamos dos anúncios para continuar, sem eles nós não temos dinheiro para pagar a hospedagem da API, remova o player do sandbox, por favor!.</p>
      </div>
    );
  }

  if (adBlockerDetected) {
    return (
       <div className="w-full h-full bg-black flex flex-col items-center justify-center text-center p-6 text-white">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">AdBlock Detectado</h2>
        <p className="max-w-md text-zinc-300">Detectamos um bloqueador de anúncios. Por favor, desative-o para este site para reproduzir o vídeo e nos ajudar a manter o serviço gratuito.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={containerRef}
        className={cn(
          "fixed inset-0 w-full h-full bg-black overflow-hidden group select-none video-player-container",
          isPlaying && !showControls && !showNextEpisodeOverlay && isPlayerActive && "cursor-none"
        )}
        onDoubleClick={e => e.preventDefault()}
        style={{ transform: 'translateZ(0)' }}
      >
        {backdropPath && (
            <Image
                src={`https://image.tmdb.org/t/p/w1280${backdropPath}`}
                alt={title}
                layout="fill"
                objectFit="cover"
                className="absolute inset-0 opacity-40 blur-sm"
                priority
            />
        )}
        <video
          ref={videoRef}
          className={cn(
            "h-full w-full object-contain transition-opacity",
            isPlayerActive ? "opacity-100" : "opacity-0"
          )}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onPlaying={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onError={handleError}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleEnded}
          preload="metadata"
          playsInline
        />
        <div
            className="absolute inset-0 z-10"
            onClick={handlePlayerAreaClick}
        />
         {currentSource.thumbnailUrl && (
          <video
            ref={thumbnailVideoRef}
            src={currentSource.thumbnailUrl}
            className="pointer-events-none absolute bottom-0 left-0 opacity-0"
            preload="auto"
            muted
            playsInline
            crossOrigin="anonymous"
          />
        )}
        
        {(isLoading || isBuffering) && isPlayerActive && (
          <div 
            style={{ transform: 'translateZ(0)' }} 
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        )}

        {error && (
          <div 
            style={{ transform: 'translateZ(0)' }} 
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-4"
          >
            <div className="text-center text-white">
              <p className="mb-4 text-sm text-zinc-200">{error}</p>
              <div className="flex items-center justify-center gap-2">
                <Button onClick={retry} variant="secondary" className="h-9">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Tentar Novamente
                </Button>
                {onClose && (
                  <Button onClick={onClose} variant="outline" className="h-9">
                    Fechar
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        
        <AnimatePresence>
          {!isPlayerActive && !error && <PlayerOverlay onPlay={handleInitialPlay} />}
        </AnimatePresence>

        {showContinueWatching && isPlayerActive && (
          <div
            style={{ transform: 'translateZ(0)' }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70"
          >
            <p className="text-white text-lg mb-4">Continuar de onde parou?</p>
            <div className="flex gap-4">
              <Button onClick={handleContinue} className="bg-white text-black">Sim</Button>
              <Button onClick={handleRestart} variant="secondary">Reiniciar</Button>
            </div>
          </div>
        )}

        {showSeekHint && isPlayerActive && (
          <div 
            style={{ transform: 'translateZ(0)' }} 
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <div className="rounded-full bg-black/60 px-3 py-1 text-sm text-white ring-1 ring-white/10">
              {showSeekHint.dir === "fwd" ? `+${showSeekHint.by}s` : `-${showSeekHint.by}s`}
            </div>
          </div>
        )}

        <AnimatePresence>
          {showSpeedHint && isPlayerActive && (
            <motion.div
              style={{ transform: 'translateZ(0)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            >
              <div className="rounded-full bg-black/60 px-4 py-2 text-lg font-bold text-white ring-1 ring-white/10">
                2x
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showNextEpisodeOverlay && isPlayerActive && (
            <motion.div
              style={{ transform: 'translateZ(0)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90"
            >
              <p className="text-white text-lg mb-6 font-semibold">
                Próximo episódio em {countdown}
              </p>
              <div className="flex gap-4">
                <Button onClick={handlePlayNext} className="bg-white text-black hover:bg-zinc-200">Assistir</Button>
                <Button onClick={handleCancelAutoplay} variant="secondary">Cancelar</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 z-0 flex md:hidden">
            <div
                className="flex-1"
                onClick={() => onMobileTap('left')}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            />
            <div
                className="w-1/3"
                onClick={() => onMobileTap('center')}
            />
            <div
                className="flex-1"
                onClick={() => onMobileTap('right')}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            />
        </div>
        
        <AnimatePresence>
        {isPlayerActive && (
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            data-controls
            style={{ transform: 'translateZ(0)' }}
            className={cn(
                "absolute inset-x-0 bottom-0 z-10 px-2 pb-2 md:bottom-6 md:px-3 transition-opacity duration-300",
                // ✅ CORREÇÃO 2: Adicionado 'invisible' para garantir que os controles fiquem ocultos.
                (showControls && !showNextEpisodeOverlay) ? "opacity-100 visible" : "opacity-0 invisible",
            )}
            >
            <div
                ref={progressWrapRef}
                onMouseMove={onProgressMouseMove}
                onMouseLeave={onProgressLeave}
                className="pointer-events-auto group/progress relative mb-3 cursor-pointer"
            >
                <div
                    className="absolute bottom-full mb-2 -translate-x-1/2 rounded bg-black/80 backdrop-blur-sm text-white text-xs ring-1 ring-white/10"
                    style={{
                    left: hoverLeft,
                    visibility: hoverTime !== null ? 'visible' : 'hidden',
                    }}
                >
                    {currentSource.thumbnailUrl && thumbnailVideoRef.current && (
                    <canvas
                        ref={canvasRef => {
                            if (canvasRef && thumbnailVideoRef.current && hoverTime !== null) {
                                const ctx = canvasRef.getContext('2d');
                                const video = thumbnailVideoRef.current;
                                if (ctx && video.videoWidth > 0 && video.readyState >= 2) {
                                  const aspectRatio = video.videoWidth / video.videoHeight;
                                  canvasRef.width = 144; // 16 * 9
                                  canvasRef.height = 144 / aspectRatio;
                                  ctx.drawImage(video, 0, 0, canvasRef.width, canvasRef.height);
                                }
                            }
                        }}
                        className="aspect-video w-36 rounded-t-md bg-black"
                    />
                    )}
                    <span className="block px-2 py-1">{formatTime(hoverTime ?? 0)}</span>
                </div>
                
                <div className="relative flex items-center h-2.5 transition-[height] duration-200">
                    <div className="absolute top-1/2 -translate-y-1/2 h-full w-full bg-zinc-800 rounded-full"/>
                    <div className="absolute top-1/2 -translate-y-1/2 h-full bg-white/50 rounded-full" style={{ width: `${bufferPercentage}%` }} />
                    <Slider value={[Math.min(currentTime, duration || 0)]} max={duration || 100} step={0.1} onValueChange={handleSeekSlider} className="absolute w-full inset-0" trackClassName="bg-transparent" rangeClassName="bg-red-600" thumbClassName="bg-red-600 border-red-600 h-3 w-3 group-hover/progress:h-5 group-hover/progress:w-5 transition-all" />
                </div>
            </div>

            <div className="pointer-events-auto flex items-center justify-between rounded-lg bg-zinc-900 px-1 py-2 md:px-2 md:py-3">
                <div className="flex items-center gap-1 md:gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button onClick={togglePlay} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/15">
                            {isPlaying ? <Pause className="h-5 w-5 md:h-6 md:w-6" /> : <Play className="h-5 w-5 md:h-6 md:w-6" />}
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isPlaying ? "Pausar (K)" : "Play (K)"}</TooltipContent>
                    </Tooltip>

                    <div className="h-6 w-px bg-white/20" />
                    
                    <div 
                        className="relative flex items-center"
                        onMouseEnter={handleVolumeMouseEnter}
                        onMouseLeave={handleVolumeMouseLeave}
                    >
                        <AnimatePresence>
                        {isVolumeOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: '80px' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-zinc-800/80 rounded-full p-2 flex items-center justify-center"
                            >
                                <Slider
                                    orientation="vertical"
                                    value={[volume]}
                                    max={1}
                                    step={0.05}
                                    onValueChange={handleVolumeChange}
                                    className="w-2 h-full"
                                    trackClassName="bg-zinc-700"
                                    rangeClassName="bg-white"
                                    thumbClassName="bg-black border-2 border-white h-4 w-4"
                                />
                            </motion.div>
                        )}
                        </AnimatePresence>
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <Button onClick={toggleMute} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/15">
                            {isMuted || volume === 0 ? <VolumeX className="h-5 w-5 md:h-6 md:w-6" /> : <Volume2 className="h-5 w-5 md:h-6 md:w-6" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Mutar (M)</TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="flex select-none justify-between text-sm text-white/80 items-center gap-1.5">
                        <span>{formatTime(currentTime)}</span>
                        <span>/</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="pointer-events-none absolute left-1/2 hidden max-w-[40vw] -translate-x-1/2 truncate text-sm text-white/80 md:block">
                    {title}
                </div>

                <div className="flex items-center gap-1 md:gap-2">
                    {downloadUrl && (
                        <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button asChild size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/15">
                                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-5 w-5 md:h-6 md:w-6" />
                                </a>
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                        </Tooltip>
                        <div className="h-6 w-px bg-white/20" />
                        </>
                    )}
                    <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/15">
                                <Settings className="h-5 w-5 md:h-6 md:w-6" />
                            </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Configurações</TooltipContent>
                        </Tooltip>
                        <PopoverContent 
                        className="w-64 border-zinc-700 bg-black/80 p-1 text-white backdrop-blur"
                        side="top"
                        align="end"
                        container={containerRef.current}
                        style={{ zIndex: 2147483647 }}
                        >
                            {settingsMenu === 'main' && (
                                <div className="flex flex-col gap-1">
                                    {hasNextEpisode && (
                                        <div className="flex items-center justify-between h-9 w-full px-2">
                                            <Label htmlFor="autoplay-switch" className="text-sm font-normal flex items-center gap-2">Próximo ep. automático</Label>
                                            <Switch
                                            id="autoplay-switch"
                                            checked={isAutoplayEnabled}
                                            onCheckedChange={toggleAutoplay}
                                            />
                                        </div>
                                    )}
                                    <Button variant="ghost" className="h-9 w-full justify-between px-2" onClick={() => setSettingsMenu('playbackRate')}>
                                        <span className="flex items-center gap-2">Velocidade</span>
                                        <span className="flex items-center gap-1 text-white/70">{currentSpeedLabel} <ChevronRight className="h-4 w-4"/></span>
                                    </Button>
                                    {sources && sources.length > 1 && (
                                        <Button variant="ghost" className="h-9 w-full justify-between px-2" onClick={() => setSettingsMenu('quality')}>
                                            <span className="flex items-center gap-2">Qualidade</span>
                                            <span className="flex items-center gap-1 text-white/70">{currentSource.name} <ChevronRight className="h-4 w-4"/></span>
                                        </Button>
                                    )}
                                </div>
                            )}
                            {settingsMenu === 'quality' && (
                                <div>
                                    <Button variant="ghost" className="h-9 w-full justify-start px-2 mb-1" onClick={() => setSettingsMenu('main')}>
                                        <ChevronLeft className="h-4 w-4 mr-2"/>
                                        Qualidade
                                    </Button>
                                    <div className="flex flex-col gap-1">
                                        {sources.map((source) => (
                                        <Button
                                            key={source.url}
                                            variant="ghost"
                                            className="h-9 w-full justify-start pl-8 pr-2 relative"
                                            onClick={() => changeQuality(source)}
                                        >
                                            {currentSource.url === source.url && <Check className="absolute left-2 h-4 w-4"/>}
                                            {source.name}
                                        </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {settingsMenu === 'playbackRate' && (
                                <div>
                                    <Button variant="ghost" className="h-9 w-full justify-start px-2 mb-1" onClick={() => setSettingsMenu('main')}>
                                        <ChevronLeft className="h-4 w-4 mr-2"/>
                                        Velocidade
                                    </Button>
                                    <div className="flex flex-col gap-1">
                                        {playbackRates.map((r) => (
                                        <Button
                                            key={r}
                                            variant="ghost"
                                            className="h-9 w-full justify-start pl-8 pr-2 relative"
                                            onClick={() => changePlaybackRate(r)}
                                        >
                                            {playbackRate === r && <Check className="absolute left-2 h-4 w-4"/>}
                                            {r === 1 ? "Normal" : `${r}x`}
                                        </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>


                    {pipSupported && (
                        <>
                            <div className="h-6 w-px bg-white/20" />
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={togglePip} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/15">
                                <PictureInPicture className={cn("h-5 w-5 md:h-6 md:w-6", isPipActive && "text-red-400")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Picture-in-Picture (P)</TooltipContent>
                            </Tooltip>
                        </>
                    )}

                    <div className="h-6 w-px bg-white/20" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                        <Button onClick={toggleFullscreen} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/15">
                            {isFullscreen ? <Minimize className="h-5 w-5 md:h-6 md:w-6" /> : <Maximize className="h-5 w-5 md:h-6 md:w-6" />}
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent>Tela Cheia (F)</TooltipContent>
                    </Tooltip>

                    {onClose && (
                        <>
                        <div className="h-6 w-px bg-white/20" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button onClick={onClose} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/15">
                                <X className="h-5 w-5 md:h-6 md:w-6" />
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>Fechar</TooltipContent>
                        </Tooltip>
                        </>
                    )}
                    </div>
                </div>
            </motion.div>
        )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  )
}