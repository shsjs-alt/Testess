// app/api/download/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function getFirestoreStreamUrl(docData: any, season: string, episodeNum: number) {
    if (docData) {
        const seasonData = docData.seasons?.[season];
        if (seasonData && Array.isArray(seasonData.episodes)) {
            const episodeData = seasonData.episodes.find((ep: any) => ep.episode_number === episodeNum);
            if (episodeData && Array.isArray(episodeData.urls) && episodeData.urls.length > 0 && episodeData.urls[0].url) {
                return episodeData.urls[0].url;
            }
        }
    }
    return null;
}

async function fetchAndStream(url: string, title: string) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": "https://www.google.com/"
        }
    });

    if (!response.ok || !response.body) {
        throw new Error(`Falha ao buscar o vídeo de ${url}. Status: ${response.status}`);
    }

    const headers = new Headers({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9 ]/g, '')}.mp4"`,
    });

    return new NextResponse(response.body, { headers });
}

export async function GET(
  request: Request,
  { params }: { params: { params: string[] } }
) {
  const [tmdbId, season, episode] = params.params;
  const episodeNum = parseInt(episode, 10);

  if (!tmdbId || !season || isNaN(episodeNum)) {
    return NextResponse.json({ error: "ID, temporada e episódio são necessários." }, { status: 400 });
  }

  try {
    let mediaTitle = `S${season}E${episode}`;
     try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        mediaTitle = `${tmdbData.name} S${season}E${episode}`;
      }
    } catch (e) {
        console.warn("API de Download: Não foi possível buscar título do TMDB")
    }

    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const docData = docSnap.exists() ? docSnap.data() : null;

    const firestoreUrl = await getFirestoreStreamUrl(docData, season, episodeNum);
    if (firestoreUrl) return fetchAndStream(firestoreUrl, mediaTitle);

    return NextResponse.json({ error: "Nenhum link de download disponível." }, { status: 404 });

  } catch (error: any) {
    console.error(`Erro ao processar download para a série ${tmdbId} S${season}E${episode}:`, error);
    return NextResponse.json({ error: error.message || "Falha ao processar o download." }, { status: 500 });
  }
}