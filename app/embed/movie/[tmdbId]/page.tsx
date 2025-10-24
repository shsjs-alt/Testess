// app/embed/movie/[tmdbId]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// --- MODIFICAÇÃO PRINCIPAL ---
// Carrega o componente do player de forma dinâmica (em segundo plano)
const VideoPlayer = dynamic(() => import('@/components/video-player'), {
  // Mostra um loader simples ENQUANTO o código do player está sendo baixado
  loading: () => (
    <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
    </div>
  ),
  // O player depende de APIs do navegador, então desativamos a renderização no servidor.
  ssr: false 
});


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
  const [isFetchingData, setIsFetchingData] = useState(true);

  useEffect(() => {
    if (!tmdbId) return;

    const fetchMovieData = async () => {
      setIsFetchingData(true);
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
        setIsFetchingData(false);
      }
    };

    fetchMovieData();
  }, [tmdbId]);

  // --- MODIFICAÇÃO DE RENDERIZAÇÃO ---

  // 1. Enquanto busca os dados, mostra o GIF. Isso aparece primeiro.
  if (isFetchingData) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black">
        <img src="https://i.ibb.co/fVcZxsvM/1020.gif" alt="Carregando..." className="w-64 h-64" />
      </main>
    );
  }

  // 2. Se deu erro na busca, mostra o erro.
  if (error) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black text-center p-4">
        <p className="text-zinc-400">{error}</p>
      </main>
    );
  }

  // 3. Se os dados chegaram, renderiza o Player (que já foi carregado em segundo plano).
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

  // Caso algo inesperado ocorra
  return null;
}