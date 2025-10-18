// components/player-overley.tsx
import { Play } from 'lucide-react';
import Image from 'next/image';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils'; // Certifique-se de que seu arquivo utilitário cn existe e está funcionando

interface PlayerOverlayProps {
  title: string;
  originalTitle: string;
  backgroundUrl: string | null;
  isLoading: boolean;
  onPlay: () => void;
}

export const PlayerOverlay: React.FC<PlayerOverlayProps> = ({
  title,
  originalTitle,
  backgroundUrl,
  isLoading,
  onPlay,
}) => {
  const imageUrl = backgroundUrl 
    ? `https://image.tmdb.org/t/p/w1280${backgroundUrl}` 
    : '/fallback-image.jpg'; // Substitua por uma imagem de fallback padrão se não houver backdrop

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
      {backgroundUrl && (
        <Image
          src={imageUrl}
          alt={title}
          layout="fill"
          objectFit="cover"
          className="absolute inset-0 opacity-40 blur-sm"
          priority
        />
      )}

      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 text-white z-10">
        {isLoading ? (
          <Loader2 className="w-12 h-12 animate-spin text-white" />
        ) : (
          <>
            <h1 className="text-2xl md:text-4xl font-bold text-center mb-2 leading-tight">
              {title}
            </h1>
            {originalTitle && originalTitle !== title && (
              <p className="text-md md:text-lg text-zinc-300 text-center mb-6">
                ({originalTitle})
              </p>
            )}
            <Button
              onClick={onPlay}
              className="relative z-20 h-20 w-20 rounded-full bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center group"
              aria-label="Assistir"
            >
              <Play className="h-10 w-10 text-white group-hover:scale-110 transition-transform" />
            </Button>
            <p className="text-sm text-zinc-400 mt-4">Clique para assistir</p>
          </>
        )}
      </div>
    </div>
  );
};