// app/embed/[[...media]]/page.tsx
import { notFound } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// Interfaces para os parâmetros
interface SearchParams {
  url: string;
  title?: string;
  backdrop_path?: string;
}

interface MediaPageProps {
  params: { media: string[] };
  searchParams: SearchParams;
}

const API_KEY = "860b66ade580bacae581f4228fad49fc";
const API_BASE_URL = "https://api.themoviedb.org/3";

// Função para buscar dados da API do TMDB
async function getMediaDetails(mediaType?: string, mediaId?: string) {
  if (!mediaType || !mediaId) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/${mediaType}/${mediaId}?api_key=${API_KEY}&language=pt-BR`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Error fetching media details from TMDB:", error);
    return null;
  }
}

export default async function MediaPage({ params, searchParams }: MediaPageProps) {
  const { url } = searchParams;
  if (!url) {
    notFound();
  }

  const { media } = params;
  const mediaType = media?.[0]; // 'movie' ou 'tv'
  const mediaId = media?.[1];   // O ID do filme ou série

  let mediaTitle = searchParams.title;
  let mediaBackdrop = searchParams.backdrop_path;
  
  // Se não tivermos o título ou o fundo, busca na API
  if ((!mediaTitle || !mediaBackdrop) && mediaType && mediaId) {
    const details = await getMediaDetails(mediaType, mediaId);
    if (details) {
      if (!mediaTitle) mediaTitle = details.title || details.name;
      if (!mediaBackdrop) mediaBackdrop = details.backdrop_path;
    }
  }
  
  // Define um título padrão caso tudo falhe
  if (!mediaTitle) {
      mediaTitle = mediaType === 'movie' ? "Filme" : "Série";
  }

  const serverName = "Servidor 1";
  const quality = "Qualidade HD";

  return (
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center p-4">
      {/* Imagem de Fundo Condicional */}
      {mediaBackdrop && mediaBackdrop !== 'null' && (
        <Image
          src={`https://image.tmdb.org/t/p/original${mediaBackdrop}`}
          alt="Capa de fundo"
          fill
          priority
          quality={80}
          className="absolute inset-0 z-0 object-cover opacity-20"
          unoptimized
        />
      )}
      
      {/* Overlay Escuro */}
      <div className="absolute inset-0 bg-black/60 z-10" />

      {/* Conteúdo Central */}
      <div className="relative z-20 text-white text-center">
        <h1 className="text-3xl md:text-5xl font-bold mb-8 text-shadow-lg leading-tight">
          {mediaTitle}
        </h1>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "bg-zinc-800 hover:bg-zinc-700 text-white text-lg px-8 py-4 rounded-xl shadow-lg transition-all duration-300 ease-in-out group relative overflow-hidden"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative z-10 flex items-center justify-center gap-3">
            <svg
              className="w-6 h-6 text-red-500 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              ></path>
            </svg>
            <span className="font-semibold">{serverName}</span>
            <span className="text-sm font-light opacity-80 border-l border-white/20 pl-3 ml-3">
              {quality}
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}