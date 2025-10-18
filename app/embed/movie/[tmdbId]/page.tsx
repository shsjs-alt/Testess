// app/embed/movie/[tmdbId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { Loader2, Clapperboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import VideoPlayer from '@/components/video-player';
import { PlayerOverlay } from '@/components/player-overley';

type Stream = {
  url: string;
  name: string;
  playerType: string;
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
        if (data.streams && data.streams.length > 0 && data.streams[0].url) {
          setStreamInfo(data);
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

  if (loading) {
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

  if (!streamInfo) return null;

  const customStreams = streamInfo.streams.filter(s => s.playerType === 'custom');

  if (customStreams.length > 0) {
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          sources={customStreams.map(s => ({ url: s.url, name: s.name, thumbnailUrl: s.thumbnailUrl }))}
          title={streamInfo.title || 'Filme'}
          downloadUrl={`/download/movies/${tmdbId}`}
          rememberPosition={true}
          rememberPositionKey={`movie-${tmdbId}`}
        />
      </main>
    );
  }
  
  const iframeStream = streamInfo.streams.find(s => s.playerType === 'iframe');
  if (iframeStream) {
    return (
      <main className="w-screen h-screen relative bg-black">
        <iframe
          src={iframeStream.url}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
        ></iframe>
      </main>
    );
  }

  return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
        <Clapperboard className="w-16 h-16 text-zinc-700 mb-4" />
        <h2 className="text-xl font-bold mb-2">Player Incompatível</h2>
        <p className="text-zinc-400">O tipo de player para este conteúdo não é suportado.</p>
      </main>
  );
}