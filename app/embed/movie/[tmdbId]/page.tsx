// app/embed/movie/[tmdbId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { Loader2, Clapperboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { PlayerOverlay } from '@/components/player-overley';
import VideoPlayer from '@/components/video-player';

type StreamInfo = {
  streams: { url: string; playerType: string }[];
  title: string | null;
  originalTitle: string | null;
  backdropPath: string | null;
};

export default function MovieEmbedPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [mediaInfo, setMediaInfo] = useState<{ title: string; originalTitle?: string; backdropPath: string | null }>({
    title: 'Carregando...',
    backdropPath: null,
  });

  useEffect(() => {
    if (!tmdbId) {
      setError("ID do filme não fornecido.");
      setLoading(false);
      return;
    }

    const fetchMovieData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stream/movies/${tmdbId}`);
        if (!res.ok) {
          throw new Error("Não foi possível obter o link de streaming.");
        }
        
        const data: StreamInfo = await res.json();
        const stream = data.streams?.[0];

        if (stream && stream.playerType === 'custom' && stream.url) {
          setStreamUrl(stream.url);
          setMediaInfo({
            title: data.title || "Filme",
            originalTitle: data.originalTitle || undefined,
            backdropPath: data.backdropPath,
          });
        } else {
          setError("Nenhum link de streaming disponível para este filme.");
        }
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao carregar o filme.");
      } finally {
        setLoading(false);
      }
    };

    fetchMovieData();
  }, [tmdbId]);

  if (loading && showOverlay) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <Clapperboard className="w-16 h-16 text-zinc-700 mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro ao Carregar</h2>
        <p className="text-zinc-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="w-screen h-screen relative bg-black">
      <AnimatePresence>
        {showOverlay && (
          <PlayerOverlay
            title={mediaInfo.title}
            originalTitle={mediaInfo.originalTitle}
            onPlay={() => setShowOverlay(false)}
            isLoading={loading}
            backgroundUrl={mediaInfo.backdropPath}
          />
        )}
      </AnimatePresence>
      
      {streamUrl && !showOverlay && (
        <VideoPlayer
          src={streamUrl}
          title={mediaInfo.title}
          downloadUrl={`/download/movie/${tmdbId}`}
          rememberPosition={true}
          rememberPositionKey={`movie-${tmdbId}`}
        />
      )}
    </main>
  );
}
