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
        {/* Usando o GIF diretamente */}
        <img src="https://i.ibb.co/fVcZxsvM/1020.gif" alt="Carregando..." className="w-64 h-64" />
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
  originalTitle?: string | null; // Adicionado para título original
  backdropPath?: string | null; // Adicionado para backdrop
};

export default function MovieEmbedPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false); // *** ADD player ready state ***

  useEffect(() => {
    if (!tmdbId) return;

    const fetchMovieData = async () => {
      setIsFetchingData(true);
      setError(null);
      setIsPlayerReady(false); // Reset player ready state on new fetch
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
        // Don't set player ready here, wait for the player component
      }
    };

    fetchMovieData();
  }, [tmdbId]);

  // --- MODIFICAÇÃO DE RENDERIZAÇÃO ---

  // 1. Show GIF if fetching API data OR if player isn't ready yet
  if (isFetchingData || (!isPlayerReady && !error)) { // Show GIF until player signals ready (unless there's an error)
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

  // 3. Se os dados chegaram E o player está pronto, renderiza o Player.
  if (streamInfo && isPlayerReady) {
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          sources={streamInfo.streams}
          title={streamInfo.title || 'Filme'}
          // downloadUrl={`/download/movies/${tmdbId}`} // REMOVED
          rememberPosition={true}
          rememberPositionKey={`movie-${tmdbId}`}
          backdropPath={streamInfo.backdropPath} // Pass backdrop
          onReady={() => setIsPlayerReady(true)} // *** Pass the callback ***
        />
      </main>
    );
  }

   // Fallback: Should ideally not be reached if logic is correct
   // But handles the case where streamInfo is ready but player isn't (waits for player ready state)
   if (streamInfo && !isPlayerReady) {
     return (
        <main className="w-screen h-screen flex items-center justify-center bg-black">
            {/* Show GIF while player component loads/signals ready */}
            <img src="https://i.ibb.co/fVcZxsvM/1020.gif" alt="Carregando Player..." className="w-64 h-64" />
             {/* Render player hidden initially, let it call onReady */}
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                 <VideoPlayer
                    sources={streamInfo.streams}
                    title={streamInfo.title || 'Filme'}
                    rememberPosition={true}
                    rememberPositionKey={`movie-${tmdbId}`}
                    backdropPath={streamInfo.backdropPath}
                    onReady={() => setIsPlayerReady(true)}
                />
            </div>
        </main>
     );
   }

  // Final fallback if streamInfo is null after loading and no error
  return (
     <main className="w-screen h-screen flex items-center justify-center bg-black text-center p-4">
        <p className="text-zinc-400">Não foi possível carregar as informações do vídeo.</p>
      </main>
  );
}