// app/embed/tv/[...slug]/page.tsx
"use client"

import { useParams } from 'next/navigation';
import { Loader2, Clapperboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PlayerOverlay } from '@/components/player-overley';

type StreamInfo = {
  streams: { url: string }[];
  title: string | null;
  originalTitle: string | null;
  backdropPath: string | null;
};

export default function TvEmbedPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [tmdbId, season, episode] = slug || [];

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [mediaInfo, setMediaInfo] = useState<{ title: string; originalTitle?: string; backdropPath: string | null }>({
    title: 'Carregando...',
    backdropPath: null,
  });

  useEffect(() => {
    if (!tmdbId || !season || !episode) {
      setError("Informações inválidas para carregar o episódio.");
      setLoading(false);
      return;
    }

    const fetchStream = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stream/series/${tmdbId}/${season}/${episode}`);
        if (!res.ok) {
          throw new Error("Não foi possível obter o link do episódio.");
        }
        
        const data: StreamInfo = await res.json();
        
        if (data.streams && data.streams.length > 0 && data.streams[0].url) {
          setStreamUrl(data.streams[0].url);
          setMediaInfo({
            title: `${data.title || 'Série'} - T${season} E${episode}`,
            originalTitle: data.originalTitle || undefined,
            backdropPath: data.backdropPath,
          });
        } else {
          setError("Nenhum link de streaming disponível para este episódio.");
        }
      } catch (err: any) {
        console.error("Erro ao buscar stream do episódio:", err);
        setError(err.message || "Ocorreu um erro ao carregar o episódio.");
      } finally {
        setLoading(false);
      }
    };

    fetchStream();
  }, [tmdbId, season, episode]);

  const handlePlayButtonClick = () => {
    setShowOverlay(false);
  };
  
  if (loading && showOverlay) {
    return (
        <main className="w-screen h-screen flex items-center justify-center bg-black">
            <Loader2 className="w-12 h-12 animate-spin text-white" />
        </main>
    )
  }

  if (error) {
    return (
        <main className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
            <Clapperboard className="w-16 h-16 text-zinc-700 mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro ao Carregar</h2>
            <p className="text-zinc-400">{error}</p>
        </main>
    )
  }

  return (
    <main className="w-screen h-screen relative bg-black">
      <AnimatePresence>
        {showOverlay && (
          <PlayerOverlay
            title={mediaInfo.title}
            originalTitle={mediaInfo.originalTitle}
            onPlay={handlePlayButtonClick}
            isLoading={loading}
            backgroundUrl={mediaInfo.backdropPath}
          />
        )}
      </AnimatePresence>
      
      {streamUrl && !showOverlay && (
          <iframe
              src={streamUrl}
              title="PrimeVicio Player"
              className="h-full w-full"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              frameBorder="0"
              scrolling="no"
          ></iframe>
      )}
    </main>
  );
}