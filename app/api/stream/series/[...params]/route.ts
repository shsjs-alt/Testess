// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/proxys.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(
  request: Request,
  { params }: { params: { params: string[] } }
) {
  const [tmdbId, season, episode] = params.params;

  if (!tmdbId || !season || !episode) {
    return NextResponse.json(
      { error: "TMDB ID, temporada e episódio são necessários." },
      { status: 400 }
    );
  }

  try {
    // --- CORREÇÃO 1: Buscando dados da série no TMDB ---
    // Adicionamos uma busca à API do TMDB para pegar o nome real e a imagem de fundo.
    let tvTitle: string | null = null;
    let originalTvTitle: string | null = null;
    let backdropPath: string | null = null;

    try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        tvTitle = tmdbData.name;
        originalTvTitle = tmdbData.original_name;
        backdropPath = tmdbData.backdrop_path;
      }
    } catch (tmdbError) {
      console.warn("API de Séries: Não foi possível buscar informações do TMDB para a série:", tmdbId, tmdbError);
    }
    
    // Monta o link da roxanoplay.
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;

    const stream = {
      playerType: "custom",
      url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
      name: `Servidor Principal (T${season} E${episode})`,
    };

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    };
    
    // --- CORREÇÃO 2: Retornando os dados da série junto com o link ---
    // Agora a resposta da API inclui o título e a imagem de fundo.
    return NextResponse.json({
      streams: [stream],
      title: tvTitle, // Nome real da série
      originalTitle: originalTvTitle,
      backdropPath: backdropPath, // Imagem de fundo
    }, { headers: cacheHeaders });

  } catch (error) {
    console.error(
      `Erro ao buscar streams para a série ${tmdbId} S${season}E${episode}:`,
      error
    );
    return NextResponse.json(
      { error: "Falha ao buscar streams" },
      { status: 500 }
    );
  }
}