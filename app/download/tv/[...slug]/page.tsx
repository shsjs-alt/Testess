"use client";

import { useParams } from 'next/navigation';
import { Loader2, Download, AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type StreamInfo = {
  streams: { url: string; playerType: string }[];
  title: string | null;
};

export default function TvDownloadPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [tmdbId, season, episode] = slug || [];

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadClicked, setDownloadClicked] = useState(false);
  const [mediaTitle, setMediaTitle] = useState('Episódio');

  useEffect(() => {
    if (!tmdbId || !season || !episode) {
      setError("Informações inválidas para carregar o episódio.");
      setLoading(false);
      return;
    }

    const fetchStreamData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stream/series/${tmdbId}/${season}/${episode}`);
        if (!res.ok) {
          throw new Error("Não foi possível obter o link de streaming para download.");
        }
        
        const data: StreamInfo = await res.json();
        const stream = data.streams?.[0];

        if (stream && stream.url) {
          setStreamUrl(stream.url);
          if (data.title) {
            setMediaTitle(`${data.title} T${season}E${episode}`);
          }
        } else {
          setError("Nenhum link de download disponível para este episódio.");
        }
      } catch (err: any) {
        setError(err.message || "Ocorreu um erro ao preparar o download.");
      } finally {
        setLoading(false);
      }
    };

    fetchStreamData();
  }, [tmdbId, season, episode]);
  
  const handleDownloadClick = () => {
    setDownloadClicked(true);
  };

  if (loading) {
    return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
        <p className="mt-4 text-zinc-300">Preparando o seu download...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Ocorreu um Erro</h2>
        <p className="text-zinc-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4 text-center">
        {downloadClicked ? (
            <>
                <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-yellow-400/30 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-yellow-400 rounded-full animate-spin"></div>
                </div>
                <h1 className="text-2xl font-bold">O Download iniciou...</h1>
                <p className="text-zinc-400 mt-2">Se o download não começar, clique no botão novamente.</p>
            </>
        ) : (
            <h1 className="text-2xl font-bold mb-6">Clique no botão para iniciar o download</h1>
        )}
      
        <a
            href={streamUrl || '#'}
            download={`${mediaTitle.replace(/[^a-zA-Z0-9 ]/g, '')}.mp4`}
            onClick={handleDownloadClick}
            className={cn(
                "mt-8 px-10 py-4 bg-yellow-400 text-black font-bold text-lg rounded-lg shadow-lg hover:bg-yellow-500 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:ring-opacity-50",
                !streamUrl && "opacity-50 cursor-not-allowed"
            )}
        >
            <div className="flex items-center gap-3">
                <Download className="w-6 h-6" />
                <span>{downloadClicked ? "Baixando..." : "Download"}</span>
            </div>
        </a>
    </main>
  );
}
