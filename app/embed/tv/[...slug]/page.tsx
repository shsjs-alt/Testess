// app/embed/tv/[...slug]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import VideoPlayer from '@/components/video-player';
import { PlayerOverlay } from '@/components/player-overley';

type Stream = {
  url: string;
  name: string;
  thumbnailUrl?: string;
}

type StreamInfo = {
  streams: Stream[];
  title: string | null;
  originalTitle: string | null;
  backdropPath: string | null;
  nextEpisode?: { season: number; episode: number } | null;
};

export default function TvEmbedPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [tmdbId, season, episode] = slug || [];

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);

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
        const { season, episode } = streamInfo.nextEpisode;
        // Navegação simples, já que estamos em um iframe. 
        // A página do CineVEO é que deve controlar a mudança de URL principal.
        window.location.href = `/embed/tv/${tmdbId}/${season}/${episode}`;
    }
  };

  if (showPlayer && streamInfo) {
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

  return (
    <main className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <PlayerOverlay
            title={streamInfo?.title || ''}
            originalTitle={streamInfo?.originalTitle || ''}
            backgroundUrl={streamInfo?.backdropPath || null}
            isLoading={loading}
            onPlay={() => {
                if (!loading && !error) {
                    setShowPlayer(true);
                }
            }}
        />
        {error && !loading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                <p className="text-zinc-400">{error}</p>
            </div>
        )}
    </main>
  );
}