// components/video-player.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
// ADDED: Needed Lucide icons that remain
import { Play, Pause, RotateCcw, X, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react' // REMOVED: Download
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

// MODIFIED: Added onReady prop
type VideoPlayerProps = {
  sources: StreamSource[]
  title: string
  onClose?: () => void
  rememberPositionKey?: string
  rememberPosition?: boolean
  hasNextEpisode?: boolean
  onNextEpisode?: () => void
  backdropPath?: string | null;
  onReady?: () => void; // ADDED
}

// Componente de Overlay inicial MODIFIED
const PlayerOverlay = ({ onPlay }: { onPlay: () => void }) => {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 cursor-pointer"
      onClick={onPlay}
    >
      <img
        // MODIFIED: New image URLs and reduced size
        src={isHovering ? "https://i.ibb.co/b5GFzpMs/bot-o-de-play-central-aceso.png" : "https://i.ibb.co/8qbZwTV/bot-o-de-play-central.png"}
        alt="Assistir"
        className="h-16 w-16 object-contain pointer-events-auto" // Reduced size
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        draggable="false" // ADDED
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
  onReady, // ADDED
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
  const isTogglingPlay = useRef(false); // Add a ref to track toggle state

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

  const triggerAd = useCallback(() => {
    const adWindow = window.open(adUrl, "_blank");
    if (!adWindow || adWindow.closed || typeof adWindow.closed === 'undefined') {
        return false;
    }
    lastAdTimeRef.current = Date.now();
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    return true;
  }, [adUrl]);

  const handleInitialPlay = () => {
    const adWasSuccessful = triggerAd();
    if (adWasSuccessful) {
        setIsPlayerActive(true);
    } else {
        setIsSandboxed(true);
        setChecking(false);
    }
  };

  const handlePlayerAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if the click is on the play button overlay image
    if ((e.target as HTMLElement).tagName === 'IMG' && (e.target as HTMLElement).closest('.absolute.inset-0.z-20')) {
        return; // Don't toggle play if the initial play button is clicked
    }

    // *** If the click originated within the controls, do nothing here ***
    if ((e.target as HTMLElement).closest('[data-controls]')) {
      // If the click IS on the controls, just let the specific button handler (like fullscreen) do its job.
      // We explicitly DO NOT toggle play or trigger ads here.
      return;
    }

    // --- Ad logic remains below, but now only triggers for clicks OUTSIDE controls ---
    if (lastAdTimeRef.current && Date.now() - lastAdTimeRef.current > adInterval) {
      const adWasSuccessful = triggerAd();
      if (!adWasSuccessful) {
          setIsSandboxed(true);
          return; // Stop if ad failed (pop-up blocked)
      }
       // If ad was successful, don't immediately toggle play, let the user click again if needed.
      return;
    }

    // If no ad was triggered, toggle play/pause
    togglePlay();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource?.url || !isPlayerActive) return;

    setError(null); // *** CLEAR ERROR WHEN SOURCE CHANGES ***

    const savedTime = video.currentTime > 1 ? video.currentTime : 0;

    video.src = currentSource.url;

    const handleCanPlay = () => {
      if (video.currentTime < savedTime) {
        video.currentTime = savedTime;
      }
      // Don't automatically play here, let user interaction handle it or handleCanPlay signal readiness
      // video.play().catch(handleError);
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
  }, [currentSource, isPlayerActive]); // Keep isPlayerActive dependency

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
    // Don't hide if settings are open
    if (!isSettingsOpen) {
       setShowControls(false);
    }
  }, [isSettingsOpen]); // Depend on isSettingsOpen

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    // Only set timeout if player is active and not showing the next episode overlay
    if (isPlayerActive && !showNextEpisodeOverlay) {
        controlsTimeoutRef.current = setTimeout(hideControls, 3500);
    }
  }, [hideControls, isPlayerActive, showNextEpisodeOverlay]); // Add dependencies

  useEffect(() => {
    if (!isPlayerActive) return;
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", resetControlsTimeout);
      container.addEventListener("mouseleave", hideControls);
      container.addEventListener("touchstart", resetControlsTimeout, { passive: true });
    }
    // Initial call to set the timeout
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (container) {
        container.removeEventListener("mousemove", resetControlsTimeout);
        container.removeEventListener("mouseleave", hideControls);
        container.removeEventListener("touchstart", resetControlsTimeout);
      }
    };
  }, [isPlayerActive, resetControlsTimeout, hideControls]); // Ensure dependencies are correct

  useEffect(() => {
    if (!isSettingsOpen) {
      const timer = setTimeout(() => setSettingsMenu('main'), 150);
      return () => clearTimeout(timer);
    } else {
        // Keep controls visible while settings are open
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
    }
  }, [isSettingsOpen]);


  const triggerNextEpisodeOverlay = useCallback(() => {
    if (endingTriggered || !isAutoplayEnabled || !hasNextEpisode || !onNextEpisode) return;
    setEndingTriggered(true);
    setShowNextEpisodeOverlay(true);
    setCountdown(5);
    // Keep controls visible when overlay shows
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
  }, [endingTriggered, isAutoplayEnabled, hasNextEpisode, onNextEpisode]);


  const handleLoadStart = () => {
    if (!isPlayerActive) return;
    setIsLoading(true)
    setError(null)
  }

  const handleCanPlay = () => {
    if (!videoRef.current) return; // Ensure videoRef is available
    setIsLoading(false);
    setIsBuffering(false);

    // *** Signal readiness HERE ***
    onReady?.();

    const v = videoRef.current;
    if (v && showContinueWatching && rememberPosition) {
        const savedPos = localStorage.getItem(positionKey)
        const n = Number.parseFloat(savedPos || '0');
        if (!Number.isNaN(n) && n > 5) {
            v.currentTime = n;
        }
        // Don't auto-play here, let user click "Continue" or "Restart"
        setShowContinueWatching(true); // Ensure overlay shows if needed
    } else if (v && isPlaying) {
       // If not showing continue watching and was supposed to be playing (e.g., after source change)
       v.play().catch(handleError);
    }
  }

  // Use handleError for consistency
   const handleError = () => {
    setIsLoading(false)
    setIsBuffering(false)
    setError("Não foi possível carregar o vídeo.") // Centralized error message
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    setCurrentTime(currentTime);
    if (duration > 0 && duration - currentTime < 10 && !endingTriggered && hasNextEpisode) { // Check hasNextEpisode
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
    // Only trigger overlay if there IS a next episode
    if(hasNextEpisode){
        triggerNextEpisodeOverlay();
    }
    setIsPlaying(false)
  };

  const handlePlayNext = useCallback(() => {
    setShowNextEpisodeOverlay(false);
    onNextEpisode?.();
  }, [onNextEpisode]);

  const handleCancelAutoplay = () => {
    setShowNextEpisodeOverlay(false);
    setShowControls(true) // Ensure controls are visible after cancelling
    if (videoRef.current) {
      // Set time slightly before the end to prevent immediate re-triggering
      videoRef.current.currentTime = Math.max(0, videoRef.current.duration - 0.1);
    }
     // Restart controls timeout
    resetControlsTimeout();
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
    } else {
        // Clear interval if overlay is hidden
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
    }
    return () => { if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); } };
  }, [showNextEpisodeOverlay, handlePlayNext]);

  const togglePlay = useCallback(async () => {
    if (isTogglingPlay.current) return;

    const v = videoRef.current;
    if (!v) return;

    isTogglingPlay.current = true;

    try {
      if (v.paused) {
        await v.play();
         if (error) setError(null); // Clear error on successful play
      } else {
        v.pause();
      }
     
    } catch (e) {
      console.error("Play/Pause error:", e);
      handleError();
    } finally {
      setTimeout(() => {
         isTogglingPlay.current = false;
      }, 100);
    }
  }, [error]); // Add error dependency

  const seek = useCallback((amount: number) => {
    const v = videoRef.current
    if (!v || !Number.isFinite(v.duration)) return; // Check duration validity
    // Ensure duration is positive before seeking
    const validDuration = Math.max(0, duration || v.duration || 0);
    v.currentTime = Math.min(Math.max(0, v.currentTime + amount), validDuration)
    setShowSeekHint({ dir: amount > 0 ? "fwd" : "back", by: Math.abs(amount) })
    // Use requestAnimationFrame to clear hint smoothly after render
    requestAnimationFrame(() => {
        setTimeout(() => setShowSeekHint(null), 700)
    });
    // Reset controls timeout on seek
    resetControlsTimeout();
  }, [duration, resetControlsTimeout])

  const handleSeekSlider = (value: number[]) => {
    const v = videoRef.current
    if (!v || !Number.isFinite(v.duration)) return;
    const newTime = Math.min(Math.max(0, value[0]), Math.max(0, duration || v.duration || 0));
    v.currentTime = newTime;
    setCurrentTime(newTime);
     // Reset controls timeout when user interacts with slider
    resetControlsTimeout();
  }

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const newMuted = !v.muted
    v.muted = newMuted
    setIsMuted(newMuted)
    if (!newMuted && v.volume === 0) {
      const newVolume = 0.5; // Default volume if unmuting from 0
      v.volume = newVolume
      setVolume(newVolume)
       try { localStorage.setItem(volumeKey, String(newVolume)) } catch { }
    } else if (newMuted) {
       setVolume(0); // Reflect mute state in volume state
    } else {
       setVolume(v.volume); // Update volume state if unmuting normally
    }
     // Reset controls timeout on mute toggle
    resetControlsTimeout();
  }, [resetControlsTimeout]) // Add dependency

  const handleVolumeChange = (value: number[]) => {
    const v = videoRef.current
    if (!v) return
    const newVolume = value[0]
    v.volume = newVolume
    v.muted = newVolume === 0; // Automatically mute/unmute based on slider
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    try { localStorage.setItem(volumeKey, String(newVolume)) } catch { }
     // Reset controls timeout on volume change
    resetControlsTimeout();
  }

  const handleVolumeMouseEnter = () => {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    setIsVolumeOpen(true);
     // Keep controls visible when interacting with volume
     if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
     setShowControls(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeTimeoutRef.current = setTimeout(() => {
        setIsVolumeOpen(false);
        // Restart controls timeout when mouse leaves volume control
        resetControlsTimeout();
    }, 1500);
  };

  const toggleFullscreen = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // *** REMOVED ad trigger logic from here ***

    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      resetControlsTimeout(); // Reset timeout after action
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        try {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            await screen.orientation.lock('landscape');
          }
        } catch (e) {
          console.warn("Falha ao travar a orientação de tela:", e);
        }
      } else {
        await document.exitFullscreen();
         try {
             if (screen.orientation && typeof screen.orientation.unlock === 'function') {
                screen.orientation.unlock();
             }
        } catch (e) {
             console.warn("Falha ao destravar a orientação de tela:", e);
        }
      }
      resetControlsTimeout(); // Reset timeout after action
    } catch (err) {
      console.error("Erro ao gerenciar fullscreen:", err);
    }
  }, [resetControlsTimeout]); // Add dependency

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
       // Reset controls timeout on fullscreen change
      resetControlsTimeout();
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
  }, [resetControlsTimeout]); // Add dependency

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return
    videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
    setSettingsMenu('main');
    resetControlsTimeout(); // Reset timeout
  }

  const changeQuality = (source: StreamSource) => {
      if(currentSource.url !== source.url){
          setError(null); // Clear error when changing quality
          setIsLoading(true); // Show loading spinner
          setCurrentSource(source);
      }
      setSettingsMenu('main');
      resetControlsTimeout(); // Reset timeout
  }

  const toggleAutoplay = () => {
    setIsAutoplayEnabled(prev => {
      const newState = !prev;
      try { localStorage.setItem(autoplayKey, JSON.stringify(newState)); } catch (e) { /* no-op */ }
      return newState;
    });
     resetControlsTimeout(); // Reset timeout
  };

  const togglePip = useCallback(async () => {
    const v = videoRef.current
    if (!v || !document.pictureInPictureEnabled) return
    try {
      if (document.pictureInPictureElement) { await (document as any).exitPictureInPicture() }
      else { await (v as any).requestPictureInPicture() }
      resetControlsTimeout(); // Reset timeout
    } catch (e) { console.error("Erro no PIP", e) }
  }, [resetControlsTimeout]) // Add dependency

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onEnterPip = () => {
        setIsPipActive(true);
        resetControlsTimeout(); // Reset timeout on entering PIP
    }
    const onLeavePip = () => {
        setIsPipActive(false);
        resetControlsTimeout(); // Reset timeout on leaving PIP
    }
    v.addEventListener("enterpictureinpicture", onEnterPip as any)
    v.addEventListener("leavepictureinpicture", onLeavePip as any)
    return () => {
      v.removeEventListener("enterpictureinpicture", onEnterPip as any)
      v.removeEventListener("leavepictureinpicture", onLeavePip as any)
    }
  }, [resetControlsTimeout]) // Add dependency

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return "00:00" // Handle invalid times
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    const mm = String(minutes).padStart(2, "0")
    const ss = String(seconds).padStart(2, "0")
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
  }

  const retry = () => {
    setError(null); // Clear error immediately
    setIsLoading(true);
    const video = videoRef.current;
    if (video) {
        const url = new URL(currentSource.url);
        url.searchParams.set('retry_timestamp', Date.now().toString()); // Add cache buster
        const newSrc = url.toString();

        // Pause, clear src, load, set new src, load, then play
        video.pause();
        video.removeAttribute('src'); // Fully remove source
        video.load(); // Request load without source
        setTimeout(() => { // Short delay before setting new source
            video.src = newSrc;
            video.load(); // Request load with new source
            video.play().catch(e => {
              console.warn("Retry play failed", e)
              handleError(); // Use consistent error handler
            });
        }, 100); // 100ms delay
    }
     resetControlsTimeout(); // Reset timeout
  }


  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPlayerActive) return;
      const activeElement = document.activeElement;
      // Ignore keydown if focus is on interactive elements like sliders or inputs
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.getAttribute("role") === "slider")) return;

      // Prevent default for keys we handle to stop browser actions (like space scrolling)
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
        case 'f':
        case 'm':
        case 'p':
        case 'arrowright':
        case 'arrowleft':
        case 'arrowup':
        case 'arrowdown':
          e.preventDefault();
          break;
        default:
          // Allow other keys (like numbers for seeking, if implemented later)
          break;
      }

      // Handle spacebar press (hold for speed, tap for play/pause)
      if (e.key === ' ' && !e.repeat) {
        if (isSpeedingUpRef.current) return; // Prevent re-triggering speed-up
        // Set timeout to detect hold vs tap
        spacebarDownTimer.current = setTimeout(() => {
          if (videoRef.current && isPlaying) {
            isSpeedingUpRef.current = true;
            originalRateRef.current = videoRef.current.playbackRate;
            videoRef.current.playbackRate = 2.0;
            setPlaybackRate(2.0); // Update state to reflect speed change
            setShowSpeedHint(true); // Show visual indicator
             resetControlsTimeout(); // Keep controls visible during speedup
          }
        }, 200); // 200ms threshold for hold
      }

      // Handle other key presses
       switch (e.key.toLowerCase()) {
        case "k": togglePlay(); break;
        case "f": toggleFullscreen(); break;
        case "m": toggleMute(); break;
        case "p": togglePip(); break;
        case "arrowright": seek(10); break;
        case "arrowleft": seek(-10); break;
        case "arrowup": handleVolumeChange([Math.min(1, volume + 0.1)]); break;
        case "arrowdown": handleVolumeChange([Math.max(0, volume - 0.1)]); break;
      }
      // Always reset controls timeout on valid key press
      resetControlsTimeout();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isPlayerActive) return;
      // Ignore if focus is on interactive elements
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.getAttribute("role") === "slider")) return;

      if (e.key === ' ') {
        e.preventDefault();
        // Clear the hold timer
        if (spacebarDownTimer.current) {
          clearTimeout(spacebarDownTimer.current);
          spacebarDownTimer.current = null;
          // If speed up wasn't activated, it was a tap -> toggle play
          if (!isSpeedingUpRef.current) { togglePlay(); }
        }
        // If speed up WAS active, revert speed
        if (isSpeedingUpRef.current) {
          if (videoRef.current) { videoRef.current.playbackRate = originalRateRef.current; }
          setPlaybackRate(originalRateRef.current); // Update state
          setShowSpeedHint(false); // Hide indicator
          isSpeedingUpRef.current = false;
        }
         // Reset controls timeout on key up as well
        resetControlsTimeout();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (spacebarDownTimer.current) clearTimeout(spacebarDownTimer.current);
    };
  }, [isPlayerActive, volume, togglePlay, toggleFullscreen, toggleMute, togglePip, seek, isPlaying, resetControlsTimeout, handleVolumeChange]); // Added dependencies


  const onProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !progressWrapRef.current || !videoRef.current || !Number.isFinite(videoRef.current.duration) || videoRef.current.duration <= 0) {
        setHoverTime(null);
        return;
    };
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const time = (duration || videoRef.current.duration) * pct;
    setHoverTime(time);

     // Update thumbnail video time if available and ready
    if (thumbnailVideoRef.current && currentSource.thumbnailUrl && thumbnailVideoRef.current.readyState >= 2) { // readyState >= 2 means metadata loaded
      thumbnailVideoRef.current.currentTime = time;
    }
     // Keep controls visible while hovering progress bar
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
  };

  const onProgressLeave = () => {
    setHoverTime(null);
     // Restart controls timeout when leaving progress bar
    resetControlsTimeout();
  };

  const onMobileTap = (side: 'left' | 'right' | 'center') => {
    if (!isPlayerActive) return;
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current.time < 350 && lastTapRef.current.side === side;

    if (isDoubleTap) {
        if (side === 'left') seek(-10);
        else if (side === 'right') seek(10);
        // Only toggle play on center double tap if needed, otherwise single tap handles it
        // else togglePlay();
        lastTapRef.current = { time: 0, side: 'center' }; // Reset after double tap
    } else {
        if(side === 'center') {
            // Toggle controls visibility on single center tap
            setShowControls(s => !s);
            // If hiding controls, clear timeout, otherwise reset it
            if(showControls && controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            else if (!showControls) resetControlsTimeout();
        }
        // Store tap time and side for double tap detection
        lastTapRef.current = { time: now, side };
    }
  };

  const handleTouchStart = (side: 'left' | 'right') => { // Specify side
    if (!isPlayerActive) return;
    // Clear any previous timeout
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

    holdTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && isPlaying) {
        originalRateRef.current = videoRef.current.playbackRate
        videoRef.current.playbackRate = 2
        setShowSpeedHint(true)
         // Keep controls visible during hold
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
      }
    }, 500) // 500ms threshold for hold
  }

  const handleTouchEnd = () => {
    if (!isPlayerActive) return;
    // Clear the hold timeout if it exists
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    // If speed was increased, revert it
    if (videoRef.current && videoRef.current.playbackRate === 2) {
      videoRef.current.playbackRate = originalRateRef.current
      setShowSpeedHint(false)
    }
    // Restart controls timeout on touch end
    resetControlsTimeout();
  }

  const handleContinue = () => {
    setShowContinueWatching(false)
    if (videoRef.current) {
      videoRef.current.play().catch(handleError); // Play and handle potential errors
    }
    resetControlsTimeout(); // Reset timeout
  }

  const handleRestart = () => {
    setShowContinueWatching(false)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(handleError); // Play and handle potential errors
    }
     resetControlsTimeout(); // Reset timeout
  }


  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  const hoverLeft =
    hoverTime !== null && duration > 0 && progressWrapRef.current
      ? Math.min(1, Math.max(0, hoverTime / duration)) * (progressWrapRef.current.clientWidth || 0)
      : 0

  const bufferPercentage = duration > 0 && Number.isFinite(duration) ? (bufferedEnd / duration) * 100 : 0; // Check duration validity

  const currentSpeedLabel = playbackRate === 1 ? "Normal" : `${playbackRate}x`;

  // Define icon size classes - MODIFIED to be slightly larger
  const iconSize = "max-h-[20px] max-w-[20px] md:max-h-[22px] md:max-w-[22px]"; // Adjusted sizes
  const smallIconSize = "max-h-[16px] max-w-[16px] md:max-h-[18px] md:max-w-[18px]"; // Adjusted sizes


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
          "relative w-full h-full bg-black overflow-hidden group select-none video-player-container", // Use relative for container
          isPlaying && !showControls && !showNextEpisodeOverlay && isPlayerActive && !isSettingsOpen && "cursor-none" // Hide cursor condition
        )}
        onDoubleClick={toggleFullscreen} // Double click toggles fullscreen
        style={{ transform: 'translateZ(0)' }} // Promote to composite layer
      >
        {backdropPath && !isPlayerActive && ( // Show backdrop only initially
            <Image
                src={`https://image.tmdb.org/t/p/w1280${backdropPath}`}
                alt={title}
                layout="fill"
                objectFit="cover"
                className="absolute inset-0 opacity-40 blur-sm z-0" // Ensure z-index is low
                priority
            />
        )}
        <video
          ref={videoRef}
          className={cn(
            "h-full w-full object-contain transition-opacity duration-300", // Smooth transition
            isPlayerActive ? "opacity-100 z-10" : "opacity-0 z-0" // Control opacity and z-index
          )}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay} // This signals readiness
          onPlaying={() => { setIsPlaying(true); setIsBuffering(false); }} // Update both states
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onError={handleError}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata" // Request browser to load metadata
          playsInline // Important for mobile browsers
          // poster={backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : undefined} // Optional: use backdrop as poster
        />
        {/* Thumbnail Video (Hidden) */}
         {currentSource.thumbnailUrl && (
          <video
            ref={thumbnailVideoRef}
            src={currentSource.thumbnailUrl}
            className="pointer-events-none absolute bottom-0 left-0 opacity-0 w-1 h-1" // Keep minimal size but present
            preload="auto" // Load thumbnails when possible
            muted
            playsInline
            crossOrigin="anonymous" // If thumbnails are on a different domain
          />
        )}

        {(isLoading || isBuffering) && isPlayerActive && !error && ( // Don't show if error occurred
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
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 p-4" // Higher z-index for error
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

        {showContinueWatching && isPlayerActive && !error && (
          <div
            style={{ transform: 'translateZ(0)' }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70" // High z-index
          >
            <p className="text-white text-lg mb-4">Continuar de onde parou?</p>
            <div className="flex gap-4">
              <Button onClick={handleContinue} className="bg-white text-black hover:bg-zinc-200">Sim</Button>
              <Button onClick={handleRestart} variant="secondary">Reiniciar</Button>
            </div>
          </div>
        )}

         <AnimatePresence>
            {showSeekHint && isPlayerActive && (
             <motion.div
                key={showSeekHint.dir + showSeekHint.by} // Key helps animation restart
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                style={{ transform: 'translateZ(0)' }}
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
                <div className="rounded-full bg-black/60 px-3 py-1 text-sm text-white ring-1 ring-white/10">
                {showSeekHint.dir === "fwd" ? `+${showSeekHint.by}s` : `-${showSeekHint.by}s`}
                </div>
            </motion.div>
            )}
        </AnimatePresence>


        <AnimatePresence>
          {showSpeedHint && isPlayerActive && (
            <motion.div
              style={{ transform: 'translateZ(0)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <div className="rounded-full bg-black/60 px-4 py-2 text-lg font-bold text-white ring-1 ring-white/10">
                2x
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showNextEpisodeOverlay && isPlayerActive && hasNextEpisode && ( // Only show if hasNextEpisode
            <motion.div
              style={{ transform: 'translateZ(0)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90" // Highest z-index
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

        {/* Mobile tap zones */}
        <div className="absolute inset-0 z-10 flex md:hidden"> {/* Lower z-index than controls */}
            <div
                className="flex-1"
                onClick={() => onMobileTap('left')}
                onTouchStart={() => handleTouchStart('left')} // Pass side
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd} // Handle touch cancel as well
            />
            <div
                className="w-1/3" // Center zone doesn't need touch hold
                onClick={() => onMobileTap('center')}
            />
            <div
                className="flex-1"
                onClick={() => onMobileTap('right')}
                 onTouchStart={() => handleTouchStart('right')} // Pass side
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd} // Handle touch cancel
            />
        </div>

        {/* Controls */}
        <AnimatePresence>
        {isPlayerActive && ( // Only render controls container when player is active
            <motion.div
                // Animate controls in/out smoothly
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: (showControls && !showNextEpisodeOverlay && !showContinueWatching) ? 1 : 0, y: (showControls && !showNextEpisodeOverlay && !showContinueWatching) ? 0 : 20 }} // Control animation based on state
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                data-controls // Keep this attribute
                style={{ transform: 'translateZ(0)' }} // Promote layer
                className={cn(
                    "absolute inset-x-0 bottom-0 z-20 px-2 pb-2 md:bottom-4 md:px-4", // Higher z-index
                     // Apply visibility and pointer events based on animation state
                    (showControls && !showNextEpisodeOverlay && !showContinueWatching) ? "visible pointer-events-auto" : "invisible pointer-events-none",
                    // Remove gradient background
                    "pt-10" // Keep padding for spacing if needed
                )}
                 // Prevent clicks within controls from bubbling up to handlePlayerAreaClick
                onClick={(e) => e.stopPropagation()}
            >
                {/* Progress Bar */}
                <div
                    ref={progressWrapRef}
                    onMouseMove={onProgressMouseMove}
                    onMouseLeave={onProgressLeave}
                     // Ensure correct height for interaction area
                    className="group/progress relative mb-2 cursor-pointer h-2 group-hover/progress:h-2.5 transition-[height] duration-200"
                >
                    {/* Thumbnail Preview */}
                    <div
                        className="absolute bottom-full mb-2 -translate-x-1/2 rounded bg-black/80 backdrop-blur-sm text-white text-xs ring-1 ring-white/10 shadow-lg" // Added shadow
                        style={{
                            left: hoverLeft,
                            visibility: hoverTime !== null && duration > 0 ? 'visible' : 'hidden',
                            opacity: hoverTime !== null && duration > 0 ? 1 : 0,
                            transition: 'opacity 0.1s linear, visibility 0.1s linear', // Smooth transition
                        }}
                    >
                        {/* Canvas for Thumbnail */}
                        {currentSource.thumbnailUrl && thumbnailVideoRef.current && (
                            <canvas
                                ref={canvasRef => {
                                if (canvasRef && thumbnailVideoRef.current && hoverTime !== null) {
                                    const ctx = canvasRef.getContext('2d');
                                    const video = thumbnailVideoRef.current;
                                    if (ctx && video.videoWidth > 0 && video.readyState >= 2) {
                                    const aspectRatio = video.videoWidth / video.videoHeight;
                                    canvasRef.width = 144;
                                    canvasRef.height = Math.max(1, 144 / aspectRatio);
                                    try {
                                        ctx.drawImage(video, 0, 0, canvasRef.width, canvasRef.height);
                                    } catch (e) {
                                        console.error("Error drawing thumbnail canvas:", e)
                                    }
                                    } else {
                                        // Optionally clear or show a placeholder if video not ready
                                        // ctx?.clearRect(0, 0, canvasRef.width, canvasRef.height);
                                    }
                                }
                                }}
                                className="aspect-video w-36 rounded-t bg-black" // Consistent width
                            />
                        )}
                         {/* Timestamp */}
                        <span className="block px-2 py-1">{formatTime(hoverTime ?? 0)}</span>
                    </div>

                    {/* Slider Container */}
                     <div className="absolute inset-0 flex items-center">
                        {/* Background Track */}
                        <div className="absolute top-1/2 -translate-y-1/2 h-1 group-hover/progress:h-1.5 w-full bg-white/20 rounded-full"/>
                        {/* Buffer Track */}
                        <div className="absolute top-1/2 -translate-y-1/2 h-1 group-hover/progress:h-1.5 bg-white/50 rounded-full transition-[width]" style={{ width: `${bufferPercentage}%` }} />
                        {/* Progress Slider */}
                        <Slider
                            value={[Math.min(currentTime, duration || 0)]}
                            max={duration || 1} // Use 1 as max if duration is 0 to prevent errors
                            step={0.1}
                            onValueChange={handleSeekSlider}
                            className="absolute w-full inset-0 h-full"
                            trackClassName="bg-transparent h-full"
                            rangeClassName="bg-white h-1 group-hover/progress:h-1.5 absolute top-1/2 -translate-y-1/2 transition-[height]" // White range
                            thumbClassName="bg-white border-white h-2.5 w-2.5 md:h-3 md:w-3 group-hover/progress:opacity-100 opacity-0 transition-opacity block ring-0 focus-visible:ring-2 focus-visible:ring-offset-0" // White thumb, manage opacity
                        />
                    </div>
                </div>

                {/* Control Buttons Bar */}
                <div className="flex items-center justify-between">
                     {/* Left Controls */}
                    <div className="flex items-center gap-1 md:gap-2"> {/* Slightly reduced gap */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button onClick={togglePlay} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                {/* Play/Pause icons using images */}
                                {isPlaying ?
                                    <img src="https://i.ibb.co/fdgFF2VK/despause-pequeno-bot-o.png" alt="Pause" className={cn("object-contain", iconSize)} draggable="false" />
                                    :
                                    <img src="https://i.ibb.co/chY4zZLj/bot-o-de-play-central.png" alt="Play" className={cn("object-contain", iconSize)} draggable="false" />
                                }
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isPlaying ? "Pausar (K)" : "Play (K)"}</TooltipContent>
                        </Tooltip>

                        {/* Volume Control */}
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
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-zinc-800/90 rounded-md p-1 flex items-center justify-center backdrop-blur-sm ring-1 ring-white/10 w-8 h-[100px]"
                                >
                                    <Slider
                                        orientation="vertical"
                                        value={[isMuted ? 0 : volume]}
                                        max={1}
                                        step={0.05}
                                        onValueChange={handleVolumeChange}
                                        className="w-1.5 h-full"
                                        trackClassName="bg-zinc-600 w-full"
                                        rangeClassName="bg-white w-full"
                                        thumbClassName="bg-white border-none h-3 w-3 block ring-0 focus-visible:ring-offset-0" // Simplified thumb
                                    />
                                </motion.div>
                            )}
                            </AnimatePresence>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={toggleMute} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                <img src="https://i.ibb.co/0VQwLNMw/botao-de-volume.png" alt="Volume" className={cn("object-contain", iconSize, (isMuted || volume === 0) && "opacity-50")} draggable="false" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isMuted || volume === 0 ? 'Ativar Som (M)' : 'Mutar (M)'}</TooltipContent>
                            </Tooltip>
                        </div>

                        {/* Time Display */}
                        <div className="flex select-none justify-between text-xs md:text-sm text-white/90 items-center gap-1 tabular-nums"> {/* Use tabular-nums */}
                            <span>{formatTime(currentTime)}</span>
                            <span className="opacity-70">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Center Title (hidden on small screens) */}
                    <div className="pointer-events-none absolute left-1/2 hidden max-w-[calc(100%-300px)] -translate-x-1/2 truncate px-4 text-sm text-white/80 md:block"> {/* Limit width */}
                        {title}
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-1 md:gap-2"> {/* Slightly reduced gap */}
                        {/* Chromecast Button */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center" onClick={() => {/* TODO */}}>
                                <img src="https://i.ibb.co/2Yy4Pv04/bot-o-de-chromecast.png" alt="Cast" className={cn("object-contain", iconSize)} draggable="false" />
                            </Button>
                            </TooltipTrigger>
                            <TooltipContent>Chromecast</TooltipContent>
                        </Tooltip>

                        {/* Settings Button */}
                        <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                    <img src="https://i.ibb.co/W4PKpLj1/botao-de-config.png" alt="Configurações" className={cn("object-contain", iconSize)} draggable="false" />
                                </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Configurações</TooltipContent>
                            </Tooltip>
                            <PopoverContent
                            className="w-64 border-zinc-700 bg-black/80 p-1 text-white backdrop-blur ring-1 ring-white/10 shadow-xl" // Added shadow
                            side="top"
                            align="end"
                            // Prevent focus trap issues by ensuring content renders within the player container if possible
                             container={containerRef.current}
                            style={{ zIndex: 2147483647 }} // High z-index if needed
                            onOpenAutoFocus={(e) => e.preventDefault()} // Prevent stealing focus initially
                            onCloseAutoFocus={(e) => e.preventDefault()} // Prevent focus jump on close
                            >
                               {settingsMenu === 'main' && (
                                    <div className="flex flex-col gap-0.5"> {/* Reduced gap */}
                                        {hasNextEpisode && (
                                            <div className="flex items-center justify-between h-9 w-full px-2 hover:bg-white/10 rounded-sm"> {/* Hover effect */}
                                                <Label htmlFor="autoplay-switch" className="text-sm font-normal flex items-center gap-2 cursor-pointer">Próximo ep. automático</Label>
                                                <Switch
                                                id="autoplay-switch"
                                                checked={isAutoplayEnabled}
                                                onCheckedChange={toggleAutoplay}
                                                className="data-[state=checked]:bg-white data-[state=unchecked]:bg-zinc-600 h-5 w-9 [&>span]:h-4 [&>span]:w-4" // Custom styling
                                                />
                                            </div>
                                        )}
                                        <Button variant="ghost" className="h-9 w-full justify-between px-2 text-sm font-normal" onClick={() => setSettingsMenu('playbackRate')}>
                                            <span className="flex items-center gap-2">Velocidade</span>
                                            <span className="flex items-center gap-1 text-white/70">{currentSpeedLabel} <ChevronRight className="h-4 w-4"/></span>
                                        </Button>
                                        {sources && sources.length > 1 && (
                                            <Button variant="ghost" className="h-9 w-full justify-between px-2 text-sm font-normal" onClick={() => setSettingsMenu('quality')}>
                                                <span className="flex items-center gap-2">Qualidade</span>
                                                <span className="flex items-center gap-1 text-white/70">{currentSource.name} <ChevronRight className="h-4 w-4"/></span>
                                            </Button>
                                        )}
                                    </div>
                                )}
                                {settingsMenu === 'quality' && (
                                    <div>
                                        <Button variant="ghost" className="h-9 w-full justify-start px-2 mb-1 text-sm font-normal" onClick={() => setSettingsMenu('main')}>
                                            <ChevronLeft className="h-4 w-4 mr-2"/>
                                            Qualidade
                                        </Button>
                                        <div className="flex flex-col gap-0.5"> {/* Reduced gap */}
                                            {sources.map((source) => (
                                            <Button
                                                key={source.url}
                                                variant="ghost"
                                                className="h-9 w-full justify-start pl-8 pr-2 relative text-sm font-normal" // Consistent styling
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
                                        <Button variant="ghost" className="h-9 w-full justify-start px-2 mb-1 text-sm font-normal" onClick={() => setSettingsMenu('main')}>
                                            <ChevronLeft className="h-4 w-4 mr-2"/>
                                            Velocidade
                                        </Button>
                                        <div className="flex flex-col gap-0.5"> {/* Reduced gap */}
                                            {playbackRates.map((r) => (
                                            <Button
                                                key={r}
                                                variant="ghost"
                                                className="h-9 w-full justify-start pl-8 pr-2 relative text-sm font-normal" // Consistent styling
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

                        {/* Picture in Picture Button */}
                        {pipSupported && (
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={togglePip} size="icon" variant="ghost" className="h-9 w-9 md:h-10 md:w-10 text-white hover:bg-white/10 flex items-center justify-center">
                                <img src="https://i.ibb.co/Jw0ndFSc/picture-in-picture.png" alt="PiP" className={cn("object-contain", iconSize, isPipActive && "opacity-70")} draggable="false" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Picture-in-Picture (P)</TooltipContent>
                            </Tooltip>
                        )}

                        {/* Fullscreen Button */}
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
                            <TooltipContent>{isFullscreen ? 'Sair Tela Cheia (F)' : 'Tela Cheia (F)'}</TooltipContent>
                        </Tooltip>

                         {/* Close Button (Conditional) */}
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