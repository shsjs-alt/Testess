// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/proxys.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function isDirectStreamLink(url: string): boolean {
    try {
        const path = new URL(url).pathname.toLowerCase().split('?')[0];
        return path.endsWith('.mp4') || path.endsWith('.m3u8');
    } catch (error) {
        return false;
    }
}

async function getFirestoreStream(docSnap: DocumentSnapshot, season: string, episodeNum: number, mediaInfo: any) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData) {
            const seasonData = docData.seasons?.[season];
            if (seasonData && Array.isArray(seasonData.episodes)) {
                const episodeData = seasonData.episodes.find((ep: any) => ep.episode_number === episodeNum);
                if (episodeData && Array.isArray(episodeData.urls) && episodeData.urls.length > 0 && episodeData.urls[0].url) {
                    const firestoreUrl = episodeData.urls[0].url as string;

                    if (isDirectStreamLink(firestoreUrl)) {
                        console.log(`[Série] Link de stream direto do Firestore, enviando diretamente: ${firestoreUrl}`);
                        return NextResponse.json({
                            streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Direto" }],
                            ...mediaInfo
                        });
                    }

                    console.log(`[Série] Link de player embed (iframe) do Firestore: ${firestoreUrl}`);
                    return NextResponse.json({
                        streams: [{ playerType: "iframe", url: firestoreUrl, name: "Servidor Externo" }],
                        ...mediaInfo
                    });
                }
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
  const episodeNum = parseInt(episode, 10);

  if (!tmdbId || !season || isNaN(episodeNum)) {
    return NextResponse.json({ error: "ID, temporada e episódio são necessários." }, { status: 400 });
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
    
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) {
        console.log(`[Série ${tmdbId}] Forçando o uso do Firestore.`);
        const firestoreResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);
        if (firestoreResponse) {
            return firestoreResponse;
        }
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado para este episódio." }, { status: 404 });
    }

    // NOVA LÓGICA: Retorna a URL da Roxano diretamente para o cliente manipular.
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;
    console.log(`[Série ${tmdbId}] Retornando URL da API Roxano para o cliente: ${roxanoUrl}`);

    const stream = {
        playerType: "custom",
        url: roxanoUrl,
        name: `Servidor Principal (T${season} E${episode})`,
    };
    return NextResponse.json({ streams: [stream], ...mediaInfo });

  } catch (error) {
    console.error(`[Série ${tmdbId}] Erro geral ao buscar streams para S${season}E${episode}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}