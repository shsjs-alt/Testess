// app/embed/tv/[...slug]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Loader2, Clapperboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import VideoPlayer from '@/components/video-player';
import { PlayerOverlay } from '@/components/player-overley'; // Importe o novo componente

type Stream = {
  url: string;
  name: string;
  playerType: string;
  thumbnailUrl?: string;
};

type StreamInfo = {
  streams: Stream[];
  title: string | null;
  originalTitle: string | null;
  backdropPath: string | null;
};

type SeasonInfo = {
    episode_count: number;
    episodes: Episode[];
}

type Episode = {
  still_path: string | null;
  episode_number: number; // Adicionado para facilitar a busca do episódio correto
}

const API_KEY = "860b66ade580bacae581f4228fad49fc"; // Sua chave da API TMDB
const API_BASE_URL = "https://api.themoviedb.org/3";

export default function TvEmbedPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[];
  const [tmdbId, season, episode] = slug || [];

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [userInteracted, setUserInteracted] = useState(false); // Novo estado para controlar a interação do usuário

  useEffect(() => {
    if (!tmdbId || !season || !episode) {
      setError("Informações inválidas para carregar o episódio.");
      setLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      setSeasonInfo(null);
      setStreamInfo(null);
      try {
        const streamRes = await fetch(`/api/stream/series/${tmdbId}/${season}/${episode}`);
        
        if (!streamRes.ok) {
          throw new Error("Não foi possível obter o link do episódio.");
        }
        
        const data: StreamInfo = await streamRes.json();
        if (data.streams && data.streams.length > 0 && data.streams[0].url) {
          setStreamInfo(data);
        } else {
          setError("Nenhum link de streaming disponível para este episódio.");
        }

        const seasonInfoRes = await fetch(`${API_BASE_URL}/tv/${tmdbId}/season/${season}?api_key=${API_KEY}&language=pt-BR`);
        if (seasonInfoRes.ok) {
            const seasonData = await seasonInfoRes.json();
            setSeasonInfo(seasonData);
        } else {
            console.warn("Não foi possível buscar dados da temporada para determinar o próximo episódio.");
        }

      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao carregar o episódio.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [tmdbId, season, episode]);

  const handlePlay = () => {
    setUserInteracted(true); // Define que o usuário interagiu para iniciar o player
  };

  const hasNextEpisode = seasonInfo ? parseInt(episode, 10) < seasonInfo.episode_count : false;

  const playNextEpisode = () => {
    if (hasNextEpisode) {
      const nextEpisode = parseInt(episode, 10) + 1;
      router.push(`/embed/tv/${tmdbId}/${season}/${nextEpisode}`);
    }
  };
  
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

  const mediaTitle = `${streamInfo.title || 'Série'} - T${season} E${episode}`;
  const episodeData = seasonInfo?.episodes?.find(e => e.episode_number === parseInt(episode, 10));

  // Se o usuário ainda não interagiu, mostra a tela de pré-visualização
  if (!userInteracted) {
    return (
        <main className="w-screen h-screen relative bg-black">
            <PlayerOverlay
                title={mediaTitle}
                originalTitle={streamInfo.originalTitle || ''}
                // Prioriza a imagem do episódio, senão usa a do backdrop da série
                backgroundUrl={episodeData?.still_path || streamInfo.backdropPath}
                isLoading={false}
                onPlay={handlePlay}
            />
        </main>
    );
  }

  const customStreams = streamInfo.streams.filter(s => s.playerType === 'custom');

  if (customStreams.length > 0) {
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          sources={customStreams.map(s => ({ url: s.url, name: s.name, thumbnailUrl: s.thumbnailUrl }))}
          title={mediaTitle}
          downloadUrl={`/download/series/${tmdbId}/${season}/${episode}`}
          rememberPosition={true}
          rememberPositionKey={`tv-${tmdbId}-s${season}-e${episode}`}
          hasNextEpisode={hasNextEpisode}
          onNextEpisode={playNextEpisode}
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