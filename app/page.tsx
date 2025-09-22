// app/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import PaginationComponent from "@/components/PaginationComponent"
import { MediaCard, type MediaItem } from "@/components/media-card"

// --- CONSTANTES ---
const API_KEY = "860b66ade580bacae581f4228fad49fc";
const API_BASE_URL = "https://api.themoviedb.org/3";

// --- MUDANÇA ---
// Definimos o tipo para as estatísticas
type Stats = { movies: number; series: number; episodes: number; };

function ApiDocsSection({ stats }: { stats: Stats }) {
    const [showDocs, setShowDocs] = useState(false);
    // Função para formatar números grandes (ex: 22000 vira "22.000")
    const formatNumber = (num: number) => new Intl.NumberFormat('pt-BR').format(num);

    return (
        <section className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 -mt-24">
            <AnimatePresence mode="wait">
                { showDocs ? (
                    <motion.div key="docs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold">Documentação da API</h2>
                            <p className="text-zinc-400">Em breve...</p>
                            <Button size="lg" onClick={() => setShowDocs(false)} variant="outline" className="mt-4">Voltar</Button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="promo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                            <div className="space-y-4">
                                <h2 className="text-4xl font-extrabold text-white">Incorporação Fácil</h2>
                                <p className="text-zinc-400">Incorpore nosso player no seu site com um simples link. Conteúdo atualizado, design moderno e players sempre funcionais.</p>
                                <Button size="lg" onClick={() => setShowDocs(true)} className="bg-white text-black hover:bg-zinc-200">Aprenda como usar</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {/* --- MUDANÇA --- */}
                                {/* Os números agora são puxados diretamente do estado com os valores que você pediu */}
                                <Card className="bg-zinc-900/80 border-zinc-800 text-center"><CardHeader><CardTitle className="text-2xl text-white">{formatNumber(stats.movies)}</CardTitle></CardHeader><CardContent><p className="text-sm text-zinc-400">Filmes</p></CardContent></Card>
                                <Card className="bg-zinc-900/80 border-zinc-800 text-center"><CardHeader><CardTitle className="text-2xl text-white">{formatNumber(stats.series)}</CardTitle></CardHeader><CardContent><p className="text-sm text-zinc-400">Séries</p></CardContent></Card>
                                <Card className="bg-zinc-900/80 border-zinc-800 col-span-2 text-center"><CardHeader><CardTitle className="text-2xl text-white">{formatNumber(stats.episodes)}</CardTitle></CardHeader><CardContent><p className="text-sm text-zinc-400">Episódios</p></CardContent></Card>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    )
}

export default function HomePage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroBackdrop, setHeroBackdrop] = useState<string | null>(null);
  
  // --- MUDANÇA PRINCIPAL ---
  // Removemos a busca de estatísticas do Firebase e colocamos os valores fixos que você solicitou.
  const [stats] = useState<Stats>({
      movies: 22000,
      series: 6000,
      episodes: 240000,
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // O resto do código permanece o mesmo, pois ele busca os filmes populares do TMDB, o que está correto.
  const fetchMedia = useCallback(async (page: number) => {
    setLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/trending/all/week?api_key=${API_KEY}&language=pt-BR&page=${page}`);
        if (!res.ok) throw new Error("Falha ao buscar dados do TMDB.");
        
        const data = await res.json();
        const validMedia = data.results.filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);
        
        setMedia(validMedia);
        setTotalPages(data.total_pages > 500 ? 500 : data.total_pages);

        if (page === 1 && validMedia.length > 0) {
            const itemsWithBackdrop = validMedia.filter((item: MediaItem) => item.backdrop_path);
            if (itemsWithBackdrop.length > 0) {
                const randomItem = itemsWithBackdrop[Math.floor(Math.random() * itemsWithBackdrop.length)];
                setHeroBackdrop(randomItem.backdrop_path);
            }
        }
    } catch (error) {
        console.error("Erro ao buscar mídia do TMDB:", error);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia(currentPage);
  }, [currentPage, fetchMedia]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <section className="relative flex h-[55vh] items-center justify-center overflow-hidden pt-14">
        <AnimatePresence>
          {heroBackdrop && ( <motion.div key={heroBackdrop} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0.6 }} transition={{ duration: 1.2, ease: "easeOut" }} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/original/${heroBackdrop})` }} /> )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
      </section>

      <ApiDocsSection stats={stats} />

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20">
        <AnimatePresence mode="wait">
          <motion.div key="media-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {loading ? ( <div className="flex h-64 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-zinc-500" /></div> ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {media.map((item) => (<MediaCard key={`${item.id}-${item.media_type}`} item={item} />))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-8 flex justify-center">
                    <PaginationComponent currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </motion.div>
  )
}