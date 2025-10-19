// components/media-grid-page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import PaginationComponent from "@/components/PaginationComponent"
import { MediaCard, type MediaItem } from "@/components/media-card"

const API_KEY = "860b66ade580bacae581f4228fad49fc";
const API_BASE_URL = "https://api.themoviedb.org/3";

type MediaGridPageProps = {
  title: string;
  fetchUrl: string;
  mediaType: "movie" | "tv";
};

export default function MediaGridPage({ title, fetchUrl, mediaType }: MediaGridPageProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchMedia = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${fetchUrl}&api_key=${API_KEY}&language=pt-BR&page=${page}`);
      if (!res.ok) throw new Error(`Falha ao buscar dados do TMDB para ${title}.`);
      
      const data = await res.json();
      
      const validMedia = data.results.filter((item: any) => item.poster_path).map((item: any) => ({
        ...item,
        media_type: item.media_type || mediaType,
      }));

      setMedia(validMedia);
      // A API do TMDB limita a paginação a 500 páginas
      setTotalPages(data.total_pages > 500 ? 500 : data.total_pages);
    } catch (error) {
      console.error(`Erro ao buscar mídia para ${title}:`, error);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, title, mediaType]);

  useEffect(() => {
    fetchMedia(currentPage);
  }, [currentPage, fetchMedia]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">{title}</h1>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
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
                {media.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {media.map((item) => (
                      <MediaCard key={`${item.id}-${item.media_type}`} item={item} />
                    ))}
                  </div>
                ) : (
                   <p className="text-center text-zinc-400">Nenhum resultado encontrado para esta categoria.</p>
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
      </main>
    </div>
  );
}