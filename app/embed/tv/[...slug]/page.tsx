// app/embed/tv/[...slug]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import VideoPlayer from '@/components/video-player';
import { Loader2 } from 'lucide-react';

type Stream = {
  url: string;
  name: string;
  thumbnailUrl?: string;
}

type StreamInfo = {
  streams: Stream[];
  title: string | null;
  nextEpisode?: { season: number; episode: number } | null;
};

export default function TvEmbedPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [tmdbId, season, episode] = slug || [];

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tmdbId || !season || !episode) {
      setError("Informações inválidas para carregar a série.");
      setLoading(false);
      return;
    }

    const fetchTvData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stream/series/${tmdbId}/${season}/${episode}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Episódio não encontrado.");
        }
        
        const data: StreamInfo = await res.json();

        if (data.streams && data.streams.length > 0 && data.streams[0].url) {
          setStreamInfo(data);
        } else {
          setError("Nenhum link de streaming disponível para este episódio.");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTvData();
  }, [tmdbId, season, episode]);
  
  const handleNextEpisode = () => {
    if (streamInfo?.nextEpisode) {
        const { season: nextSeason, episode: nextEpisode } = streamInfo.nextEpisode;
        window.location.href = `/embed/tv/${tmdbId}/${nextSeason}/${nextEpisode}`;
    }
  };

  // Se estiver carregando, mostra uma animação simples
  if (loading) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </main>
    );
  }

  // Se deu erro, mostra a mensagem de erro
  if (error) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black text-center p-4">
        <p className="text-zinc-400">{error}</p>
      </main>
    );
  }

  // Se encontrou as informações, renderiza o player diretamente
  if (streamInfo) {
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          sources={streamInfo.streams}
          title={streamInfo.title || `S${season} E${episode}`}
          downloadUrl={`/download/series/${tmdbId}/${season}/${episode}`}
          rememberPosition={true}
          rememberPositionKey={`tv-${tmdbId}-s${season}-e${episode}`}
          hasNextEpisode={!!streamInfo.nextEpisode}
          onNextEpisode={handleNextEpisode}
        />
      </main>
    );
  }

  // Fallback caso algo inesperado aconteça
  return (
    <main className="w-screen h-screen flex items-center justify-center bg-black">
      <p className="text-zinc-400">Não foi possível carregar o player.</p>
    </main>
  );
}