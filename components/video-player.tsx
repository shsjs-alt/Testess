// components/video-player.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
// MODIFIED: Removed 'Radio' icon as it's no longer needed
import { Play, Pause, RotateCcw, X, ChevronLeft, ChevronRight, Check, AlertTriangle, Volume2, VolumeX, Settings, Maximize, Minimize, PictureInPicture } from 'lucide-react' // Import icons
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
  // downloadUrl?: string // REMOVIDO
  onClose?: () => void
  rememberPositionKey?: string
  rememberPosition?: boolean
  hasNextEpisode?: boolean
  onNextEpisode?: () => void
  backdropPath?: string | null;
}

// --- Componente de Overlay inicial ---
const PlayerOverlay = ({ onClick, title, backdropPath }: { onClick: () => void; title: string; backdropPath: string | null }) => {
  const [isHovering, setIsHovering] = useState(false);
  const imageUrl = backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : null;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 cursor-pointer"
      onClick={onClick} // Usa a prop onClick passada
    >
      {imageUrl && (
         <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm z-[-1]" draggable="false" />
      )}
      <img
        src={isHovering ? "https://i.ibb.co/b5GFzpMs/bot-o-de-play-central-aceso.png" : "https://i.ibb.co/8qbZwTV/bot-o-de-play-central.png"}
        alt="Assistir"
        className="h-16 w-16 object-contain pointer-events-auto" // Mantém pointer-events-auto para a imagem
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        draggable="false"
      />
      {/* <p className="text-sm text-zinc-400 mt-4">Clique para assistir</p> */}
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
  // MANTIDO: Canvas ref para o thumbnail preview
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isSandboxed, setIsSandboxed] = useState(false);
  // REMOVIDO: Detecção de Ad Blocker e seus estados
  // const [adBlockerDetected, setAdBlockerDetected] = useState(false);
  const [checking, setChecking] = useState(true);

  const [isPlayerActive, setIsPlayerActive] = useState(false);
  // REMOVIDO: Estado de contagem de cliques no overlay
  // const [overlayClickCount, setOverlayClickCount] = useState(0);

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
  // CORREÇÃO: Countdown não é mais necessário aqui, será gerenciado na função
  // const [countdown, setCountdown] = useState(5)
  const [endingTriggered, setEndingTriggered] = useState(false);

  const [settingsMenu, setSettingsMenu] = useState<'main' | 'quality' | 'playbackRate'>('main');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // CORREÇÃO: Controle da visibilidade do slider de volume
  const [isVolumeSliderVisible, setIsVolumeSliderVisible] = useState(false);
  const [isHoveringVolumeArea, setIsHoveringVolumeArea] = useState(false);

  const volumeKey = "video-player-volume"
  const autoplayKey = "video-player-autoplay-enabled"
  const positionKey = `video-pos:${rememberPositionKey || sources[0].url}`

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // CORREÇÃO: Timeout para esconder o slider de volume
  const volumeSliderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number, side: 'left' | 'right' | 'center' }>({ time: 0, side: 'center' });
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const originalRateRef = useRef<number>(1)
  const spacebarDownTimer = useRef<NodeJS.Timeout | null>(null);
  const isSpeedingUpRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // REMOVIDO: Variáveis de anúncio
  // const adUrl = "https://otieu.com/4/10070814";
  // const adInterval = 2 * 60 * 1000; // 2 minutos
  // const lastAdTimeRef = useRef<number | null>(null);
  // const lastFullscreenAdTimeRef = useRef<number | null>(null);

  // --- REMOVIDO: Lógica de detecção de AdBlocker ---
  useEffect(() => {
    // Apenas verifica se o ambiente é válido (não faz mais detecção de ad blocker)
    setChecking(false); 
  }, []);

  // --- REMOVIDO: Funções de trigger de anúncio ---
  /*
  const triggerAd = useCallback(() => { ... }, [adUrl]);
  const triggerAdAndPause = useCallback(() => { ... }, [adUrl]);
  */

  // --- FUNÇÃO MODIFICADA: Lida com cliques no overlay inicial (Anúncios ANULADOS) ---
  const handleOverlayClick = () => {
    // Ativa o player imediatamente no primeiro clique.
    if (!isPlayerActive) {
      console.log("Ativação imediata do player (anúncios anulados).");
      activatePlayer();
    }
    // REMOVIDA toda a lógica de contagem de overlayClickCount e chamada de triggerAd.
  };

  // --- RENOMEADO e MODIFICADO: Função para ATIVAR o player ---
  const activatePlayer = () => {
    console.log("Ativando o player...");
    setIsPlayerActive(true); // Ativa a UI e começa a carregar o vídeo

    // Checagem de sandbox pode permanecer aqui ou ser movida se necessário
    if (typeof window.open === 'undefined' || !window.open) {
        console.error("Ambiente restrito (sandbox) detectado ao tentar ativar player.");
        setIsSandboxed(true);
        setIsPlayerActive(false); // Desativa se estiver em sandbox
        setChecking(false);
    }
  };

  const handlePlayerAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if the click is on the play button overlay image
    if ((e.target as HTMLElement).tagName === 'IMG' && (e.target as HTMLElement).closest('.absolute.inset-0.z-20')) {
        return; // Don't toggle play if the initial play button is clicked
    }
    if ((e.target as HTMLElement).closest('[data-controls]')) return;

    // A lógica de anúncio por intervalo foi removida daqui, deixando apenas o togglePlay
    togglePlay();
  };

  // --- MODIFICAÇÃO: Lógica do useEffect que define o 'src' do vídeo ---
  // Este useEffect agora SÓ depende de `currentSource` e `isPlayerActive`
  useEffect(() => {
    const video = videoRef.current;
    // NÃO executa se o player não estiver ativo (após os cliques)
    if (!video || !currentSource?.url || !isPlayerActive) return;

    // ... (restante da lógica do useEffect para carregar source, restaurar tempo, etc.) ...
     console.log(`[Player Effect] Player ATIVO. Definindo src: ${currentSource.url}.`);
     const savedTime = video.currentTime > 1 && video.src !== currentSource.url ? video.currentTime : 0;
     video.src = currentSource.url;
     video.load();

     const handleCanPlayThrough = () => {
       console.log("[Player Effect] Vídeo pronto para tocar.");
       if (video && savedTime > 0 && video.currentTime < savedTime) { // Check video exists
         console.log(`[Player Effect] Restaurando tempo para ${savedTime}`);
         video.currentTime = savedTime;
       }
       // Tenta dar play automaticamente QUANDO o player for ativado
       video?.play().catch(handleError); // A primeira interação do usuário (o clique) deve permitir o autoplay aqui
     };
     video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });

     setShowNextEpisodeOverlay(false);
     if (countdownIntervalRef.current) {
       clearInterval(countdownIntervalRef.current);
     }

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
   // A dependência `handleError` pode ser adicionada se o linter reclamar, mas a lógica principal depende apenas da source e ativação.
   }, [currentSource, isPlayerActive]); // <- Apenas estas dependências!


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
    // CORREÇÃO: Só esconde se o mouse não estiver sobre a área de volume
    if (!isHoveringVolumeArea) {
      setShowControls(false);
      setIsVolumeSliderVisible(false); // Garante que o slider feche com os controles
    }
  }, [isHoveringVolumeArea]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    // CORREÇÃO: Define um novo timeout apenas se o vídeo estiver tocando
    if (isPlaying) {
        controlsTimeoutRef.current = setTimeout(hideControls, 3500);
    }
  }, [hideControls, isPlaying]); // Adicionado isPlaying como dependência

  useEffect(() => {
    if (!isPlayerActive) return;
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", resetControlsTimeout);
      // CORREÇÃO: Mouseleave é gerenciado agora pelo hideControls e isHoveringVolumeArea
      // container.addEventListener("mouseleave", hideControls);
      container.addEventListener("touchstart", resetControlsTimeout, { passive: true });
    }
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (container) {
        container.removeEventListener("mousemove", resetControlsTimeout);
        // container.removeEventListener("mouseleave", hideControls);
        container.removeEventListener("touchstart", resetControlsTimeout);
      }
    };
  }, [isPlayerActive, resetControlsTimeout]); // Removido hideControls das dependências

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
    // CORREÇÃO: Removida a lógica de trigger do próximo episódio baseada no tempo
    try {
      const buf = videoRef.current.buffered;
      if (buf && buf.length > 0) { setBufferedEnd(buf.end(buf.length - 1)); }
    } catch {}
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration || 0)
  }

  // CORREÇÃO: Lógica do próximo episódio centralizada aqui
  const handleEnded = () => {
    setIsPlaying(false); // Define como pausado ao terminar
    if (!endingTriggered && isAutoplayEnabled && hasNextEpisode && onNextEpisode) {
      setEndingTriggered(true);
      setShowNextEpisodeOverlay(true);
      // Inicia imediatamente o próximo episódio
      handlePlayNext();
    }
  };

  const handlePlayNext = useCallback(() => {
    // CORREÇÃO: Não precisa mais limpar intervalo
    setShowNextEpisodeOverlay(false); // Esconde o overlay (embora mal apareça)
    onNextEpisode?.(); // Chama a função para carregar o próximo
  }, [onNextEpisode]);

  // CORREÇÃO: Função de cancelar não é mais necessária da mesma forma,
  // mas pode ser mantida se houver um overlay de cancelamento futuro
  const handleCancelAutoplay = () => {
    setShowNextEpisodeOverlay(false);
    setEndingTriggered(false); // Permite tentar de novo
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    // CORREÇÃO: Se estiver no final e for dado play, reinicia
    if (v.ended) {
        v.currentTime = 0;
        v.play().catch(handleError);
        setEndingTriggered(false); // Reseta o trigger do final
        setShowNextEpisodeOverlay(false); // Esconde o overlay
        return;
    }

    if (v.paused) {
        const playPromise = v.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                resetControlsTimeout(); // Esconde controles após play
            }).catch(error => {
                if (error.name !== "AbortError") {
                    console.warn("Play interrupted or failed, ignoring:", error);
                }
            });
        }
    } else {
        v.pause();
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); // Mantém controles visíveis ao pausar
    }
  }, [resetControlsTimeout]);

  const seek = useCallback((amount: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.min(Math.max(0, v.currentTime + amount), duration || v.duration || 0)
    setShowSeekHint({ dir: amount > 0 ? "fwd" : "back", by: Math.abs(amount) })
    resetControlsTimeout(); // Show controls on seek
    setTimeout(() => setShowSeekHint(null), 700)
  }, [duration, resetControlsTimeout])

  const handleSeekSlider = (value: number[]) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = value[0]
    setCurrentTime(value[0])
    resetControlsTimeout(); // Show controls when user interacts with slider
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
    resetControlsTimeout(); // Show controls on mute toggle
  }, [resetControlsTimeout])

  const handleVolumeChange = (value: number[]) => {
    const v = videoRef.current
    if (!v) return
    const newVolume = value[0]
    v.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    try { localStorage.setItem(volumeKey, String(newVolume)) } catch { }
    // CORREÇÃO: Não reseta o timeout geral, mas cancela o timeout de esconder o slider
    if (volumeSliderTimeoutRef.current) clearTimeout(volumeSliderTimeoutRef.current);
    // Don't reset general controls timeout
    // resetControlsTimeout();
  }

  // CORREÇÃO: Lógica de hover da área de volume
  const handleVolumeAreaMouseEnter = () => {
    setIsHoveringVolumeArea(true);
    if (volumeSliderTimeoutRef.current) {
        clearTimeout(volumeSliderTimeoutRef.current);
    }
    setIsVolumeSliderVisible(true);
    // Cancela o timeout de esconder controles gerais
    if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null; // Indica que foi cancelado
    }
  };

  const handleVolumeAreaMouseLeave = () => {
    setIsHoveringVolumeArea(false);
    // Agenda o fechamento do slider de volume
    volumeSliderTimeoutRef.current = setTimeout(() => {
        setIsVolumeSliderVisible(false);
    }, 200); // Delay para permitir mover para o slider
    // Reinicia o timeout para esconder os controles gerais
    resetControlsTimeout();
  };


  // --- FUNÇÃO MODIFICADA: Anúncios REMOVIDOS do Fullscreen ---
  const toggleFullscreen = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const isCurrentlyFullscreen = !!document.fullscreenElement;

    // TODO: [REMOVIDO ANÚNCIO] Toda a lógica de verificação e acionamento de anúncio foi removida.
    // O player entrará ou sairá de tela cheia sem interrupção.

    // Ação de Fullscreen nativa do navegador
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!isCurrentlyFullscreen) {
        // Entrar em Fullscreen
        if (video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
        } else {
            await container.requestFullscreen();
        }
        try {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            await screen.orientation.lock('landscape');
          }
        } catch (e) {
          console.warn("Falha ao travar a orientação de tela:", e);
        }
      } else {
        // Sair do Fullscreen
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Erro ao gerenciar fullscreen:", err);
    }
    resetControlsTimeout(); // Show controls on fullscreen toggle
  }, [resetControlsTimeout]); // Removidas as dependências de anúncio

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);

      // Lógica de anúncio ao sair do fullscreen foi removida daqui.
      // if (!isCurrentlyFullscreen && isPlayerActive) { lastFullscreenAdTimeRef.current = Date.now(); }

      if (!isCurrentlyFullscreen) {
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
  }, [isPlayerActive]); // Dependência

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return
    videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
    setSettingsMenu('main');
    resetControlsTimeout(); // Show controls after changing speed
  }

  const changeQuality = (source: StreamSource) => {
      if(currentSource.url !== source.url){
        const video = videoRef.current;
        const wasPlaying = isPlaying; // Store if it was playing before change
        const currentTime = video ? video.currentTime : 0; // Save current time

        // Update the source state FIRST
        setCurrentSource(source);

        // Then, update the video element source AFTER state is set
        if (video) {
          video.src = source.url;
          video.load(); // Important: Tell the browser to load the new source

          // Re-attach event listener to play after load and restore time
          video.addEventListener('canplaythrough', () => {
              if (video) {
                  video.currentTime = currentTime; // Restore time
                  if (wasPlaying) {
                      video.play().catch(handleError); // Play only if it was playing before
                  }
              }
          }, { once: true });
        }
      }
      setSettingsMenu('main');
      resetControlsTimeout(); // Show controls after changing quality
  }


  const toggleAutoplay = () => {
    setIsAutoplayEnabled(prev => {
      const newState = !prev;
      try { localStorage.setItem(autoplayKey, JSON.stringify(newState)); } catch { }
      return newState;
    });
    resetControlsTimeout(); // Keep controls visible
  };

  const togglePip = useCallback(async () => {
    const v = videoRef.current
    if (!v || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) { await (document as any).exitPictureInPicture() }
      else { await (v as any).requestPictureInPicture() }
    } catch (e) { console.error("Erro no PIP", e) }
    resetControlsTimeout(); // Show controls on PIP toggle
  }, [resetControlsTimeout])

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
      resetControlsTimeout(); // Reset timeout on any key interaction
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
      resetControlsTimeout(); // Reset timeout on key up as well
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (spacebarDownTimer.current) clearTimeout(spacebarDownTimer.current);
    };
  }, [isPlayerActive, volume, togglePlay, toggleFullscreen, toggleMute, togglePip, seek, isPlaying, resetControlsTimeout]); // Added resetControlsTimeout

  const onProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !progressWrapRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const time = duration * pct;
    setHoverTime(time);

    // CORREÇÃO: Lógica de atualização e renderização do thumbnail preview.
    const video = thumbnailVideoRef.current;
    const canvas = canvasRef.current;

    // CORREÇÃO: Alterado para readyState >= 3 (HAVE_FUTURE_DATA) para mais confiabilidade
    if (video && canvas && video.readyState >= 3) {
      // Força a busca do frame no vídeo de miniatura
      video.currentTime = time;

      // Usa requestAnimationFrame para garantir que o desenho seja feito após a atualização do frame
      requestAnimationFrame(() => {
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          const aspectRatio = video.videoWidth / video.videoHeight;
          canvas.width = 144; // Largura fixa
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

  const handleTouchStart = (side: 'left' | 'right') => { // Capture side
    if (!isPlayerActive) return;
    holdTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && isPlaying) {
        isSpeedingUpRef.current = true; // Mark as speeding up
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
    // Only reset speed if it was actually speeding up
    if (isSpeedingUpRef.current && videoRef.current) {
        videoRef.current.playbackRate = originalRateRef.current
        setShowSpeedHint(false)
        isSpeedingUpRef.current = false; // Reset flag
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

  // Define icon size classes - MODIFIED to be slightly larger
  const iconSize = "max-h-[20px] max-w-[20px] md:max-h-[22px] md:max-w-[22px]";
  const smallIconSize = "max-h-[16px] max-w-[16px] md:max-h-[18px] md:max-w-[18px]";

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

  // --- REMOVIDO: Bloco de erro do AdBlocker ---
  /*
  if (adBlockerDetected) {
    return (
       <div className="w-full h-full bg-black flex flex-col items-center justify-center text-center p-6 text-white">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mb-4" />
        <h2 className="text-xl font-bold mb-2">AdBlock Detectado</h2>
        <p className="max-w-md text-zinc-300">Detectamos um bloqueador de anúncios. Por favor, desative-o para este site para reproduzir o vídeo e nos ajudar a manter o serviço gratuito.</p>
      </div>
    );
  }
  */

  // INÍCIO DO RETORNO PRINCIPAL
  return (
    <TooltipProvider delayDuration={150}>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full h-full bg-black overflow-hidden group select-none video-player-container", // Added relative for absolute positioning inside
          isPlaying && !showControls && !showNextEpisodeOverlay && isPlayerActive && "cursor-none"
        )}
        onDoubleClick={e => e.preventDefault()} // Prevent double-click zoom
        style={{ transform: 'translateZ(0)' }} // Promote to composite layer for smoother animations
      >
        {/* Backdrop Image */}
        {backdropPath && (
            <Image
                src={`https://image.tmdb.org/t/p/w1280${backdropPath}`}
                alt={title}
                fill // Use fill instead of layout="fill"
                sizes="100vw" // Indicate it spans the viewport width
                style={{ objectFit: 'cover' }} // Use style object for objectFit
                className="absolute inset-0 opacity-40 blur-sm z-0" // Ensure it's behind the video
                priority
            />
        )}


        {/* Video Element */}
        <video
          ref={videoRef}
          className={cn(
            "h-full w-full object-contain transition-opacity relative z-[1]", // Ensure video is above backdrop
            isPlayerActive ? "opacity-100" : "opacity-0"
          )}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onPlaying={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onError={handleError}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => { setIsPlaying(true); resetControlsTimeout(); }} // CORREÇÃO: Reseta timeout ao dar play
          onPause={() => { setIsPlaying(false); if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }} // CORREÇÃO: Cancela timeout ao pausar
          onEnded={handleEnded}
          preload="metadata"
          playsInline // Important for mobile playback without fullscreen
          webkit-playsinline="true" // iOS specific attribute
        />
        {/* Clickable Area to Toggle Play/Pause */}
        {/* Movido para dentro do Overlay */}
        {/* <div
            className="absolute inset-0 z-[5]" // Lower z-index than controls
            onClick={handlePlayerAreaClick}
        /> */}
         {/* Thumbnail Video (Hidden) */}
         {currentSource.thumbnailUrl && (
          <video
            ref={thumbnailVideoRef}
            className="pointer-events-none absolute bottom-0 left-0 opacity-0 h-1 w-1" // Make it very small but still in DOM
            preload="auto"
            muted
            playsInline
            webkit-playsinline="true"
            autoPlay // Needed for seeking frames
            loop // Needed for seeking frames
            crossOrigin="anonymous"
          />
        )}

        {/* Loading/Buffering Spinner */}
        {(isLoading || isBuffering) && isPlayerActive && (
          <div
            style={{ transform: 'translateZ(0)' }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          >
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        )}

        {/* Error Overlay */}
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

        {/* --- MODIFICAÇÃO: Overlay inicial agora usa handleOverlayClick (sem anúncios) --- */}
        <AnimatePresence>
          {!isPlayerActive && !error && (
            <PlayerOverlay
              onClick={handleOverlayClick} // Passa o novo handler
              title={title}
              backdropPath={backdropPath}
            />
          )}
        </AnimatePresence>

        {/* Continue Watching Overlay */}
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

        {/* Seek Hint Overlay */}
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

        {/* Speed Hint Overlay */}
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

        {/* Next Episode Overlay (Agora apenas um indicador rápido, pois a transição é imediata) */}
        <AnimatePresence>
          {showNextEpisodeOverlay && isPlayerActive && (
            <motion.div
              style={{ transform: 'translateZ(0)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 pointer-events-none" // Adicionado pointer-events-none
            >
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile tap zones */}
        <div className="absolute inset-0 z-[2] flex md:hidden">
            <div
                className="flex-1"
                onClick={() => onMobileTap('left')}
                onTouchStart={() => handleTouchStart('left')} // Pass side
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd} // Handle cancellation
            />
            <div
                className="w-1/3" // Center zone doesn't trigger speed up
                onClick={() => onMobileTap('center')}
            />
            <div
                className="flex-1"
                onClick={() => onMobileTap('right')}
                onTouchStart={() => handleTouchStart('right')} // Pass side
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd} // Handle cancellation
            />
        </div>

        {/* Controls Container */}
        <AnimatePresence>
        {isPlayerActive && (
            <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showControls && !showNextEpisodeOverlay ? 1 : 0, y: showControls && !showNextEpisodeOverlay ? 0 : 20 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            data-controls
            style={{ transform: 'translateZ(0)' }}
            className={cn(
                "absolute inset-x-0 bottom-0 z-10 px-2 pb-2 md:bottom-4 md:px-4",
                !(showControls && !showNextEpisodeOverlay) && "invisible pointer-events-none"
            )}
             // CORREÇÃO: Mouse enter/leave nos controles agora cancelam/reiniciam o timeout
             onMouseEnter={() => {
                if(controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
             }}
             onMouseLeave={() => {
                resetControlsTimeout();
             }}
            >
                {/* Progress Bar Container */}
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
                        style={{
                        left: hoverLeft,
                        visibility: hoverTime !== null ? 'visible' : 'hidden',
                        }}
                    >
                        {currentSource.thumbnailUrl && thumbnailVideoRef.current && (
                            <canvas
                                ref={canvasRef}
                                className="block aspect-video w-52 bg-black"
                            />
                        )}
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
                            thumbClassName={cn(
                                "bg-white border-white h-4 w-4 transition-opacity block",
                                "group-hover/progress:opacity-100 opacity-0"
                             )}
                        />
                    </div>
                </div>

                {/* Solid Dark Gray Control Bar */}
                <div className="bg-zinc-800 rounded-md md:rounded-lg px-2 py-2 md:px-3 md:py-2.5 flex items-center justify-between relative" style={{ zIndex: 0 }}>
                    {/* Left Controls */}
                    <div className="flex items-center gap-1.5 md:gap-2.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button onClick={togglePlay} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                {isPlaying ?
                                    <img
                                        src="https://i.ibb.co/fdgFF2VK/despause-pequeno-bot-o.png"
                                        alt="Pause"
                                        className={cn("object-contain", iconSize)}
                                        draggable="false"
                                    />
                                    :
                                    <img
                                        src="https://i.ibb.co/chY4zZLj/bot-o-de-play-central.png"
                                        alt="Play"
                                        className={cn("object-contain", iconSize)}
                                        draggable="false"
                                    />
                                }
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isPlaying ? "Pausar (K)" : "Play (K)"}</TooltipContent>
                        </Tooltip>

                         {/* MODIFICAÇÃO: Volume Control Group - Horizontal */}
                        <div
                            className="relative flex items-center"
                            onMouseEnter={handleVolumeAreaMouseEnter}
                            onMouseLeave={handleVolumeAreaMouseLeave}
                        >
                            {/* Volume Button */}
                             <Tooltip>
                                <TooltipTrigger asChild>
                                <Button onClick={toggleMute} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                    <img
                                        src="https://i.ibb.co/0VQwLNMw/botao-de-volume.png"
                                        alt="Volume"
                                        className={cn("object-contain", iconSize, (isMuted || volume === 0) && "opacity-50")}
                                        draggable="false"
                                    />
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent>Mutar (M)</TooltipContent>
                             </Tooltip>
                            {/* Horizontal Volume Slider */}
                            <AnimatePresence>
                                {isVolumeSliderVisible && ( // Usa o novo estado
                                    <motion.div
                                        initial={{ opacity: 0, x: -10, scale: 0.9 }} // Anima da esquerda
                                        animate={{ opacity: 1, x: 0, scale: 1 }}
                                        exit={{ opacity: 0, x: -10, scale: 0.9 }}
                                        transition={{ duration: 0.15 }}
                                        // Posiciona à direita do botão, centralizado verticalmente
                                        className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-zinc-800 rounded-md px-3 py-2 shadow-lg"
                                    >
                                        <Slider
                                            // orientation="horizontal" // Default
                                            value={[volume]}
                                            onValueChange={handleVolumeChange}
                                            max={1}
                                            step={0.01}
                                            // Define largura e altura para horizontal
                                            className="w-20 h-4 flex items-center cursor-pointer"
                                            trackClassName="bg-white/30 h-1.5 w-full rounded-full"
                                            rangeClassName="bg-white h-full rounded-full"
                                            thumbClassName="h-3 w-3 bg-white border-white block"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Time Display */}
                        <div className="flex select-none justify-between text-xs md:text-sm text-white/90 items-center gap-1 ml-1 md:ml-2">
                            <span>{formatTime(currentTime)}</span>
                            <span className="opacity-70">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Center Title (Hidden on Mobile) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden max-w-[calc(100%-240px)] truncate px-4 text-sm text-white/80 md:block">
                        {title}
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-1.5 md:gap-2.5">
                       {/* Chromecast (Placeholder) */}
                       <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center" disabled>
                                    <img
                                        src="https://i.ibb.co/2Yy4Pv04/bot-o-de-chromecast.png"
                                        alt="Cast"
                                        className={cn("object-contain opacity-50", iconSize)} // Dimmed
                                        draggable="false"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Chromecast (Indisponível)</TooltipContent>
                        </Tooltip>

                        {/* Settings */}
                        <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                    <img
                                        src="https://i.ibb.co/W4PKpLj1/botao-de-config.png"
                                        alt="Configurações"
                                        className={cn("object-contain", iconSize)}
                                        draggable="false"
                                    />
                                </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Configurações</TooltipContent>
                            </Tooltip>
                             <PopoverContent
                                className="w-64 border-zinc-700 bg-black/80 p-1 text-white backdrop-blur ring-1 ring-white/10"
                                side="top"
                                align="end"
                                avoidCollisions
                                container={containerRef.current}
                                style={{ zIndex: 2147483647 }}
                             >
                                {/* Popover Content */}
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
                                         <Button variant="ghost" className="h-9 w-full justify-between px-2" onClick={() => setSettingsMenu('quality')}>
                                             <span className="flex items-center gap-2">Qualidade</span>
                                             <span className="flex items-center gap-1 text-white/70">{currentSource.name} <ChevronRight className="h-4 w-4"/></span>
                                         </Button>
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
                                                key={source.url} // Use URL as key, names might not be unique
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

                        {/* PiP */}
                        {pipSupported && (
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={togglePip} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                <img
                                    src="https://i.ibb.co/Jw0ndFSc/picture-in-picture.png"
                                    alt="PiP"
                                    className={cn("object-contain", iconSize, isPipActive && "opacity-70")}
                                    draggable="false"
                                />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Picture-in-Picture (P)</TooltipContent>
                            </Tooltip>
                        )}

                        {/* Fullscreen */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button onClick={toggleFullscreen} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                {isFullscreen ?
                                    <img
                                        src="https://i.ibb.co/bg2F2VFZ/sair-de-tela-cheia.png"
                                        alt="Sair Tela Cheia"
                                        className={cn("object-contain", iconSize)}
                                        draggable="false"
                                    />
                                    :
                                    <img
                                        src="https://i.ibb.co/x8wjGChh/tela-cheia-bot-o.png"
                                        alt="Tela Cheia"
                                        className={cn("object-contain", iconSize)}
                                        draggable="false"
                                    />
                                }
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>Tela Cheia (F)</TooltipContent>
                        </Tooltip>

                         {/* Close Button (Optional) */}
                         {onClose && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Button onClick={onClose} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10">
                                    <X className={smallIconSize} />
                                </Button>
                                </TooltipTrigger>
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
