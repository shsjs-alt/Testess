// app/tv/[id]/TvDetailClient.tsx
"use client"

import { useState, useEffect } from "react"
import { Loader2, Star, Calendar, Tv, Heart, PlayCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button, buttonVariants } from "@/components/ui/button"
import { useFavorites, type FavoriteItem } from "@/components/favorites-context"
import { cn } from "@/lib/utils"
import Loading from "./loading"

const API_KEY = "860b66ade580bacae581f4228fad49fc"
const API_BASE_URL = "https://api.themoviedb.org/3";

type TVDetails = { id: number; name: string; overview: string; poster_path: string | null; backdrop_path: string | null; first_air_date: string; vote_average: number; number_of_seasons: number; seasons: { id: number; name: string; season_number: number; episode_count: number }[]; };
type Episode = { id: number; name: string; episode_number: number; overview: string; still_path: string | null; };

export default function TvDetailClient({ id }: { id: string }) {
  const [tv, setTv] = useState<TVDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toggle, isFavorite } = useFavorites();

  const handleScrollToEpisodes = () => {
    const element = document.getElementById('episodios-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleEpisodeClick = (episode: Episode) => {
    if (!tv) return;
    // --- CORREÇÃO PRINCIPAL ---
    // Apenas abre a URL de embed limpa, sem nenhum parâmetro.
    const embedUrl = `/embed/tv/${id}/${selectedSeason}/${episode.episode_number}`;
    window.open(embedUrl, '_blank');
  };

  useEffect(() => {
    if (!id) return;
    const fetchTVDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/tv/${id}?api_key=${API_KEY}&language=pt-BR&append_to_response=seasons`);
        if (!res.ok) throw new Error("Falha ao buscar os detalhes da série.");
        const data = await res.json();
        setTv(data);
        const firstValidSeason = data.seasons.find((s: any) => s.season_number > 0 && s.episode_count > 0);
        if (firstValidSeason) {
            setSelectedSeason(firstValidSeason.season_number);
        } else if (data.seasons.length > 0) {
            setSelectedSeason(data.seasons[0].season_number);
        }
      } catch (err: any) {
        setError(err?.message || "Ocorreu um erro.");
      } finally {
        setLoading(false);
      }
    };
    fetchTVDetails();
  }, [id]);

  useEffect(() => {
    if (!tv) return;
    const fetchSeasonDetails = async () => {
      setEpisodesLoading(true);
      setEpisodes([]);
      try {
        const res = await fetch(`${API_BASE_URL}/tv/${id}/season/${selectedSeason}?api_key=${API_KEY}&language=pt-BR`);
        if (!res.ok) throw new Error("Falha ao buscar os episódios.");
        const data = await res.json();
        setEpisodes(data.episodes);
      } catch (err) {
        setEpisodes([]);
      } finally {
        setEpisodesLoading(false);
      }
    };
    fetchSeasonDetails();
  }, [tv, selectedSeason, id]);

  if (loading) return <Loading />; 
  if (error || !tv) return ( <div className="bg-zinc-950 text-white min-h-screen flex flex-col items-center justify-center pt-24"><p className="text-red-500">{error || "Série não encontrada"}</p></div>)

  const favData: FavoriteItem = { id: tv.id, media_type: "tv", title: tv.name, poster_path: tv.poster_path, backdrop_path: tv.backdrop_path, release_date: tv.first_air_date };
  const fav = isFavorite(tv.id, "tv");
  const seasonsWithEpisodes = tv.seasons.filter((s) => s.season_number > 0 && s.episode_count > 0);

  return (
    <div className="bg-zinc-950 min-h-screen text-white">
        <div 
            className="relative w-full h-[56.25vw] max-h-[80vh] bg-cover bg-center"
            style={{backgroundImage: `url(https://image.tmdb.org/t/p/original/${tv.backdrop_path})`}}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent" />
        </div>
       
        <main className="container mx-auto px-4 md:px-8 py-8 -mt-32 md:-mt-48 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                     <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">{tv.name}</h1>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3 text-zinc-400 text-sm">
                        <div className="flex items-center gap-1.5"><Star className="w-4 h-4 text-yellow-400" fill="currentColor" /><span>{tv.vote_average.toFixed(1)}</span></div>
                        <div className="flex items-center gap-1.5"><Calendar size={14} /><span>{tv.first_air_date ? tv.first_air_date.substring(0, 4) : 'N/A'}</span></div>
                        <div className="flex items-center gap-1.5"><Tv size={14} /><span>{tv.number_of_seasons} Temporada(s)</span></div>
                    </div>
                    <p className="text-zinc-400 mt-4 text-sm">{tv.overview}</p>
                    
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <Button onClick={handleScrollToEpisodes} className={cn(buttonVariants({ size: "default" }), "bg-red-600 text-white hover:bg-red-600/90 w-full sm:w-auto")}>
                            <Tv className="mr-2 h-5 w-5" /> Ver Episódios
                        </Button>
                        <Button onClick={() => toggle(favData)} variant="outline" className={cn("rounded-md w-full sm:w-auto", fav ? "bg-red-600/20 border-red-500/30 text-red-300" : "border-white/20 bg-white/5 text-white")}>
                            <Heart className={cn("mr-2 h-4 w-4", fav && "fill-current")} />
                            {fav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                        </Button>
                    </div>
                </div>
                
                <div id="episodios-section" className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold">Temporadas e Episódios</h2>
                        {seasonsWithEpisodes.length > 1 && (
                            <Select onValueChange={(value) => setSelectedSeason(Number(value))} defaultValue={String(selectedSeason)}>
                                <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-zinc-900 text-white border-zinc-700">
                                    {seasonsWithEpisodes.map((season) => (<SelectItem key={season.id} value={String(season.season_number)}>{season.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 scrollbar-clean rounded-lg border border-zinc-800 bg-zinc-900/50 p-2">
                        {episodesLoading ? (
                            <div className="flex justify-center items-center h-48">
                                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                            </div>
                        ) : episodes.length > 0 ? (
                            episodes.map((ep) => (
                                <button
                                    key={ep.id}
                                    onClick={() => handleEpisodeClick(ep)}
                                    className="w-full text-left p-2.5 rounded-lg flex items-center gap-4 transition-colors bg-zinc-900 hover:bg-zinc-800/70 group"
                                >
                                    <span className="text-zinc-400 font-mono text-lg">{String(ep.episode_number).padStart(2, "0")}</span>
                                    <div className="relative w-28 shrink-0">
                                        <img src={ep.still_path ? `https://image.tmdb.org/t/p/w300/${ep.still_path}` : '/placeholder.jpg'} alt={ep.name} className="w-28 aspect-video object-cover rounded-md bg-zinc-800" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <PlayCircle className="h-8 w-8 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm line-clamp-1">{ep.name}</p>
                                        <p className="text-xs text-zinc-400 line-clamp-2">{ep.overview || "Sem descrição."}</p>
                                    </div>
                                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="sm">Assistir</Button>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="flex justify-center items-center h-48 text-zinc-500">
                                <span>Nenhum episódio encontrado para esta temporada.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    </div>
  )
}