// components/media-card.tsx
"use client"

import Link from "next/link"
import { Clapperboard, ExternalLink, Tv, Heart } from "lucide-react"
import { useFavorites, type FavoriteItem } from "@/components/favorites-context"
import { useToast } from "@/components/ui/use-toast"
import { cn } from '@/lib/utils'

export type MediaItem = {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type: "movie" | "tv";
}

export function MediaCard({ item }: { item: MediaItem }) {
  const { toggle, isFavorite } = useFavorites();
  const { toast } = useToast();
  
  const title = item.title || item.name || "Título Desconhecido";
  const releaseDate = item.release_date || item.first_air_date;
  const isMovie = item.media_type === 'movie';

  // O link principal do card agora leva para a página de detalhes
  const mainHref = isMovie ? `/movie/${item.id}` : `/tv/${item.id}`;

  const fav = isFavorite(item.id, item.media_type);
  const favItem: FavoriteItem = { id: item.id, media_type: item.media_type, title, poster_path: item.poster_path, backdrop_path: item.backdrop_path, release_date: releaseDate };

  const copyToClipboard = (text: string, label: string) => {
    // Verifica se o código está a ser executado no navegador
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text).then(() => {
        toast({ title: "Copiado!", description: `${label} copiado com sucesso.` });
      });
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      const linkToCopy = isMovie
        ? `${window.location.origin}/embed/movie/${item.id}`
        : `${window.location.origin}/tv/${item.id}`;
      copyToClipboard(linkToCopy, 'Link');
    }
  };

  return (
    <div className="group/card relative">
      <Link href={mainHref} target="_self">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/5 shadow-lg shadow-black/30">
          {item.poster_path ? (<img src={`https://image.tmdb.org/t/p/w500/${item.poster_path}`} alt={`Pôster de ${title}`} className="h-full w-full object-cover transition-transform duration-400 ease-out group-hover/card:scale-[1.03]" loading="lazy" />) : (<div className="flex h-full w-full items-center justify-center bg-zinc-800"><Clapperboard className="h-10 w-10 text-zinc-600" /></div>)}
        </div>
      </Link>
      <div className="absolute inset-0 flex flex-col justify-end rounded-lg bg-black/70 p-3 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
        <h3 className="line-clamp-2 text-sm font-semibold text-zinc-100">{title}</h3>
        <div className="mt-2 space-y-1.5">
          {isMovie ? (
            <Link href={`/embed/movie/${item.id}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center rounded bg-red-600/80 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
              Abrir Embed <ExternalLink className="ml-1.5 h-3 w-3" />
            </Link>
          ) : (
            <Link href={`/tv/${item.id}`} className="flex w-full items-center justify-center rounded bg-red-600/80 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
              Ver Episódios <Tv className="ml-1.5 h-3 w-3" />
            </Link>
          )}
          <button onClick={() => copyToClipboard(String(item.id), 'ID do TMDb')} className="w-full rounded bg-white/10 py-1.5 text-xs text-white hover:bg-white/20">Copiar TMDb</button>
          <button onClick={handleCopyLink} className="w-full rounded bg-white/10 py-1.5 text-xs text-white hover:bg-white/20">Copiar Link</button>
          <button onClick={() => copyToClipboard(title, 'Nome')} className="w-full rounded bg-white/10 py-1.5 text-xs text-white hover:bg-white/20">Copiar Nome</button>
        </div>
      </div>
      <button aria-label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => toggle(favItem)} className={cn("absolute right-2 top-2 z-10 rounded-full p-1.5 backdrop-blur-sm transition-all", fav ? "bg-red-600/50 text-red-300 ring-1 ring-red-400/30" : "bg-black/40 text-white ring-1 ring-white/10")}><Heart className={cn("h-4 w-4", fav && "fill-current")} /></button>
    </div>
  )
}