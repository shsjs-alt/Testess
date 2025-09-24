// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

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

    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
    try {
      // Tenta a API principal primeiro
      const response = await fetch(roxanoUrl);
      if (response.ok && response.headers.get('content-length') !== '0') {
        const stream = {
          playerType: "custom",
          url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
          name: "Servidor Principal",
        };
        return NextResponse.json({
          streams: [stream],
          title: movieTitle,
          originalTitle: originalMovieTitle,
          backdropPath: backdropPath,
        });
      }
    } catch (error) {
      console.log("API Principal falhou, tentando fallback para o Firestore...");
    }

    // Fallback para o Firestore
    try {
      const docRef = doc(firestore, "media", tmdbId);
      const docSnap = await getDoc(docRef);
      const docData = docSnap.data();

      // Verifica se o documento existe e tem a estrutura esperada
      if (docSnap.exists() && docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
        const firestoreStream = {
          playerType: "custom",
          url: docData.urls[0].url,
          name: "Servidor Firebase",
        };
        return NextResponse.json({
          streams: [firestoreStream],
          title: movieTitle,
          originalTitle: originalMovieTitle,
          backdropPath: backdropPath,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar do Firestore:", error);
    }

    return NextResponse.json(
      { error: "Nenhum stream disponível para este filme." },
      { status: 404 }
    );

  } catch (error) {
    console.error(`Erro ao buscar streams para o filme ${tmdbId}:`, error);
    return NextResponse.json(
      { error: "Falha ao buscar streams" },
      { status: 500 }
    );
  }
}