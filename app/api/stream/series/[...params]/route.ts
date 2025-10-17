// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Função auxiliar para verificar se é um link de stream direto
function isDirectStreamLink(url: string): boolean {
    try {
        const path = new URL(url).pathname.toLowerCase().split('?')[0];
        return path.endsWith('.mp4') || path.endsWith('.m3u8');
    } catch (error) {
        return false;
    }
}

// Função para buscar o stream do Firestore para séries
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
                    const playerType = isDirectStreamLink(firestoreUrl) ? "custom" : "iframe";
                    return NextResponse.json({ 
                        streams: [{ playerType, url: firestoreUrl, name: "Servidor Principal" }], 
                        ...mediaInfo 
                    });
                }
            }
        }
    }
    return null; // Retorna nulo se não encontrar
}


export async function GET(
  request: Request,
  { params }: { params: { params: string[] } }
) {
  const [tmdbId, season, episode] = params.params;
  const episodeNum = parseInt(episode, 10);

  if (!tmdbId || !season || isNaN(episodeNum)) {
    return NextResponse.json({ error: "ID da série, temporada e episódio são necessários." }, { status: 400 });
  }

  try {
    // Busca informações da série no TMDB para o overlay
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
      console.warn(`[API de Séries] Não foi possível buscar TMDB para ${tmdbId}`, tmdbError);
    }
    
    // 1. Tenta buscar no Firestore PRIMEIRO
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const firestoreResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);

    if (firestoreResponse) {
        return firestoreResponse; // Se encontrou, retorna a resposta do Firestore
    }

    // 2. Se NÃO encontrou, usa a API da Roxano como fallback
    console.log(`[API de Séries] Nenhum stream no Firestore. Usando fallback da Roxano para S${season}E${episode}`);
    const roxanoUrl = `https://roxanoplay.bb-bet.top/pages/proxys.php?id=${tmdbId}/${season}/${episode}`;

    // Retorna a URL da Roxano para ser usada no player personalizado
    return NextResponse.json({ 
        streams: [{ 
            playerType: "custom", 
            url: roxanoUrl, 
            name: "Servidor Secundário" 
        }], 
        ...mediaInfo 
    });

  } catch (error: any) {
    console.error(`[Série ${tmdbId}] Erro geral para S${season}E${episode}:`, error.message);
    return NextResponse.json({ error: "Falha ao processar a requisição da série" }, { status: 500 });
  }
}