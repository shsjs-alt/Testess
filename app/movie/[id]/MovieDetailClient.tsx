// app/movie/[id]/MovieDetailClient.tsx
"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Star, Calendar, Clock, PlayCircle, Heart } from 'lucide-react'
import { Button, buttonVariants } from "@/components/ui/button"
import { useFavorites, type FavoriteItem } from "@/components/favorites-context"
import { cn } from "@/lib/utils"
import Loading from "./loading"

const API_KEY = "860b66ade580bacae581f4228fad49fc"
const API_BASE_URL = "https://api.themoviedb.org/3";

type MovieDetails = { id: number; title: string; overview: string; poster_path: string | null; backdrop_path: string | null; release_date: string; vote_average: number; runtime: number; };
type Stream = { url: string; };

export default function MovieDetailClient({ id }: { id: string }) {
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [hasStream, setHasStream] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toggle, isFavorite } = useFavorites();

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        
        const moviePromise = fetch(`${API_BASE_URL}/movie/${id}?api_key=${API_KEY}&language=pt-BR`);
        const streamPromise = fetch(`/api/stream/movies/${id}`);

        const [movieRes, streamRes] = await Promise.all([moviePromise, streamPromise]);

        if (!movieRes.ok) throw new Error("Falha ao buscar os detalhes do filme.");
        const movieData = await movieRes.json();
        setMovie(movieData);

        if(streamRes.ok) {
            const streamData = await streamRes.json();
            if(streamData.streams && streamData.streams.length > 0) {
                setHasStream(true);
            }
        }
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar conteúdo.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleWatchClick = () => {
    const embedUrl = `/embed/movie/${id}`;
    window.open(embedUrl, '_blank');
  };

  const formatRuntime = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h}h ${m}m`; };

  if (loading) return <Loading />;
  if (error) return ( <div className="bg-zinc-950 text-white min-h-screen flex flex-col items-center justify-center pt-24"><p className="text-red-500">{error}</p></div>);
  if (!movie) return null;

  const favData: FavoriteItem = { id: movie.id, media_type: "movie", title: movie.title, poster_path: movie.poster_path, backdrop_path: movie.backdrop_path, release_date: movie.release_date, };
  const fav = isFavorite(movie.id, "movie");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="relative h-[56vh] md:h-[68vh] w-full overflow-hidden">
        {movie.backdrop_path && ( <motion.div initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/original/${movie.backdrop_path})` }}/> )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
      </div>

      <main className="relative z-10 -mt-32 mx-auto w-full max-w-7xl px-4 pb-24 md:-mt-48">
        <section className="flex flex-col gap-8 md:flex-row md:gap-10">
          <div className="mx-auto w-56 shrink-0 sm:w-60 md:mx-0 md:w-72">
            <img src={movie.poster_path ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}` : '/placeholder.jpg'} alt={`Pôster de ${movie.title}`} className="h-auto w-full object-cover rounded-xl ring-1 ring-white/10 shadow-2xl shadow-black/50" loading="lazy"/>
          </div>
          <div className="flex-1 pt-0 md:pt-16">
              <h1 className="text-center text-4xl font-extrabold tracking-tighter sm:text-left sm:text-5xl">{movie.title}</h1>
              <div className="mt-5 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-zinc-300">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm ring-1 ring-white/10"><Calendar className="h-4 w-4 text-zinc-400" />{movie.release_date ? movie.release_date.slice(0, 4) : 'N/A'}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm ring-1 ring-white/10"><Clock className="h-4 w-4 text-zinc-400" />{movie.runtime > 0 ? formatRuntime(movie.runtime) : 'N/A'}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-3 py-1 text-sm ring-1 ring-yellow-400/20 text-yellow-200"><Star className="h-4 w-4 fill-current" />{movie.vote_average.toFixed(1)}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                  {hasStream ? (
                    <Button onClick={handleWatchClick} className={cn(buttonVariants({ size: "default" }), "bg-red-600 text-white hover:bg-red-600/90")}>
                        <PlayCircle className="mr-2 h-5 w-5" />Assistir Agora
                    </Button>
                  ) : (
                    <Button disabled className={cn(buttonVariants({ size: "default" }), "bg-zinc-800 text-zinc-400 cursor-not-allowed")}>
                        <PlayCircle className="mr-2 h-5 w-5" />Indisponível
                    </Button>
                  )}
                  <Button onClick={() => toggle(favData)} variant="outline" className={cn("rounded-md", fav ? "bg-red-600/20 border-red-500/30 text-red-300" : "border-white/20 bg-white/5 text-white")}><Heart className={cn("mr-2 h-4 w-4", fav && "fill-current")} />{fav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}</Button>
              </div>
              <div className="mt-6"><h2 className="mb-2 text-base font-semibold text-zinc-100">Sinopse</h2><p className="text-zinc-300">{movie.overview || "Sinopse não disponível."}</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}