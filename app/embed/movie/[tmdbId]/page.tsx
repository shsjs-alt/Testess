// app/embed/movie/[tmdbId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { Loader2, Clapperboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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
  
  const [stream, setStream] = useState<{ url: string; playerType: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaTitle, setMediaTitle] = useState('Filme');

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
        const firstStream = data.streams?.[0];

        if (firstStream && firstStream.url) {
          setStream(firstStream);
          setMediaTitle(data.title || "Filme");
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

  if (stream) {
    // NOVO: Lógica para renderizar iframe ou o player customizado
    if (stream.playerType === 'gdrive' || stream.playerType === 'iframe') {
      return (
        <main className="w-screen h-screen relative bg-black">
          <iframe
            src={stream.url}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
          ></iframe>
          {stream.playerType === 'gdrive' && (
             <div className="absolute top-0 right-0 w-16 h-14 bg-black z-10"></div>
          )}
        </main>
      );
    }
    
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          src={stream.url}
          title={mediaTitle}
          downloadUrl={`/download/movies/${tmdbId}`}
          rememberPosition={true}
          rememberPositionKey={`movie-${tmdbId}`}
        />
      </main>
    );
  }

  return null;
}