// app/search/page.tsx
"use client"

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect, useCallback } from 'react'
import { Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import PaginationComponent from "@/components/PaginationComponent"
import { MediaCard, type MediaItem } from "@/components/media-card"

const API_KEY = "860b66ade580bacae581f4228fad49fc";
const API_BASE_URL = "https://api.themoviedb.org/3";

// --- NOVA FUNÇÃO DE VERIFICAÇÃO ---
async function verifyMediaAvailability(item: MediaItem): Promise<boolean> {
  const url = item.media_type === 'movie' 
    ? `/api/stream/movies/${item.id}` 
    : `/api/stream/series/${item.id}/1/1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    return data.streams && data.streams.length > 0;
  } catch (error) {
    console.error(`Erro ao verificar disponibilidade para ${item.media_type} ${item.id}:`, error);
    return false;
  }
}

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('query')
  
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Efeito para resetar a página para 1 sempre que uma nova busca for feita
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  // Efeito para buscar os dados da API quando a busca ou a página mudar
  useEffect(() => {
    const fetchResults = async () => {
      if (!query) {
          setResults([]);
          setLoading(false);
          return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/search/multi?api_key=${API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}&page=${currentPage}`);
        if (!res.ok) throw new Error("Falha ao buscar resultados.");
        
        const data = await res.json();
        
        const initialMediaList: MediaItem[] = data.results.filter(
          (item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
        );
        
        // Verifica a disponibilidade
        const availabilityChecks = initialMediaList.map(async (item) => ({
          ...item,
          isAvailable: await verifyMediaAvailability(item),
        }));
        
        const resultsWithAvailability = await Promise.all(availabilityChecks);
        const availableMedia = resultsWithAvailability.filter(item => item.isAvailable);

        setResults(availableMedia);
        setTotalPages(data.total_pages > 500 ? 500 : data.total_pages);
      } catch (error) {
        console.error("Erro ao buscar:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [query, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Resultados da Busca
        </h1>
        {query ? (
          <p className="mt-2 text-zinc-400">
            Você buscou por: <span className="font-bold text-white">"{query}"</span>
          </p>
        ) : (
          <p className="mt-2 text-zinc-400">
            Digite algo na busca para começar.
          </p>
        )}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${query}-${currentPage}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {loading ? (
                <div className="flex h-96 items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
                </div>
              ) : (
                <>
                  {results.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {results.map((item) => (
                        <MediaCard key={`${item.id}-${item.media_type}`} item={item} />
                      ))}
                    </div>
                  ) : (
                    query && <p className="pt-16 text-center text-zinc-400">Nenhum resultado disponível encontrado para "{query}".</p>
                  )}
                  {totalPages > 1 && (
                    <div className="mt-8 flex justify-center">
                      <PaginationComponent
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                      />
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
        </div>
    }>
      <SearchResults />
    </Suspense>
  )
}