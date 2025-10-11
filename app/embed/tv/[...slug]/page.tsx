// app/embed/tv/[...slug]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Loader2, Clapperboard } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import VideoPlayer from '../../../../components/video-player';

type Stream = {
  url: string;
  playerType: string;
};

type StreamInfo = {
  streams: Stream[];
  title: string | null;
};

type SeasonInfo = {
    episode_count: number;
}

type NextEpisodeInfo = {
  title: string;
  coverUrl: string;
  season: number;
  episode: number;
} | null;

const API_KEY = "860b66ade580bacae581f4228fad49fc";
const API_BASE_URL = "https://api.themoviedb.org/3";

export default function TvEmbedPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[];
  const [tmdbId, season, episode] = slug || [];

  const [stream, setStream] = useState<Stream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaTitle, setMediaTitle] = useState('Episódio');
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [nextEpisodeInfo, setNextEpisodeInfo] = useState<NextEpisodeInfo>(null);

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
      setStream(null);
      setNextEpisodeInfo(null);

      try {
        const currentEpisodeNum = parseInt(episode, 10);
        
        // Busca o stream e as informações da temporada em paralelo
        const streamPromise = fetch(`/api/stream/series/${tmdbId}/${season}/${episode}`);
        const seasonInfoPromise = fetch(`${API_BASE_URL}/tv/${tmdbId}/season/${season}?api_key=${API_KEY}&language=pt-BR`);

        const [streamRes, seasonInfoRes] = await Promise.all([streamPromise, seasonInfoPromise]);

        if (!streamRes.ok) {
          throw new Error("Não foi possível obter o link do episódio.");
        }
        
        const data: StreamInfo = await streamRes.json();
        const firstStream = data.streams?.[0];

        if (firstStream && firstStream.url) {
          setStream(firstStream);
          setMediaTitle(`${data.title || 'Série'} - T${season} E${episode}`);
        } else {
          setError("Nenhum link de streaming disponível para este episódio.");
        }

        if (seasonInfoRes.ok) {
            const seasonData = await seasonInfoRes.json();
            setSeasonInfo(seasonData);

            // Verifica e busca as informações do próximo episódio
            const hasNext = currentEpisodeNum < seasonData.episode_count;
            if (hasNext) {
                const nextEpisodeNum = currentEpisodeNum + 1;
                try {
                    const nextEpRes = await fetch(`${API_BASE_URL}/tv/${tmdbId}/season/${season}/episode/${nextEpisodeNum}?api_key=${API_KEY}&language=pt-BR`);
                    if (nextEpRes.ok) {
                        const nextEpData = await nextEpRes.json();
                        setNextEpisodeInfo({
                            title: nextEpData.name || `Episódio ${nextEpisodeNum}`,
                            coverUrl: `https://image.tmdb.org/t/p/w500/${nextEpData.still_path}`,
                            season: parseInt(season, 10),
                            episode: nextEpisodeNum
                        });
                    }
                } catch (e) {
                    console.warn("Não foi possível buscar dados do próximo episódio.");
                }
            }

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

  const hasNextEpisode = !!nextEpisodeInfo;

  const playNextEpisode = () => {
    if (hasNextEpisode) {
      const nextEpisode = parseInt(episode, 10) + 1;
      // Navega para a URL do próximo episódio, o que fará a página recarregar com os novos dados
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

  if (stream) {
    if (stream.playerType === 'gdrive') {
      return (
        <main className="w-screen h-screen relative bg-black">
          <iframe
            src={stream.url}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
          ></iframe>
        </main>
      );
    }
    
    return (
      <main className="w-screen h-screen relative bg-black">
        <VideoPlayer
          src={stream.url}
          title={mediaTitle}
          downloadUrl={`/download/series/${tmdbId}/${season}/${episode}`}
          rememberPosition={true}
          rememberPositionKey={`tv-${tmdbId}-s${season}-e${episode}`}
          hasNextEpisode={hasNextEpisode}
          onNextEpisode={playNextEpisode}
          nextEpisodeInfo={nextEpisodeInfo || undefined}
        />
      </main>
    );
  }

  return null;
}