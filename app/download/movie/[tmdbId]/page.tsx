"use client";

import { useParams } from 'next/navigation';
import { Download } from 'lucide-react';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export default function MovieDownloadPage() {
  const params = useParams();
  const tmdbId = params.tmdbId as string;
  const [downloadClicked, setDownloadClicked] = useState(false);

  // URL do anúncio
  const adUrl = "https://otieu.com/4/9835277";
  
  // A URL de download agora aponta para a nossa API de download direto
  const downloadApiUrl = `/download/movies/${tmdbId}`;

  const handleDownloadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (downloadClicked) {
      e.preventDefault(); // Impede múltiplos cliques de funcionarem
      return;
    }
    setDownloadClicked(true);
    
    // Abre o anúncio na mesma aba após 3 segundos
    setTimeout(() => {
      window.location.href = adUrl;
    }, 3000);
  };

  return (
    <main className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4 text-center">
        {downloadClicked ? (
            <>
                <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                    <div className="absolute inset-0 border-4 border-yellow-400/30 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-yellow-400 rounded-full animate-spin"></div>
                </div>
                <h1 className="text-2xl font-bold">O Download iniciou...</h1>
                <p className="text-zinc-400 mt-2">Você será redirecionado em breve. Se o download não começar, clique no botão novamente.</p>
            </>
        ) : (
            <h1 className="text-2xl font-bold mb-6">Clique no botão para iniciar o download</h1>
        )}
      
        <a
            href={downloadApiUrl}
            onClick={handleDownloadClick}
            className={cn(
                "mt-8 px-10 py-4 bg-yellow-400 text-black font-bold text-lg rounded-lg shadow-lg hover:bg-yellow-500 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:ring-opacity-50"
            )}
        >
            <div className="flex items-center gap-3">
                <Download className="w-6 h-6" />
                <span>Download</span>
            </div>
        </a>
    </main>
  );
}