// PrimeVicio - Site/app/api/stream/movies/[tmdbId]/route.ts
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
    return NextResponse.json(
      { error: "TMDB ID é necessário." },
      { status: 400 }
    );
  }

  try {
    // Tenta primeiro a API Roxano
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
    let stream = {
      playerType: "custom",
      url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
      name: "Servidor Principal",
    };

    // --- LÓGICA DE FALLBACK ---
    // Se a roxano não funcionar (a validação real do link é no proxy),
    // aqui adicionamos a lógica para buscar no Firebase.
    // A API agora tentará buscar no Firestore se a primeira fonte falhar.

    const docRef = doc(firestore, "movies", tmdbId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() && !roxanoUrl) { // Se não tem nem no Firestore nem na Roxano
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

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    };
    
    return NextResponse.json({
      streams,
      title: movieTitle,
      originalTitle: originalMovieTitle,
      backdropPath: backdropPath,
    }, { headers: cacheHeaders });

  } catch (error) {
    console.error(`Erro ao buscar streams para o filme ${tmdbId}:`, error);
    return NextResponse.json(
      { error: "Falha ao buscar streams" },
      { status: 500 }
    );
  }
}