// components/video-player.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Pause, RotateCcw, X, ChevronLeft, ChevronRight, Check, AlertTriangle, Volume2, VolumeX, Settings, Maximize, Minimize, PictureInPicture } from 'lucide-react'
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
  onClose?: () => void
  rememberPositionKey?: string
  rememberPosition?: boolean
  hasNextEpisode?: boolean
  onNextEpisode?: () => void
  backdropPath?: string | null;
}

// Componente de Overlay inicial MODIFIED
const PlayerOverlay = ({ onPlay, title, backdropPath }: { onPlay: () => void; title: string; backdropPath: string | null }) => {
  const [isHovering, setIsHovering] = useState(false);
  const imageUrl = backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : null; // Use a smaller backdrop

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 cursor-pointer"
      onClick={onPlay}
    >
      {/* Optional: Show backdrop behind play button */}
      {imageUrl && (
         <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm z-[-1]" draggable="false" />
      )}
      <img
        src={isHovering ? "https://i.ibb.co/b5GFzpMs/bot-o-de-play-central-aceso.png" : "https://i.ibb.co/8qbZwTV/bot-o-de-play-central.png"}
        alt="Assistir"
        className="h-16 w-16 object-contain pointer-events-auto"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        draggable="false"
      />
    </div>
  );
};


export default function VideoPlayer({
  sources,
  title,
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isSandboxed, setIsSandboxed] = useState(false);
  const [adBlockerDetected, setAdBlockerDetected] = useState(false);
  const [checking, setChecking] = useState(true);

  // --- NOVO ESTADO: Contagem de cliques no play inicial ---
  const [initialPlayClicks, setInitialPlayClicks] = useState(0);

  const [isPlayerActive, setIsPlayerActive] = useState(false); // Player só fica ativo após o 2º clique
  const [currentSource, setCurrentSource] = useState(sources[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false) // Inicia escondido

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
  const [endingTriggered, setEndingTriggered] = useState(false);

  const [settingsMenu, setSettingsMenu] = useState<'main' | 'quality' | 'playbackRate'>('main');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isVolumeSliderVisible, setIsVolumeSliderVisible] = useState(false);
  const [isHoveringVolumeArea, setIsHoveringVolumeArea] = useState(false);

  const volumeKey = "video-player-volume"
  const autoplayKey = "video-player-autoplay-enabled"
  const positionKey = `video-pos:${rememberPositionKey || sources[0].url}`

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const volumeSliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number, side: 'left' | 'right' | 'center' }>({ time: 0, side: 'center' });
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const originalRateRef = useRef<number>(1)
  const spacebarDownTimer = useRef<NodeJS.Timeout | null>(null);
  const isSpeedingUpRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const adUrl = "https://otieu.com/4/10070814";
  // --- REMOVIDO: Intervalo de anúncio não é mais necessário ---
  // const adInterval = 2 * 60 * 1000;
  // --- REMOVIDO: Ref de último anúncio por intervalo ---
  // const lastAdTimeRef = useRef<number | null>(null);
  // Mantido para o fullscreen, mas pode ser removido se não houver lógica de tempo para ele
  const lastFullscreenAdTimeRef = useRef<number | null>(null);


  useEffect(() => {
    if (typeof window === 'undefined') {
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

  // Função genérica para abrir anúncio
  const triggerAd = useCallback(() => {
    const adWindow = window.open(adUrl, "_blank");
    const adWasSuccessful = !!adWindow && !adWindow.closed && typeof adWindow.closed === 'boolean';
    if (!adWasSuccessful) {
        console.warn("Popup ad might have been blocked.");
        // Considerar mostrar uma mensagem não-bloqueante se o anúncio falhar após interação
    }
    return adWasSuccessful;
  }, [adUrl]);


  // --- MODIFICADO: Lógica do clique inicial ---
  const handleInitialPlay = () => {
    if (checking || adBlockerDetected || isSandboxed) return; // Não faz nada se estiver checando ou bloqueado

    const currentClicks = initialPlayClicks + 1;
    setInitialPlayClicks(currentClicks);

    // Abre o anúncio no 1º e 2º clique
    const adSuccess = triggerAd();

    if (!adSuccess && currentClicks === 1) { // Verifica sandbox apenas no primeiro clique falho
        if (typeof window.open === 'undefined' || !window.open) {
            setIsSandboxed(true);
            setInitialPlayClicks(0); // Reseta para tentar de novo se sair do sandbox
            return;
        }
    }

    // Ativa o player e começa a tocar SOMENTE no segundo clique
    if (currentClicks === 2) {
        setIsPlayerActive(true);
        // O useEffect que depende de `isPlayerActive` vai carregar e tentar tocar o vídeo
    }
  };

  // --- MODIFICADO: Clique na área do player ---
  const handlePlayerAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Impede o toggle se clicou no overlay inicial
    if (!isPlayerActive) return;

    // Impede o toggle se clicou nos controles
    if ((e.target as HTMLElement).closest('[data-controls]')) return;

    // Apenas faz toggle do play/pause
    togglePlay();
  };

  // --- MODIFICADO: useEffect para carregar o vídeo ---
  useEffect(() => {
    const video = videoRef.current;
    // Só carrega se o player estiver ativo (após 2º clique)
    if (!video || !currentSource?.url || !isPlayerActive) return;

    // --- Lógica de salvar/restaurar tempo ao mudar fonte ---
    const savedTime = video.currentTime > 1 && video.src !== currentSource.url ? video.currentTime : 0;

    console.log(`[Player Effect] Active. Setting src: ${currentSource.url}. Saved time: ${savedTime}`);
    video.src = currentSource.url;
    video.load();

    const handleCanPlayThrough = () => {
      console.log("[Player Effect] Video can play through.");
      if (savedTime > 0 && video.currentTime < savedTime) {
        console.log(`[Player Effect] Restoring time to ${savedTime}`);
        video.currentTime = savedTime;
      }
      // --- Tenta tocar o vídeo ---
      video.play().catch(e => {
        // Se o autoplay falhar (comum no início), apenas atualiza o estado para pausado
        if (e.name === 'NotAllowedError') {
          setIsPlaying(false);
          setShowControls(true); // Garante que controles fiquem visíveis se o play falhar
          console.warn("Autoplay was prevented by the browser.");
        } else {
          handleError(); // Trata outros erros
        }
      });
      // Mostra controles quando o vídeo está pronto
      setShowControls(true);
      resetControlsTimeout();
    };
    video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });

    // --- Lógica para Thumbnail (mantida) ---
    const thumbnailVideo = thumbnailVideoRef.current;
    if(thumbnailVideo && currentSource.thumbnailUrl) {
        thumbnailVideo.src = currentSource.thumbnailUrl;
        thumbnailVideo.load();
        thumbnailVideo.play().catch(e => console.warn("Thumbnail play failed", e));
    }


    return () => {
      if(video) {
        video.removeEventListener('canplaythrough', handleCanPlayThrough); // Limpa o listener específico
        video.removeAttribute('src');
        video.load();
      }
      if(thumbnailVideo) {
        thumbnailVideo.pause();
        thumbnailVideo.removeAttribute('src');
        thumbnailVideo.load();
      }
    };
  // Depende de isPlayerActive para iniciar
  }, [currentSource, isPlayerActive, resetControlsTimeout]); // Adicionado resetControlsTimeout


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

      // Mostra "Continuar assistindo" apenas se o player já estiver ativo
      if (rememberPosition && isPlayerActive) {
        const savedPos = localStorage.getItem(positionKey)
        if (savedPos) {
          const n = Number.parseFloat(savedPos)
          if (!Number.isNaN(n) && n > 5) {
            setShowContinueWatching(true)
          }
        }
      }
    } catch (e) { /* no-op */ }
  }, [positionKey, rememberPosition, isPlayerActive]) // Adicionado isPlayerActive

  // Salva posição apenas se player ativo
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

  // --- MODIFICADO: Lógica de esconder controles ---
  const hideControls = useCallback(() => {
    // Não esconde se o menu de config estiver aberto ou mouse sobre volume
    if (isSettingsOpen || isHoveringVolumeArea) return;
    setShowControls(false);
    setIsVolumeSliderVisible(false);
  }, [isSettingsOpen, isHoveringVolumeArea]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Mostra controles apenas se o player estiver ativo
    if (isPlayerActive) {
      setShowControls(true);
      // Define timeout apenas se estiver tocando
      if (isPlaying) {
          controlsTimeoutRef.current = setTimeout(hideControls, 3500);
      }
    }
  }, [hideControls, isPlaying, isPlayerActive]); // Adicionado isPlayerActive

  useEffect(() => {
    if (!isPlayerActive) return; // Não adiciona listeners se inativo
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", resetControlsTimeout);
      container.addEventListener("touchstart", resetControlsTimeout, { passive: true });
    }
    // Inicia mostrando os controles se o player acabou de ser ativado
    if(isPlayerActive && initialPlayClicks >= 2) {
        resetControlsTimeout();
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (container) {
        container.removeEventListener("mousemove", resetControlsTimeout);
        container.removeEventListener("touchstart", resetControlsTimeout);
      }
    };
  }, [isPlayerActive, resetControlsTimeout, initialPlayClicks]); // Adicionado initialPlayClicks

  useEffect(() => {
    if (!isSettingsOpen) {
      const timer = setTimeout(() => setSettingsMenu('main'), 150);
      return () => clearTimeout(timer);
    }
  }, [isSettingsOpen]);

  const handleLoadStart = () => {
    if (!isPlayerActive) return;
    setIsLoading(true)
    setError(null)
  }
  const handleCanPlay = () => {
    setIsLoading(false)
    setIsBuffering(false)
    const v = videoRef.current;
    // Lógica de continuar assistindo movida para o useEffect de load
    // if (v && showContinueWatching && rememberPosition) { ... }
  }

  const handleError = () => {
    setIsLoading(false)
    setIsBuffering(false)
    setError("Não foi possível carregar o vídeo.")
    // Garante que controles fiquem visíveis no erro
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current || !isPlayerActive) return; // Só atualiza se ativo
    const { currentTime, duration } = videoRef.current;
    setCurrentTime(currentTime);
    try {
      const buf = videoRef.current.buffered;
      if (buf && buf.length > 0) { setBufferedEnd(buf.end(buf.length - 1)); }
    } catch {}
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current || !isPlayerActive) return; // Só atualiza se ativo
    setDuration(videoRef.current.duration || 0)
  }

  const handleEnded = () => {
    if(!isPlayerActive) return;
    setIsPlaying(false);
    setShowControls(true); // Mostra controles no fim
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!endingTriggered && isAutoplayEnabled && hasNextEpisode && onNextEpisode) {
      setEndingTriggered(true);
      setShowNextEpisodeOverlay(true);
      handlePlayNext(); // Inicia imediatamente
    }
  };

  const handlePlayNext = useCallback(() => {
    setShowNextEpisodeOverlay(false);
    onNextEpisode?.();
  }, [onNextEpisode]);

  const handleCancelAutoplay = () => {
    setShowNextEpisodeOverlay(false);
    setEndingTriggered(false);
  };

  const togglePlay = useCallback(() => {
    if(!isPlayerActive) return; // Não faz nada se inativo
    const v = videoRef.current;
    if (!v) return;

    if (v.ended) {
        v.currentTime = 0;
        v.play().catch(handleError);
        setEndingTriggered(false);
        setShowNextEpisodeOverlay(false);
        return;
    }

    if (v.paused) {
        const playPromise = v.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                resetControlsTimeout();
            }).catch(error => {
                if (error.name !== "AbortError") {
                    console.warn("Play interrupted or failed, ignoring:", error);
                }
            });
        }
    } else {
        v.pause();
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [resetControlsTimeout, isPlayerActive]); // Adicionado isPlayerActive

  const seek = useCallback((amount: number) => {
    if(!isPlayerActive) return;
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.min(Math.max(0, v.currentTime + amount), duration || v.duration || 0)
    setShowSeekHint({ dir: amount > 0 ? "fwd" : "back", by: Math.abs(amount) })
    resetControlsTimeout();
    setTimeout(() => setShowSeekHint(null), 700)
  }, [duration, resetControlsTimeout, isPlayerActive]) // Adicionado isPlayerActive

  const handleSeekSlider = (value: number[]) => {
    if(!isPlayerActive) return;
    const v = videoRef.current
    if (!v) return
    v.currentTime = value[0]
    setCurrentTime(value[0])
    resetControlsTimeout();
  }

  const toggleMute = useCallback(() => {
    if(!isPlayerActive) return;
    const v = videoRef.current
    if (!v) return
    const newMuted = !v.muted
    v.muted = newMuted
    setIsMuted(newMuted)
    if (!newMuted && v.volume === 0) {
      v.volume = 0.5
      setVolume(0.5)
    }
    resetControlsTimeout();
  }, [resetControlsTimeout, isPlayerActive]) // Adicionado isPlayerActive

  const handleVolumeChange = (value: number[]) => {
    if(!isPlayerActive) return;
    const v = videoRef.current
    if (!v) return
    const newVolume = value[0]
    v.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    try { localStorage.setItem(volumeKey, String(newVolume)) } catch { }
    if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
    // Não reseta timeout geral dos controles aqui
  }

  const handleVolumeAreaMouseEnter = () => {
    if(!isPlayerActive) return;
    setIsHoveringVolumeArea(true);
    if (volumeSliderTimeoutRef.current) {
        clearTimeout(volumeSliderTimeoutRef.current);
    }
    setIsVolumeSliderVisible(true);
    if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
    }
  };

  const handleVolumeAreaMouseLeave = () => {
    if(!isPlayerActive) return;
    setIsHoveringVolumeArea(false);
    volumeSliderTimeoutRef.current = setTimeout(() => {
        setIsVolumeSliderVisible(false);
    }, 200);
    resetControlsTimeout();
  };

  // --- MODIFICADO: Lógica do Fullscreen ---
  const toggleFullscreen = useCallback(async () => {
    if(!isPlayerActive) return; // Não faz nada se inativo
    const video = videoRef.current;
    if (!video) return;
    const container = containerRef.current;
    if (!container) return;

    const isCurrentlyFullscreen = !!document.fullscreenElement;

    if (!isCurrentlyFullscreen) {
        // Abre anúncio ao ENTRAR em fullscreen
        triggerAd(); // Usa a função genérica triggerAd
        lastFullscreenAdTimeRef.current = Date.now(); // Marca a hora do anúncio de fullscreen
    }

    // Ação de Fullscreen
    try {
      if (!isCurrentlyFullscreen) {
        if (video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen(); // Tenta método específico do iOS/Safari
        } else if (container.requestFullscreen) {
            await container.requestFullscreen();
        } else {
             console.warn("Fullscreen API not fully supported.");
        }
        try {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            await screen.orientation.lock('landscape');
          }
        } catch (e) { console.warn("Falha ao travar a orientação:", e); }
      } else {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        }
      }
    } catch (err) { console.error("Erro ao gerenciar fullscreen:", err); }
    resetControlsTimeout();
  }, [triggerAd, resetControlsTimeout, isPlayerActive]); // Adicionado isPlayerActive

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      // Lógica ao SAIR do fullscreen (se necessário no futuro)

      if (!isCurrentlyFullscreen) {
        try {
          if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            screen.orientation.unlock();
          }
        } catch (e) { console.warn("Falha ao destravar a orientação:", e); }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    // Adiciona listener para webkit (iOS)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []); // Dependência removida, pois a lógica de tempo foi removida


  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current || !isPlayerActive) return; // Só altera se ativo
    videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
    setSettingsMenu('main');
    resetControlsTimeout();
  }

  const changeQuality = (source: StreamSource) => {
      if(!isPlayerActive || currentSource.url === source.url) return; // Só altera se ativo e diferente

      const video = videoRef.current;
      const wasPlaying = isPlaying;
      const currentTime = video ? video.currentTime : 0;

      setCurrentSource(source); // Atualiza estado

      // Atualiza vídeo DEPOIS do estado
      if (video) {
        // Pausa antes de trocar a fonte para evitar erros em alguns navegadores
        video.pause();
        // Limpa a fonte antiga
        video.removeAttribute('src');
        video.load(); // Força a limpeza

        // Define a nova fonte APÓS limpar
        video.src = source.url;
        video.load();

        const restorePlayback = () => {
            if (video) {
                video.currentTime = currentTime;
                if (wasPlaying) {
                    video.play().catch(handleError);
                }
                // Garante que o estado de isPlaying seja atualizado corretamente
                setIsPlaying(wasPlaying);
            }
        };
        // Usa 'loadedmetadata' ou 'canplay' como fallback se 'canplaythrough' demorar muito
        const onReady = () => {
            restorePlayback();
            video.removeEventListener('canplay', onReady);
            video.removeEventListener('loadedmetadata', onReady);
        }
        video.addEventListener('canplay', onReady, { once: true });
        video.addEventListener('loadedmetadata', onReady, { once: true }); // Fallback
      }

      setSettingsMenu('main');
      resetControlsTimeout();
  }


  const toggleAutoplay = () => {
    if(!isPlayerActive) return;
    setIsAutoplayEnabled(prev => {
      const newState = !prev;
      try { localStorage.setItem(autoplayKey, JSON.stringify(newState)); } catch { }
      return newState;
    });
    resetControlsTimeout();
  };

  const togglePip = useCallback(async () => {
    if(!isPlayerActive) return;
    const v = videoRef.current
    if (!v || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) { await (document as any).exitPictureInPicture() }
      else { await (v as any).requestPictureInPicture() }
    } catch (e) { console.error("Erro no PIP", e) }
    resetControlsTimeout();
  }, [resetControlsTimeout, isPlayerActive]) // Adicionado isPlayerActive

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
            // Tenta dar play e mostrar controles após retry
            setIsPlaying(true);
            setShowControls(true);
            resetControlsTimeout();
        }, 100);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPlayerActive) return;
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.getAttribute("role") === "slider")) return;

      // Impede que a barra de espaço cause scroll
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
      } else if (e.key === ' ') {
        e.preventDefault(); // Impede scroll mesmo se repetindo
      }

      switch (e.key.toLowerCase()) {
        case "k": e.preventDefault(); togglePlay(); break;
        case "f": e.preventDefault(); toggleFullscreen(); break; // Prevent default 'f' behavior
        case "m": e.preventDefault(); toggleMute(); break;
        case "p": e.preventDefault(); togglePip(); break;
        case "arrowright": e.preventDefault(); seek(10); break;
        case "arrowleft": e.preventDefault(); seek(-10); break;
        case "arrowup": e.preventDefault(); handleVolumeChange([Math.min(1, volume + 0.1)]); break;
        case "arrowdown": e.preventDefault(); handleVolumeChange([Math.max(0, volume - 0.1)]); break;
      }
      resetControlsTimeout();
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
      resetControlsTimeout();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (spacebarDownTimer.current) clearTimeout(spacebarDownTimer.current);
    };
  }, [isPlayerActive, volume, togglePlay, toggleFullscreen, toggleMute, togglePip, seek, isPlaying, resetControlsTimeout]);

  const onProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !progressWrapRef.current || !isPlayerActive) return; // Só mostra se ativo
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const time = duration * pct;
    setHoverTime(time);

    const video = thumbnailVideoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState >= 3) {
      video.currentTime = time;
      requestAnimationFrame(() => {
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          const aspectRatio = video.videoWidth / video.videoHeight;
          canvas.width = 144;
          canvas.height = 144 / aspectRatio;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      });
    }
  };

  const onProgressLeave = () => {
    setHoverTime(null);
  };

  const onMobileTap = (side: 'left' | 'right' | 'center') => {
    if (!isPlayerActive) return; // Só funciona se ativo
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current.time < 350 && lastTapRef.current.side === side;

    if (isDoubleTap) {
        if (side === 'left') seek(-10);
        else if (side === 'right') seek(10);
        else togglePlay(); // Toggle play no double tap central
        lastTapRef.current = { time: 0, side: 'center' }; // Reseta após double tap
    } else {
        // Single tap central mostra/esconde controles
        if(side === 'center') {
            setShowControls(s => !s);
            if(showControls) { // Se estava mostrando e vai esconder
                if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
            } else { // Se estava escondido e vai mostrar
                resetControlsTimeout();
            }
        }
        // Registra o tap simples (para detectar double tap)
        lastTapRef.current = { time: now, side };
    }
  };


  const handleTouchStart = (side: 'left' | 'right') => {
    if (!isPlayerActive) return;
    holdTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && isPlaying) {
        isSpeedingUpRef.current = true;
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
    if (isSpeedingUpRef.current && videoRef.current) {
        videoRef.current.playbackRate = originalRateRef.current
        setShowSpeedHint(false)
        isSpeedingUpRef.current = false;
    }
  }

  const handleContinue = () => {
    setShowContinueWatching(false)
    if (videoRef.current) {
      // Tenta tocar e mostra controles
      videoRef.current.play().catch(handleError);
      setShowControls(true);
      resetControlsTimeout();
    }
  }

  const handleRestart = () => {
    setShowContinueWatching(false)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      // Tenta tocar e mostra controles
      videoRef.current.play().catch(handleError);
      setShowControls(true);
      resetControlsTimeout();
    }
  }

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  const hoverLeft =
    hoverTime !== null && duration > 0 && progressWrapRef.current && isPlayerActive // Só calcula se ativo
      ? Math.min(1, Math.max(0, hoverTime / duration)) * (progressWrapRef.current.clientWidth || 0)
      : 0

  const bufferPercentage = duration > 0 ? (bufferedEnd / duration) * 100 : 0;

  const currentSpeedLabel = playbackRate === 1 ? "Normal" : `${playbackRate}x`;
  const iconSize = "max-h-[20px] max-w-[20px] md:max-h-[22px] md:max-w-[22px]";
  const smallIconSize = "max-h-[16px] max-w-[16px] md:max-h-[18px] md:max-w-[18px]";

  // Verifica se deve mostrar o overlay inicial
  const showInitialOverlay = !isPlayerActive && !error && !checking && !adBlockerDetected && !isSandboxed;

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
        <p className="max-w-md text-zinc-300">Este player parece estar em um ambiente restrito (sandbox). Por favor, tente acessá-lo diretamente ou verifique as configurações do seu navegador.</p>
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
          "relative w-full h-full bg-black overflow-hidden group select-none video-player-container",
          // Esconde cursor apenas se ativo, tocando, controles escondidos e não no overlay do próximo ep
          isPlayerActive && isPlaying && !showControls && !showNextEpisodeOverlay && "cursor-none"
        )}
        onDoubleClick={e => e.preventDefault()}
        style={{ transform: 'translateZ(0)' }}
      >
        {backdropPath && (
            <Image
                src={`https://image.tmdb.org/t/p/w1280${backdropPath}`}
                alt={title}
                fill
                sizes="100vw"
                style={{ objectFit: 'cover' }}
                className="absolute inset-0 opacity-40 blur-sm z-0"
                priority
            />
        )}

        <video
          ref={videoRef}
          className={cn(
            "h-full w-full object-contain transition-opacity relative z-[1]",
            // Mostra o vídeo apenas se o player estiver ativo
            isPlayerActive ? "opacity-100" : "opacity-0 pointer-events-none" // Adicionado pointer-events-none
          )}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onPlaying={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onError={handleError}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => { setIsPlaying(true); resetControlsTimeout(); }}
          onPause={() => { setIsPlaying(false); if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }}
          onEnded={handleEnded}
          preload="metadata"
          playsInline
          webkit-playsinline="true"
        />

        {/* Área clicável SÓ aparece QUANDO player está ATIVO */}
        {isPlayerActive && (
            <div
                className="absolute inset-0 z-[5]"
                onClick={handlePlayerAreaClick}
            />
        )}

         {currentSource.thumbnailUrl && (
          <video
            ref={thumbnailVideoRef}
            className="pointer-events-none absolute bottom-0 left-0 opacity-0 h-1 w-1"
            preload="auto"
            muted
            playsInline
            webkit-playsinline="true"
            autoPlay
            loop
            crossOrigin="anonymous"
          />
        )}

        {/* Spinners e Overlays SÓ aparecem QUANDO player está ATIVO */}
        {(isLoading || isBuffering) && isPlayerActive && (
          <div style={{ transform: 'translateZ(0)' }} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        )}
        {error && isPlayerActive && (
          <div style={{ transform: 'translateZ(0)' }} className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-4">
            <div className="text-center text-white">
              <p className="mb-4 text-sm text-zinc-200">{error}</p>
              <div className="flex items-center justify-center gap-2">
                <Button onClick={retry} variant="secondary" className="h-9"><RotateCcw className="mr-2 h-4 w-4" /> Tentar Novamente</Button>
                {onClose && <Button onClick={onClose} variant="outline" className="h-9"> Fechar </Button>}
              </div>
            </div>
          </div>
        )}

        {/* Overlay Inicial (Controlado por showInitialOverlay) */}
        <AnimatePresence>
          {showInitialOverlay && <PlayerOverlay onPlay={handleInitialPlay} title={title} backdropPath={backdropPath} />}
        </AnimatePresence>

        {showContinueWatching && isPlayerActive && (
          <div style={{ transform: 'translateZ(0)' }} className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
            <p className="text-white text-lg mb-4">Continuar de onde parou?</p>
            <div className="flex gap-4">
              <Button onClick={handleContinue} className="bg-white text-black">Sim</Button>
              <Button onClick={handleRestart} variant="secondary">Reiniciar</Button>
            </div>
          </div>
        )}
        {showSeekHint && isPlayerActive && (
          <div style={{ transform: 'translateZ(0)' }} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="rounded-full bg-black/60 px-3 py-1 text-sm text-white ring-1 ring-white/10">
              {showSeekHint.dir === "fwd" ? `+${showSeekHint.by}s` : `-${showSeekHint.by}s`}
            </div>
          </div>
        )}
        <AnimatePresence>
          {showSpeedHint && isPlayerActive && (
            <motion.div style={{ transform: 'translateZ(0)' }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-full bg-black/60 px-4 py-2 text-lg font-bold text-white ring-1 ring-white/10"> 2x </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showNextEpisodeOverlay && isPlayerActive && (
            <motion.div style={{ transform: 'translateZ(0)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 pointer-events-none">
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zonas de toque SÓ funcionam QUANDO player está ATIVO */}
        {isPlayerActive && (
            <div className="absolute inset-0 z-[2] flex md:hidden">
                <div className="flex-1" onClick={() => onMobileTap('left')} onTouchStart={() => handleTouchStart('left')} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}/>
                <div className="w-1/3" onClick={() => onMobileTap('center')}/>
                <div className="flex-1" onClick={() => onMobileTap('right')} onTouchStart={() => handleTouchStart('right')} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}/>
            </div>
        )}


        {/* Controles SÓ aparecem QUANDO player está ATIVO */}
        <AnimatePresence>
        {isPlayerActive && (
            <motion.div
            // Animação baseada em showControls E !showNextEpisodeOverlay
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showControls && !showNextEpisodeOverlay ? 1 : 0, y: showControls && !showNextEpisodeOverlay ? 0 : 20 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            data-controls
            style={{ transform: 'translateZ(0)' }}
            className={cn(
                "absolute inset-x-0 bottom-0 z-10 px-2 pb-2 md:bottom-4 md:px-4",
                // Esconde se showControls for false OU se showNextEpisodeOverlay for true
                (!(showControls && !showNextEpisodeOverlay)) && "invisible pointer-events-none"
            )}
             onMouseEnter={() => { if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }}
             onMouseLeave={() => { resetControlsTimeout(); }}
            >
                {/* Barra de Progresso */}
                <div
                    ref={progressWrapRef}
                    onMouseMove={onProgressMouseMove}
                    onMouseLeave={onProgressLeave}
                    className="group/progress relative mb-1 cursor-pointer h-12"
                    style={{ zIndex: 1 }}
                >
                    {/* Thumbnail Preview */}
                    <div
                        className="absolute bottom-10 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-white text-xs ring-1 ring-white/10 overflow-hidden"
                        style={{ left: hoverLeft, visibility: hoverTime !== null ? 'visible' : 'hidden' }}
                    >
                        {currentSource.thumbnailUrl && thumbnailVideoRef.current && (<canvas ref={canvasRef} className="block aspect-video w-52 bg-black"/>)}
                        <span className="block px-2 py-1">{formatTime(hoverTime ?? 0)}</span>
                    </div>

                    {/* Slider */}
                    <div className="absolute bottom-2 left-0 right-0 px-1 md:px-0 flex items-center h-3 group-hover/progress:h-4 transition-[height] duration-200">
                        <div className="absolute top-1/2 -translate-y-1/2 h-2 group-hover/progress:h-3 w-full bg-white/20 rounded-full"/>
                        <div className="absolute top-1/2 -translate-y-1/2 h-2 group-hover/progress:h-3 bg-white/40 rounded-full" style={{ width: `${bufferPercentage}%` }} />
                        <Slider
                            value={[Math.min(currentTime, duration || 0)]}
                            max={duration || 100}
                            step={0.1}
                            onValueChange={handleSeekSlider}
                            className="absolute w-full inset-0 h-full cursor-pointer"
                            trackClassName="bg-transparent h-full"
                            rangeClassName="bg-white h-2 group-hover/progress:h-3 absolute top-1/2 -translate-y-1/2 rounded-full"
                            thumbClassName={cn("bg-white border-white h-4 w-4 transition-opacity block", "group-hover/progress:opacity-100 opacity-0")}
                        />
                    </div>
                </div>

                {/* Barra de Controles */}
                <div className="bg-zinc-800 rounded-md md:rounded-lg px-2 py-2 md:px-3 md:py-2.5 flex items-center justify-between relative" style={{ zIndex: 0 }}>
                    {/* Controles Esquerda */}
                    <div className="flex items-center gap-1.5 md:gap-2.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button onClick={togglePlay} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                {isPlaying ?
                                    <img src="https://i.ibb.co/fdgFF2VK/despause-pequeno-bot-o.png" alt="Pause" className={cn("object-contain", iconSize)} draggable="false" />
                                    :
                                    <img src="https://i.ibb.co/chY4zZLj/bot-o-de-play-central.png" alt="Play" className={cn("object-contain", iconSize)} draggable="false" />
                                }
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isPlaying ? "Pausar (K)" : "Play (K)"}</TooltipContent>
                        </Tooltip>

                         <div className="relative flex items-center" onMouseEnter={handleVolumeAreaMouseEnter} onMouseLeave={handleVolumeAreaMouseLeave}>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                <Button onClick={toggleMute} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                    <img src="https://i.ibb.co/0VQwLNMw/botao-de-volume.png" alt="Volume" className={cn("object-contain", iconSize, (isMuted || volume === 0) && "opacity-50")} draggable="false" />
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mutar (M)</TooltipContent>
                             </Tooltip>
                            <AnimatePresence>
                                {isVolumeSliderVisible && (
                                    <motion.div initial={{ opacity: 0, x: -10, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -10, scale: 0.9 }} transition={{ duration: 0.15 }} className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-zinc-800 rounded-md px-3 py-2 shadow-lg">
                                        <Slider value={[volume]} onValueChange={handleVolumeChange} max={1} step={0.01} className="w-20 h-4 flex items-center cursor-pointer" trackClassName="bg-white/30 h-1.5 w-full rounded-full" rangeClassName="bg-white h-full rounded-full" thumbClassName="h-3 w-3 bg-white border-white block"/>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="flex select-none justify-between text-xs md:text-sm text-white/90 items-center gap-1 ml-1 md:ml-2">
                            <span>{formatTime(currentTime)}</span><span className="opacity-70">/</span><span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Título Central (Escondido no mobile) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden max-w-[calc(100%-240px)] truncate px-4 text-sm text-white/80 md:block">{title}</div>

                    {/* Controles Direita */}
                    <div className="flex items-center gap-1.5 md:gap-2.5">
                       <Tooltip>
                            <TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center" disabled><img src="https://i.ibb.co/2Yy4Pv04/bot-o-de-chromecast.png" alt="Cast" className={cn("object-contain opacity-50", iconSize)} draggable="false" /></Button></TooltipTrigger>
                            <TooltipContent>Chromecast (Indisponível)</TooltipContent>
                        </Tooltip>

                        <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                            <Tooltip>
                            <TooltipTrigger asChild><PopoverTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center"><img src="https://i.ibb.co/W4PKpLj1/botao-de-config.png" alt="Configurações" className={cn("object-contain", iconSize)} draggable="false" /></Button></PopoverTrigger></TooltipTrigger>
                            <TooltipContent>Configurações</TooltipContent>
                            </Tooltip>
                             <PopoverContent className="w-64 border-zinc-700 bg-black/80 p-1 text-white backdrop-blur ring-1 ring-white/10" side="top" align="end" avoidCollisions container={containerRef.current} style={{ zIndex: 2147483647 }}>
                                {settingsMenu === 'main' && (
                                    <div className="flex flex-col gap-1">
                                        {hasNextEpisode && (<div className="flex items-center justify-between h-9 w-full px-2"><Label htmlFor="autoplay-switch" className="text-sm font-normal flex items-center gap-2">Próximo ep. automático</Label><Switch id="autoplay-switch" checked={isAutoplayEnabled} onCheckedChange={toggleAutoplay}/></div>)}
                                        <Button variant="ghost" className="h-9 w-full justify-between px-2" onClick={() => setSettingsMenu('playbackRate')}><span className="flex items-center gap-2">Velocidade</span><span className="flex items-center gap-1 text-white/70">{currentSpeedLabel} <ChevronRight className="h-4 w-4"/></span></Button>
                                         <Button variant="ghost" className="h-9 w-full justify-between px-2" onClick={() => setSettingsMenu('quality')}><span className="flex items-center gap-2">Qualidade</span><span className="flex items-center gap-1 text-white/70">{currentSource.name} <ChevronRight className="h-4 w-4"/></span></Button>
                                    </div>
                                )}
                                {settingsMenu === 'quality' && (
                                    <div>
                                        <Button variant="ghost" className="h-9 w-full justify-start px-2 mb-1" onClick={() => setSettingsMenu('main')}><ChevronLeft className="h-4 w-4 mr-2"/> Qualidade </Button>
                                        <div className="flex flex-col gap-1">{sources.map((source) => (<Button key={source.url} variant="ghost" className="h-9 w-full justify-start pl-8 pr-2 relative" onClick={() => changeQuality(source)}>{currentSource.url === source.url && <Check className="absolute left-2 h-4 w-4"/>} {source.name}</Button>))}</div>
                                    </div>
                                )}
                                {settingsMenu === 'playbackRate' && (
                                    <div>
                                        <Button variant="ghost" className="h-9 w-full justify-start px-2 mb-1" onClick={() => setSettingsMenu('main')}><ChevronLeft className="h-4 w-4 mr-2"/> Velocidade </Button>
                                        <div className="flex flex-col gap-1">{playbackRates.map((r) => (<Button key={r} variant="ghost" className="h-9 w-full justify-start pl-8 pr-2 relative" onClick={() => changePlaybackRate(r)}>{playbackRate === r && <Check className="absolute left-2 h-4 w-4"/>} {r === 1 ? "Normal" : `${r}x`}</Button>))}</div>
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>

                        {pipSupported && (
                            <Tooltip>
                            <TooltipTrigger asChild><Button onClick={togglePip} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center"><img src="https://i.ibb.co/Jw0ndFSc/picture-in-picture.png" alt="PiP" className={cn("object-contain", iconSize, isPipActive && "opacity-70")} draggable="false" /></Button></TooltipTrigger>
                            <TooltipContent>Picture-in-Picture (P)</TooltipContent>
                            </Tooltip>
                        )}

                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button onClick={toggleFullscreen} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                {isFullscreen ?
                                    <img src="https://i.ibb.co/bg2F2VFZ/sair-de-tela-cheia.png" alt="Sair Tela Cheia" className={cn("object-contain", iconSize)} draggable="false" />
                                    :
                                    <img src="https://i.ibb.co/x8wjGChh/tela-cheia-bot-o.png" alt="Tela Cheia" className={cn("object-contain", iconSize)} draggable="false" />
                                }
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>Tela Cheia (F)</TooltipContent>
                        </Tooltip>

                         {onClose && (
                            <Tooltip>
                                <TooltipTrigger asChild><Button onClick={onClose} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10"><X className={smallIconSize} /></Button></TooltipTrigger>
                                <TooltipContent>Fechar</TooltipContent>
                            </Tooltip>
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