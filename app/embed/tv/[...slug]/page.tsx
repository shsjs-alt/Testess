// app/embed/tv/[...slug]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// --- MODIFICAÇÃO PRINCIPAL ---
const VideoPlayer = dynamic(() => import('@/components/video-player'), {
  loading: () => (
    <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
    </div>
  ),
  ssr: false, 
});

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
  const [isFetchingData, setIsFetchingData] = useState(true);

  useEffect(() => {
    if (!tmdbId || !season || !episode) {
      setError("Informações inválidas para carregar a série.");
      setIsFetchingData(false);
      return;
    }

    const fetchTvData = async () => {
      setIsFetchingData(true);
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
        setIsFetchingData(false);
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
  
  // --- MODIFICAÇÃO DE RENDERIZAÇÃO ---
  if (isFetchingData) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black">
        <img src="https://i.ibb.co/fVcZxsvM/1020.gif" alt="Carregando..." className="w-64 h-64" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black text-center p-4">
        <p className="text-zinc-400">{error}</p>
      </main>
    );
  }

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

  return null;
}