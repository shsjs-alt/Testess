// app/embed/movie/[tmdbId]/page.tsx
"use client"

import { useParams } from 'next/navigation';
import { Loader2, Clapperboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PlayerOverlay } from '@/components/player-overley';

// Constantes da API do TMDB
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const API_BASE_URL = "https://api.themoviedb.org/3";

type StreamInfo = {
  streams: { url: string }[];
};

export default function MovieEmbedPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [movieTitle, setMovieTitle] = useState<string | null>(null);
  const [originalMovieTitle, setOriginalMovieTitle] = useState<string | null>(null);
  const [backdropPath, setBackdropPath] = useState<string | null>(null);

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
        // Busca os detalhes do filme (título, imagem) DIRETAMENTE da API do TMDB
        const tmdbPromise = fetch(`${API_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
        
        // Busca o link de streaming da sua API interna (que usa o Firestore)
        const streamPromise = fetch(`/api/stream/movies/${tmdbId}`);

        const [tmdbRes, streamRes] = await Promise.all([tmdbPromise, streamPromise]);

        // Processa os dados do TMDB
        if (!tmdbRes.ok) {
          throw new Error("Não foi possível buscar os detalhes do filme no TMDB.");
        }
        const tmdbData = await tmdbRes.json();
        setMovieTitle(tmdbData.title || "Filme");
        setOriginalMovieTitle(tmdbData.original_title || null);
        setBackdropPath(tmdbData.backdrop_path || null);

        // Processa o link de streaming
        if (!streamRes.ok) {
          throw new Error("Não foi possível obter o link de streaming.");
        }
        const streamData: StreamInfo = await streamRes.json();
        if (streamData.streams && streamData.streams.length > 0 && streamData.streams[0].url) {
          setStreamUrl(streamData.streams[0].url);
        } else {
          setError("Nenhum link de streaming disponível para este filme.");
        }

      } catch (err: any) {
        console.error("Erro ao carregar dados do filme:", err);
        setError(err.message || "Ocorreu um erro ao carregar o filme.");
      } finally {
        setLoading(false);
      }
    };

    fetchMovieData();
  }, [tmdbId]);

  const handlePlayButtonClick = () => {
    setShowOverlay(false);
  };
  
  if (loading) {
    return (
        <main className="w-screen h-screen flex items-center justify-center bg-black">
            <Loader2 className="w-12 h-12 animate-spin text-white" />
        </main>
    )
  }

  if (error) {
    return (
        <main className="w-screen h-screen flex flex-col items-center justify-center bg-black text-white p-4 text-center">
            <Clapperboard className="w-16 h-16 text-zinc-700 mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro ao Carregar</h2>
            <p className="text-zinc-400">{error}</p>
        </main>
    )
  }

  return (
    <main className="w-screen h-screen relative bg-black">
      <AnimatePresence>
        {showOverlay && movieTitle && (
          <PlayerOverlay
            title={movieTitle}
            originalTitle={originalMovieTitle || undefined}
            onPlay={handlePlayButtonClick}
            isLoading={false}
            backgroundUrl={backdropPath}
          />
        )}
      </AnimatePresence>
      
      {streamUrl && !showOverlay && (
          <iframe
              src={streamUrl}
              title="PrimeVicio Player"
              className="h-full w-full"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              frameBorder="0"
              scrolling="no"
          ></iframe>
      )}
    </main>
  );
}