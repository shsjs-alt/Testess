// PrimeVicio - Site/app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

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
    // Tenta primeiro a API Roxano
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;
    let stream = {
      playerType: "custom",
      url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
      name: `Servidor Principal (T${season} E${episode})`,
    };
    
    // --- LÓGICA DE FALLBACK ---
    const docRef = doc(firestore, "series", tmdbId, "seasons", season, "episodes", episode);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() && !roxanoUrl) {
        return NextResponse.json({ error: "Nenhum stream encontrado" }, { status: 404 });
    }
    
    let streams = [];
    if(roxanoUrl) {
        streams.push(stream);
    }
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.downloadUrl) {
            streams.push({
                playerType: "mp4",
                url: data.downloadUrl,
                name: "Servidor Alternativo"
            });
        }
    }

    // --- CORREÇÃO 1: Buscando dados da série no TMDB ---
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
    
    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    };
    
    return NextResponse.json({
      streams,
      title: tvTitle,
      originalTitle: originalTvTitle,
      backdropPath: backdropPath,
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