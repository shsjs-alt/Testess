// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(
  request: Request,
  { params }: { params: { tmdbId: string } }
) {
  const { tmdbId } = params;

  if (!tmdbId) {
    return NextResponse.json({ error: "TMDB ID é necessário." }, { status: 400 });
  }

  try {
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
      console.warn("[API Filmes] Falha ao buscar dados do TMDB.", tmdbError);
    }

    const cacheHeaders = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800" };

    // 1. Tenta buscar da Roxano
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
    try {
      const response = await fetch(roxanoUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      if (response.ok && Number(response.headers.get("Content-Length")) > 0) {
        console.log(`[API Filmes] Sucesso com Roxano para TMDB ID: ${tmdbId}`);
        const roxanoStream = {
          playerType: "custom",
          url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
          name: "Servidor Principal",
        };
        return NextResponse.json({
          streams: [roxanoStream], title: movieTitle, originalTitle: originalMovieTitle, backdropPath: backdropPath,
        }, { headers: cacheHeaders });
      }
    } catch (error) {
      console.warn(`[API Filmes] Roxano falhou para ${tmdbId}. Tentando Firestore...`);
    }

    // 2. Fallback para o Firestore
    const docRef = doc(firestore, "movies", tmdbId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data()?.mp4Url) {
      console.log(`[API Filmes] Sucesso com Firestore para TMDB ID: ${tmdbId}`);
      const firestoreStream = {
        playerType: "default", // Usar player padrão para link direto
        url: docSnap.data().mp4Url,
        name: "Servidor Secundário",
      };
      return NextResponse.json({
        streams: [firestoreStream], title: movieTitle, originalTitle: originalMovieTitle, backdropPath: backdropPath,
      }, { headers: cacheHeaders });
    }

    // 3. Se nenhuma fonte funcionar
    console.error(`[API Filmes] Nenhuma fonte de stream encontrada para TMDB ID: ${tmdbId}`);
    return NextResponse.json({ error: "Não foi possível obter o link de streaming." }, { status: 404 });

  } catch (error) {
    console.error(`[API Filmes] Erro crítico para ${tmdbId}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams." }, { status: 500 });
  }
}