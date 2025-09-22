// app/api/stream/series/[...params]/route.ts
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
    return NextResponse.json({ error: "TMDB ID, temporada e episódio são necessários." }, { status: 400 });
  }

  try {
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
      console.warn("[API Séries] Falha ao buscar dados do TMDB.", tmdbError);
    }
    
    const cacheHeaders = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800" };

    // 1. Tenta buscar da Roxano
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;
    try {
      const response = await fetch(roxanoUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      if (response.ok && Number(response.headers.get("Content-Length")) > 0) {
        console.log(`[API Séries] Sucesso com Roxano para ${tmdbId} S${season}E${episode}`);
        const roxanoStream = {
          playerType: "custom",
          url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
          name: `Servidor Principal (T${season} E${episode})`,
        };
        return NextResponse.json({
          streams: [roxanoStream], title: tvTitle, originalTitle: originalTvTitle, backdropPath: backdropPath,
        }, { headers: cacheHeaders });
      }
    } catch (error) {
      console.warn(`[API Séries] Roxano falhou para ${tmdbId} S${season}E${episode}. Tentando Firestore...`);
    }

    // 2. Fallback para o Firestore
    const docRef = doc(firestore, "series", tmdbId, "seasons", season, "episodes", episode);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data()?.mp4Url) {
      console.log(`[API Séries] Sucesso com Firestore para ${tmdbId} S${season}E${episode}`);
      const firestoreStream = {
        playerType: "default",
        url: docSnap.data().mp4Url,
        name: `Servidor Secundário (T${season} E${episode})`,
      };
      return NextResponse.json({
        streams: [firestoreStream], title: tvTitle, originalTitle: originalTvTitle, backdropPath: backdropPath,
      }, { headers: cacheHeaders });
    }

    // 3. Se nenhuma fonte funcionar
    console.error(`[API Séries] Nenhuma fonte de stream encontrada para ${tmdbId} S${season}E${episode}`);
    return NextResponse.json({ error: "Não foi possível obter o link de streaming." }, { status: 404 });

  } catch (error) {
    console.error(`[API Séries] Erro crítico para ${tmdbId} S${season}E${episode}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams." }, { status: 500 });
  }
}