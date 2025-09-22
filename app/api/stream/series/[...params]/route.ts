// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc"; // <-- CHAVE ATUALIZADA
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// ... (o resto do arquivo permanece o mesmo)
export async function GET(request: Request, { params }: { params: { params: string[] } }) {
  const [tmdbId, season, episode] = params.params;

  if (!tmdbId || !season || !episode) {
    return NextResponse.json({ error: "TMDB ID, temporada e episódio são necessários." }, { status: 400 });
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
      console.warn("Não foi possível buscar informações do TMDb para a série:", tmdbId, tmdbError);
    }

    if (docSnap.exists()) {
      const data = docSnap.data();
      const seasonData = data.seasons?.[season];
      const episodeData = seasonData?.episodes?.find(
        (ep: any) => ep.episode_number == parseInt(episode)
      );

      if (episodeData && episodeData.urls && episodeData.urls.length > 0) {
        const abyssStream = episodeData.urls.find((u: any) => u.url?.includes("short.icu"));
        if (abyssStream) {
          const stream = {
            playerType: 'abyss',
            url: abyssStream.url,
            name: abyssStream.quality || `T${season} E${episode}`
          };
          return NextResponse.json({ 
            streams: [stream], 
            title: tvTitle || data.title,
            originalTitle: originalTvTitle,
            backdropPath: backdropPath
          }, { headers: cacheHeaders });
        }
      }
    }
    
    return NextResponse.json({ 
      streams: [], 
      title: tvTitle || null, 
      originalTitle: originalTvTitle,
      backdropPath: backdropPath
    }, { headers: notFoundCacheHeaders });

  } catch (error) {
    console.error(`Erro ao buscar streams para a série ${tmdbId} S${season}E${episode}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}