// app/embed/movie/[tmdbId]/page.tsx
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
};

export default function MovieEmbedPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;
  
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    if (!tmdbId) return;

    const fetchMovieData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stream/movies/${tmdbId}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Filme não encontrado.");
        }
        
        const data: StreamInfo = await res.json();

        if (data.streams && data.streams.length > 0 && data.streams[0].url) {
          setStreamInfo(data);
        } else {
          setError("Nenhum link de streaming disponível para este filme.");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieData();
  }, [tmdbId]);

  if (showPlayer && streamInfo) {
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          sources={streamInfo.streams}
          title={streamInfo.title || 'Filme'}
          downloadUrl={`/download/movies/${tmdbId}`}
          rememberPosition={true}
          rememberPositionKey={`movie-${tmdbId}`}
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