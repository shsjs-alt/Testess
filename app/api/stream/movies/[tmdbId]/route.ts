// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(
  request: Request,
  { params }: { params: { tmdbId: string } }
) {
  const { tmdbId } = params;

  if (!tmdbId) {
    return NextResponse.json(
      { error: "TMDB ID é necessário." },
      { status: 400 }
    );
  }

  try {
    // --- MUDANÇA 1: Buscar dados do filme no TMDB ---
    let movieTitle: string | null = null;
    let originalMovieTitle: string | null = null;
    let backdropPath: string | null = null;

    try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        movieTitle = tmdbData.title;
        originalMovieTitle = tmdbData.original_title;
        backdropPath = tmdbData.backdrop_path;
      }
    } catch (tmdbError) {
      console.warn("API de Filmes: Não foi possível buscar informações do TMDB para o filme:", tmdbId, tmdbError);
    }
    
    // Monta o link da API de stream.
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;

    const stream = {
      playerType: "custom",
      url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
      name: "Servidor Principal",
    };

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    };
    
    // --- MUDANÇA 2: Retornar os dados do filme junto com o link ---
    return NextResponse.json({
      streams: [stream],
      title: movieTitle,          // Nome real do filme
      originalTitle: originalMovieTitle,
      backdropPath: backdropPath, // Imagem de fundo
    }, { headers: cacheHeaders });

  } catch (error) {
    console.error(`Erro ao buscar streams para o filme ${tmdbId}:`, error);
    return NextResponse.json(
      { error: "Falha ao buscar streams" },
      { status: 500 }
    );
  }
}