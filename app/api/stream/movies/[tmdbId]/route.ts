// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc"; // <-- CHAVE ATUALIZADA
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// ... (o resto do arquivo permanece o mesmo)
export async function GET(request: Request, { params }: { params: { tmdbId: string } }) {
  const { tmdbId } = params;

  if (!tmdbId) {
    return NextResponse.json({ error: "TMDB ID é necessário." }, { status: 400 });
  }

  try {
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);

    const cacheHeaders = {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800'
    };
    const notFoundCacheHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=150'
    };

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
      console.warn("Não foi possível buscar informações do TMDb para o filme:", tmdbId, tmdbError);
    }

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.type === 'movie' && data.urls && data.urls.length > 0) {
        const validStream = data.urls.find((u: any) => u?.url?.includes("short.icu"));
        
        if (validStream) {
          const stream = {
              playerType: 'abyss',
              url: validStream.url,
              name: validStream.quality || "Fonte Principal"
          };
          return NextResponse.json({ 
            streams: [stream], 
            title: movieTitle || data.title,
            originalTitle: originalMovieTitle,
            backdropPath: backdropPath
          }, { headers: cacheHeaders });
        }
      }
    }
    
    return NextResponse.json({ 
      streams: [], 
      title: movieTitle || null, 
      originalTitle: originalMovieTitle,
      backdropPath: backdropPath
    }, { headers: notFoundCacheHeaders });

  } catch (error) {
    console.error(`Erro ao buscar streams para o filme ${tmdbId}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}