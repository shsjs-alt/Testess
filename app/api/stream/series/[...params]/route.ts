// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase"; //
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/proxys.php"; ///route.ts]
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc"; ///route.ts]
const TMDB_BASE_URL = "https://api.themoviedb.org/3"; ///route.ts]

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
                    console.log(`[Série ${docSnap.id}] Encontrado stream no Firestore: ${firestoreUrl}`);
                    if (isDirectStreamLink(firestoreUrl)) {
                        return NextResponse.json({ streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Direto" }], ...mediaInfo });
                    }
                    return NextResponse.json({ streams: [{ playerType: "iframe", url: firestoreUrl, name: "Servidor Externo" }], ...mediaInfo });
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
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`); ///route.ts]
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        mediaInfo = {
            title: tmdbData.name,
            originalTitle: tmdbData.original_name,
            backdropPath: tmdbData.backdrop_path,
        };
      }
    } catch (tmdbError) {
      console.warn(`API de Séries: Não foi possível buscar informações do TMDB para a série: ${tmdbId}`, tmdbError);
    }
    
    const docRef = doc(firestore, "media", tmdbId); ///route.ts]
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) { ///route.ts]
        console.log(`[Série ${tmdbId}] Forçando o uso do Firestore.`);
        const firestoreResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);
        if (firestoreResponse) return firestoreResponse;
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado para este episódio." }, { status: 404 });
    }

    const firestoreResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);
    if (firestoreResponse) {
        console.log(`[Série ${tmdbId}] Encontrado stream no Firestore. Usando como prioridade.`);
        return firestoreResponse;
    }
    
    try {
        const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`; ///route.ts]
        console.log(`[Série ${tmdbId}] Buscando stream da API externa: ${roxanoUrl}`);
        
        const roxanoRes = await fetch(roxanoUrl, { headers: { 'Referer': 'https://google.com/' }});

        if (!roxanoRes.ok) {
            throw new Error(`API Externa respondeu com status ${roxanoRes.status}`);
        }

        const roxanoData = await roxanoRes.json();
        console.log(`[Série ${tmdbId}] Resposta JSON da API externa:`, JSON.stringify(roxanoData));

        const finalStreamUrl = roxanoData.url || (Array.isArray(roxanoData.streams) && roxanoData.streams[0]?.url);

        if (!finalStreamUrl || typeof finalStreamUrl !== 'string') {
            console.error(`[Série ${tmdbId}] URL de stream não encontrada na resposta.`);
            throw new Error("A resposta da API externa não continha uma URL de stream válida.");
        }
        
        console.log(`[Série ${tmdbId}] URL final obtida: ${finalStreamUrl}`);

        const proxyUrl = `/api/video-proxy?videoUrl=${encodeURIComponent(finalStreamUrl)}`; ///route.ts]
        console.log(`[Série ${tmdbId}] Retornando URL para o proxy de redirecionamento: ${proxyUrl}`);
        
        const stream = {
            playerType: "custom", ///route.ts]
            url: proxyUrl, ///route.ts]
            name: `Servidor Principal (T${season} E${episode})`,
        };
        
        return NextResponse.json({ streams: [stream], ...mediaInfo });

    } catch (externalApiError: any) {
        console.error(`[Série ${tmdbId}] Falha ao buscar stream da API externa para S${season}E${episode}:`, externalApiError.message);
        return NextResponse.json({ error: "Nenhum stream disponível para este episódio no momento." }, { status: 404 });
    }

  } catch (error) {
    console.error(`[Série ${tmdbId}] Erro geral ao buscar streams para S${season}E${episode}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}