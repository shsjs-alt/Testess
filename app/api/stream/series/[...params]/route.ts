// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/proxys.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Helper para obter o stream do Firestore. Retorna um objeto de resposta ou null.
async function getFirestoreStream(docSnap: DocumentSnapshot, season: string, episodeNum: number, mediaInfo: any) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData) {
            const seasonData = docData.seasons?.[season];
            if (seasonData && Array.isArray(seasonData.episodes)) {
                const episodeData = seasonData.episodes.find((ep: any) => ep.episode_number === episodeNum);
                if (episodeData && Array.isArray(episodeData.urls) && episodeData.urls.length > 0 && episodeData.urls[0].url) {
                    const firestoreUrl = episodeData.urls[0].url;
                    const firestoreStream = {
                        playerType: "custom",
                        url: `/api/video-proxy?videoUrl=${encodeURIComponent(firestoreUrl)}`,
                        name: "Servidor Firebase",
                    };
                    return NextResponse.json({ streams: [firestoreStream], ...mediaInfo });
                }
            }
        }
    }
    return null;
}

// Helper para criar uma promessa que rejeita após um timeout
const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

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
    
    // Inicia a busca no Firestore em paralelo
    const docRef = doc(firestore, "media", tmdbId);
    const firestorePromise = getDoc(docRef);
    
    // Aguarda o Firestore, pois precisamos do docData para a lógica de 'force' e fallback
    const docSnap = await firestorePromise;
    
    // 1. Lógica de 'forceFirestore'
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) {
        console.log(`[Série ${tmdbId}] Forçando o uso do Firestore.`);
        const firestoreResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);
        if (firestoreResponse) return firestoreResponse;
        // Se forçado, mas não encontrado, retorna erro. Não tenta o fallback.
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado para este episódio." }, { status: 404 });
    }

    // 2. Tenta a API Principal (Roxano) com timeout
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;
    try {
        const roxanoResponse = await Promise.race([
            fetch(roxanoUrl),
            timeout(4000) // Timeout de 4 segundos
        ]) as Response;
      
        if (roxanoResponse.ok) {
            console.log(`[Série ${tmdbId}] Sucesso com a API Principal (Roxano) para S${season}E${episode}.`);
            const stream = {
                playerType: "custom",
                url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
                name: `Servidor Principal (T${season} E${episode})`,
            };
            return NextResponse.json({ streams: [stream], ...mediaInfo });
        }
        // Se a resposta não for OK, lança um erro para acionar o bloco catch e tentar o fallback.
        throw new Error(`API Principal (Roxano) respondeu com status: ${roxanoResponse.status}`);
    } catch (error) {
        // 3. Fallback para o Firestore se a API Principal falhar
        console.log(`[Série ${tmdbId}] API Principal falhou ou demorou para S${season}E${episode}. Tentando fallback para o Firestore...`, error);
        const firestoreFallbackResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);
        if (firestoreFallbackResponse) {
            console.log(`[Série ${tmdbId}] Sucesso com o fallback do Firestore para S${season}E${episode}.`);
            return firestoreFallbackResponse;
        }
    }

    // 4. Se ambas as fontes falharem
    console.log(`[Série ${tmdbId}] Nenhuma fonte de stream disponível para S${season}E${episode}.`);
    return NextResponse.json({ error: "Nenhum stream disponível para este episódio." }, { status: 404 });

  } catch (error) {
    console.error(`[Série ${tmdbId}] Erro geral ao buscar streams para S${season}E${episode}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}