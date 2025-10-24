// app/embed/tv/[...slug]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// --- MODIFICAÇÃO PRINCIPAL ---
const VideoPlayer = dynamic(() => import('@/components/video-player'), {
  loading: () => (
    <div className="w-screen h-screen flex items-center justify-center bg-black">
      {/* Usando o GIF diretamente */}
      <img src="https://i.ibb.co/fVcZxsvM/1020.gif" alt="Carregando..." className="w-64 h-64" />
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
  originalTitle?: string | null; // Adicionado
  backdropPath?: string | null; // Adicionado
  nextEpisode?: { season: number; episode: number } | null;
};

export default function TvEmbedPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [tmdbId, season, episode] = slug || [];

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false); // *** ADD player ready state ***

  useEffect(() => {
    // Reset states when slug changes
    setStreamInfo(null);
    setError(null);
    setIsFetchingData(true);
    setIsPlayerReady(false);

    if (!tmdbId || !season || !episode) {
      setError("Informações inválidas para carregar a série.");
      setIsFetchingData(false);
      return;
    }

    const fetchTvData = async () => {
      // Keep isFetchingData true until fetch completes
      try {
        const res = await fetch(`/api/stream/series/${tmdbId}/${season}/${episode}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Episódio não encontrado.");
        }

        const data: StreamInfo = await res.json();

        if (data.streams && data.streams.length > 0 && data.streams[0].url) {
          setStreamInfo(data);
          // Don't set player ready here
        } else {
          setError("Nenhum link de streaming disponível para este episódio.");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsFetchingData(false); // API fetch is complete
      }
    };

    fetchTvData();
  }, [tmdbId, season, episode]); // Depend on all parts of the slug

  const handleNextEpisode = () => {
    if (streamInfo?.nextEpisode) {
        const { season: nextSeason, episode: nextEpisode } = streamInfo.nextEpisode;
        // Use Next.js router for client-side navigation if preferred, or stick with href
        window.location.href = `/embed/tv/${tmdbId}/${nextSeason}/${nextEpisode}`;
    }
  };

  // --- MODIFICAÇÃO DE RENDERIZAÇÃO ---
   // 1. Show GIF if fetching API data OR if player isn't ready yet
  if (isFetchingData || (!isPlayerReady && !error && streamInfo)) { // Check streamInfo to ensure data arrived before waiting for player
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black">
        <img src="https://i.ibb.co/fVcZxsvM/1020.gif" alt="Carregando..." className="w-64 h-64" />
         {/* Render hidden player if data is ready but player isn't */}
        {streamInfo && !isPlayerReady && (
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
                 <VideoPlayer
                    sources={streamInfo.streams}
                    title={streamInfo.title ? `${streamInfo.title} - S${season} E${episode}` : `S${season} E${episode}`}
                    rememberPosition={true}
                    rememberPositionKey={`tv-${tmdbId}-s${season}-e${episode}`}
                    hasNextEpisode={!!streamInfo.nextEpisode}
                    onNextEpisode={handleNextEpisode}
                    backdropPath={streamInfo.backdropPath}
                    onReady={() => setIsPlayerReady(true)}
                />
            </div>
        )}
      </main>
    );
  }


  // 2. Se deu erro, mostra o erro.
  if (error) {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-black text-center p-4">
        <p className="text-zinc-400">{error}</p>
      </main>
    );
  }

  // 3. Se os dados chegaram E o player está pronto, renderiza o Player visível.
  if (streamInfo && isPlayerReady) {
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          sources={streamInfo.streams}
           // Combine series title with season/episode
          title={streamInfo.title ? `${streamInfo.title} - S${season} E${episode}` : `S${season} E${episode}`}
          // downloadUrl={`/download/series/${tmdbId}/${season}/${episode}`} // REMOVED
          rememberPosition={true}
          rememberPositionKey={`tv-${tmdbId}-s${season}-e${episode}`}
          hasNextEpisode={!!streamInfo.nextEpisode}
          onNextEpisode={handleNextEpisode}
          backdropPath={streamInfo.backdropPath} // Pass backdrop
          onReady={() => setIsPlayerReady(true)} // Callback needed here too
        />
      </main>
    );
  }

  // Final fallback
   return (
     <main className="w-screen h-screen flex items-center justify-center bg-black text-center p-4">
        <p className="text-zinc-400">Não foi possível carregar as informações do vídeo.</p>
      </main>
  );
}