// components/player-overley.tsx
"use client"

import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type PlayerOverlayProps = {
  title: string;
  originalTitle?: string;
  onPlay: () => void;
  isLoading: boolean;
  backgroundUrl: string | null;
};

export function PlayerOverlay({ title, originalTitle, onPlay, isLoading, backgroundUrl }: PlayerOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-end p-4 text-center text-white"
    >
      {/* Container da Imagem de Fundo e do Overlay Escuro */}
      {backgroundUrl && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(https://image.tmdb.org/t/p/original${backgroundUrl})` }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" /> 
        </div>
      )}
      
      {/* Container do Conteúdo (título e botão) - REPOSICIONADO */}
      <div className="relative z-10 flex flex-col items-center mb-48 md:mb-60">
        <h1 className="text-3xl md:text-5xl font-bold text-shadow-lg">{title}</h1>
        {originalTitle && <p className="text-sm text-zinc-300 mt-2 text-shadow">{originalTitle}</p>}
        
        {/* BOTÃO COM NOVO DESIGN E EFEITO HOVER */}
        <button
          onClick={onPlay}
          disabled={isLoading}
          className={cn(
            "group mt-10 rounded-full bg-black/40 px-6 py-3 text-white ring-1 ring-red-500/50 backdrop-blur-sm transition-all duration-300",
            "hover:bg-red-600/80 hover:ring-red-500", // Efeito de hover vermelho
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          ) : (
            // Conteúdo do botão reestruturado para ser idêntico à imagem
            <div className="flex items-center gap-3">
              <div className="relative">
                <Zap className="h-6 w-6 text-red-500 fill-red-500/50" />
                <span className="absolute bottom-[-2px] right-[-2px] block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-black/50" />
              </div>
              <span className="text-base font-semibold">Servidor 1</span>
              <span className="ml-1 rounded-md bg-red-800/90 px-2 py-0.5 text-xs font-bold text-red-50">
                HD
              </span>
            </div>
          )}
        </button>
      </div>
    </motion.div>
  );
}