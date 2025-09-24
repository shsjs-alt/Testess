// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/proxys.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function getFirestoreStream(docData: any, season: string, episodeNum: number, mediaInfo: any) {
    if (docData) {
        const seasonData = docData.seasons?.[season];
        if (seasonData && Array.isArray(seasonData.episodes)) {
            const episodeData = seasonData.episodes.find((ep: any) => ep.episode_number === episodeNum);
            if (episodeData && Array.isArray(episodeData.urls) && episodeData.urls.length > 0 && episodeData.urls[0].url) {
                const firestoreStream = {
                    playerType: "custom",
                    url: episodeData.urls[0].url,
                    name: "Servidor Firebase",
                };
                return NextResponse.json({ streams: [firestoreStream], ...mediaInfo });
            }
        }
    }
    return null;
}

export async function GET(
  request: Request,
  { params }: { params: { params: string[] } }
) {
  const [tmdbId, season, episode] = params.params;
  const seasonNum = parseInt(season, 10);
  const episodeNum = parseInt(episode, 10);

  if (!tmdbId || isNaN(seasonNum) || isNaN(episodeNum)) {
    return NextResponse.json({ error: "TMDB ID, temporada e episódio são necessários." }, { status: 400 });
  }

  try {
    let mediaInfo = { title: null, originalTitle: null, backdropPath: null };
    try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        mediaInfo = {
            title: tmdbData.name,
            originalTitle: tmdbData.original_name,
            backdropPath: tmdbData.backdrop_path,
        };
      }
    } catch (tmdbError) {
      console.warn("API de Séries: Não foi possível buscar informações do TMDB para a série:", tmdbId, tmdbError);
    }
    
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const docData = docSnap.exists() ? docSnap.data() : null;

    // --- LÓGICA DE PRIORIDADE ---
    // 1. Se 'forceFirestore' for true, tenta o Firestore IMEDIATAMENTE.
    if (docData?.forceFirestore === true) {
        const firestoreResponse = await getFirestoreStream(docData, season, episodeNum, mediaInfo);
        if (firestoreResponse) return firestoreResponse;
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado para este episódio." }, { status: 404 });
    }

    // 2. Se não for forçado, tenta a API principal primeiro.
    try {
      const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;
      const response = await fetch(roxanoUrl);
      if (response.ok && response.headers.get('content-length') !== '0') {
        const stream = {
          playerType: "custom",
          url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
          name: `Servidor Principal (T${season} E${episode})`,
        };
        return NextResponse.json({ streams: [stream], ...mediaInfo });
      }
    } catch (error) {
      console.log("API Principal de séries falhou, tentando fallback para o Firestore...");
    }

    // 3. Fallback para o Firestore se a API principal falhar.
    const firestoreFallbackResponse = await getFirestoreStream(docData, season, episodeNum, mediaInfo);
    if (firestoreFallbackResponse) return firestoreFallbackResponse;

    return NextResponse.json({ error: "Nenhum stream disponível para este episódio." }, { status: 404 });

  } catch (error) {
    console.error(`Erro ao buscar streams para a série ${tmdbId} S${season}E${episode}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}