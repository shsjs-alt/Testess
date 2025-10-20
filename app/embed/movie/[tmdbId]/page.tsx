// app/embed/movie/[tmdbId]/page.tsx
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
};

export default function MovieEmbedPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;
  
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          title={streamInfo.title || 'Filme'}
          downloadUrl={`/download/movies/${tmdbId}`}
          rememberPosition={true}
          rememberPositionKey={`movie-${tmdbId}`}
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