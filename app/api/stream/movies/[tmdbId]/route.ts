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
    // Busca detalhes do filme no TMDB (título, imagem, etc.)
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
      console.warn("API de Filmes: Não foi possível buscar informações do TMDB.", tmdbError);
    }

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    };

    // 1. Tenta buscar da API da Roxano
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos de timeout

      // Usamos 'HEAD' para uma verificação rápida sem baixar o conteúdo
      const response = await fetch(roxanoUrl, { signal: controller.signal, method: 'HEAD' }); 
      clearTimeout(timeoutId);

      if (response.ok && response.headers.get("Content-Length") !== "0") {
        console.log(`[API Filmes] Stream encontrado na Roxano para TMDB ID: ${tmdbId}`);
        const roxanoStream = {
          playerType: "custom",
          url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
          name: "Servidor Principal",
        };
        return NextResponse.json({
          streams: [roxanoStream],
          title: movieTitle,
          originalTitle: originalMovieTitle,
          backdropPath: backdropPath,
        }, { headers: cacheHeaders });
      }
      throw new Error(`Roxano respondeu com status: ${response.status}`);
    } catch (error) {
      console.warn(`[API Filmes] Roxano falhou para ${tmdbId}. Tentando Firestore... Erro:`, error);
      
      // 2. Fallback para o Firestore
      const docRef = doc(firestore, "movies", tmdbId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().mp4Url) {
        console.log(`[API Filmes] Stream encontrado no Firestore para TMDB ID: ${tmdbId}`);
        const firestoreStream = {
          playerType: "custom",
          url: docSnap.data().mp4Url, // Link direto para o MP4
          name: "Servidor Secundário",
        };

        return NextResponse.json({
          streams: [firestoreStream],
          title: movieTitle,
          originalTitle: originalMovieTitle,
          backdropPath: backdropPath,
        }, { headers: cacheHeaders });
      }
    }

    // 3. Se nenhuma fonte funcionar
    console.log(`[API Filmes] Nenhum stream encontrado para TMDB ID: ${tmdbId}`);
    return NextResponse.json(
      { error: "Nenhum stream encontrado para este filme." },
      { status: 404 }
    );

  } catch (error) {
    console.error(`[API Filmes] Erro geral ao buscar streams para o filme ${tmdbId}:`, error);
    return NextResponse.json(
      { error: "Falha geral ao buscar streams" },
      { status: 500 }
    );
  }
}