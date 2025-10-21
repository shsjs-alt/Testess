// app/embed/tv/[...slug]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import VideoPlayer from '@/components/video-player';

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

  useEffect(() => {
    if (!tmdbId || !season || !episode) {
      setError("Informações inválidas para carregar a série.");
      return;
    }

    const fetchTvData = async () => {
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
  
  return (
    <main className="w-screen h-screen relative bg-black">
      {/* MODIFICAÇÃO: O spinner de carregamento da página foi removido. */}
      {error && (
        <div className="w-full h-full flex items-center justify-center text-center p-4">
          <p className="text-zinc-400">{error}</p>
        </div>
      )}
      {streamInfo && (
        <VideoPlayer
          sources={streamInfo.streams}
          title={streamInfo.title || `S${season} E${episode}`}
          downloadUrl={`/download/series/${tmdbId}/${season}/${episode}`}
          rememberPosition={true}
          rememberPositionKey={`tv-${tmdbId}-s${season}-e${episode}`}
          hasNextEpisode={!!streamInfo.nextEpisode}
          onNextEpisode={handleNextEpisode}
        />
      )}
    </main>
  );
}