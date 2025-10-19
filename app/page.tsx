// app/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import PaginationComponent from "@/components/PaginationComponent"
import { MediaCard, type MediaItem } from "@/components/media-card"

// --- CONSTANTES ---
const API_KEY = "860b66ade580bacae581f4228fad49fc";
const API_BASE_URL = "https://api.themoviedb.org/3";

type Stats = { movies: string; series: string; episodes: string; };

function ApiDocsSection({ stats }: { stats: Stats }) {
    const [showDocs, setShowDocs] = useState(false);

    // --- MUDANÇA: CONTEÚDO DA DOCUMENTAÇÃO ATUALIZADO ---
    const documentationContent = (
      <div className="text-left max-w-4xl mx-auto bg-zinc-900/50 p-6 sm:p-8 rounded-lg border border-zinc-800 backdrop-blur-sm">
        <h2 className="text-3xl font-extrabold text-white text-center mb-2">Como Usar Nossas APIs</h2>
        <p className="text-zinc-400 text-center mb-8">Temos duas APIs: uma para o Player e outra para checar a disponibilidade do conteúdo.</p>

        <div className="space-y-8">
            {/* Player de Vídeo (Embed) */}
            <div>
                <h3 className="text-2xl font-bold text-red-400 mb-3">1. API de Player (Embed)</h3>
                <p className="text-zinc-300 mb-4">Para exibir o nosso player no seu site, use os links de embed abaixo. É a forma mais simples e direta.</p>
                
                <h4 className="font-semibold text-white mt-6 mb-2">Para Filmes:</h4>
                <code className="block w-full text-left bg-zinc-800 text-yellow-300 p-3 rounded-md text-sm overflow-x-auto">
                    {`https://primevicio.lat/embed/movie/{ID_DO_FILME}`}
                </code>
                 <p className="text-sm text-zinc-500 mt-2">Exemplo de iframe:</p>
                <code className="block w-full text-left bg-zinc-800 text-sky-300 p-4 rounded-md mt-3 text-sm overflow-x-auto">
                    {`<iframe src="https://primevicio.lat/embed/movie/693134" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`}
                </code>

                <h4 className="font-semibold text-white mt-6 mb-2">Para Séries:</h4>
                <code className="block w-full text-left bg-zinc-800 text-yellow-300 p-3 rounded-md text-sm overflow-x-auto">
                    {`https://primevicio.lat/embed/tv/{ID_DA_SERIE}/{TEMPORADA}/{EPISODIO}`}
                </code>
                 <p className="text-sm text-zinc-500 mt-2">Exemplo de iframe (Fallout, T1E1):</p>
                <code className="block w-full text-left bg-zinc-800 text-sky-300 p-4 rounded-md mt-3 text-sm overflow-x-auto">
                    {`<iframe src="https://primevicio.lat/embed/tv/106379/1/1" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`}
                </code>
            </div>

            <div className="border-t border-zinc-800 my-8"></div>

            {/* API de Conteúdo (TMDB) */}
            <div>
                <h3 className="text-2xl font-bold text-red-400 mb-3">2. API de Disponibilidade</h3>
                <p className="text-zinc-300 mb-4">Se o seu site já busca os dados do TMDB, você não precisa da nossa lista. Use esta API para checar, em tempo real, se um filme ou episódio específico está disponível no nosso player antes de exibi-lo para o seu usuário.</p>
                
                <p className="text-zinc-400 mb-4">É simples: você faz uma chamada para o nosso endpoint. Se receber uma resposta <code className="bg-green-900/50 text-green-300 px-1.5 py-0.5 rounded">200 OK</code>, o conteúdo existe! Se receber <code className="bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">404 Not Found</code>, ele não está disponível.</p>

                <h4 className="font-semibold text-white mt-6 mb-2">Verificar Filme:</h4>
                <code className="block w-full text-left bg-zinc-800 text-yellow-300 p-3 rounded-md text-sm overflow-x-auto">
                    {`https://primevicio.lat/api/stream/movies/{ID_DO_FILME}`}
                </code>
                <p className="text-sm text-zinc-500 mt-2">Ex: <code className="bg-zinc-700 px-1 rounded">/api/stream/movies/693134</code></p>


                <h4 className="font-semibold text-white mt-6 mb-2">Verificar Episódio de Série:</h4>
                <code className="block w-full text-left bg-zinc-800 text-yellow-300 p-3 rounded-md text-sm overflow-x-auto">
                    {`https://primevicio.lat/api/stream/series/{ID_DA_SERIE}/{TEMPORADA}/{EPISODIO}`}
                </code>
                 <p className="text-sm text-zinc-500 mt-2">Ex: <code className="bg-zinc-700 px-1 rounded">/api/stream/series/106379/1/1</code></p>
                
                 <h4 className="font-semibold text-white mt-6 mb-2">Como Usar no seu Código (Exemplo em JavaScript)</h4>
                 <p className="text-zinc-400 mb-2">
                    Você pode criar uma função que verifica a URL e, se ela funcionar, mostra o botão "Assistir" no seu site.
                 </p>
                <code className="block w-full text-left bg-zinc-800 text-sky-300 p-4 rounded-md mt-3 text-sm overflow-x-auto whitespace-pre-wrap">
{`async function checarDisponibilidade(tmdbId) {
  const url = \`https://primevicio.lat/api/stream/movies/\${tmdbId}\`;
  try {
    const resposta = await fetch(url);
    if (resposta.ok) {
      console.log('Filme disponível!');
      // Aqui você mostra o botão de assistir no seu site
      return true;
    } else {
      console.log('Filme não disponível.');
      return false;
    }
  } catch (erro) {
    console.error('Erro ao checar:', erro);
    return false;
  }
}

// Como usar:
checarDisponibilidade('693134').then(disponivel => {
  if (disponivel) {
    // Lógica para exibir o player
  }
});`}
                </code>
            </div>
        </div>
      </div>
    );

    return (
        <section className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-10 -mt-24">
            <AnimatePresence mode="wait">
                { showDocs ? (
                    <motion.div key="docs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                        {documentationContent}
                        <div className="text-center">
                            <Button size="lg" onClick={() => setShowDocs(false)} variant="outline" className="mt-8">Voltar</Button>
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
                                <Card className="bg-zinc-900/80 border-zinc-800 text-center flex items-center justify-center p-4 h-24">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-xl text-white">{stats.movies}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="bg-zinc-900/80 border-zinc-800 text-center flex items-center justify-center p-4 h-24">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-xl text-white">{stats.series}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card className="bg-zinc-900/80 border-zinc-800 col-span-2 text-center flex items-center justify-center p-4 h-24">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-xl text-white">{stats.episodes}</CardTitle>
                                    </CardHeader>
                                </Card>
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
  
  const [stats] = useState<Stats>({
      movies: "29,658 Filmes",
      series: "7,070 Séries",
      episodes: "248,458 Episódios",
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

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