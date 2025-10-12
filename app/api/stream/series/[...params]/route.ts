// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/proxys.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Função para extrair o ID de um link do Google Drive
function getGoogleDriveId(url: string): string | null {
    const regex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
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

                    const googleDriveId = getGoogleDriveId(firestoreUrl);
                    if (googleDriveId) {
                        const gdriveStream = {
                            playerType: "gdrive",
                            url: `https://drive.google.com/file/d/${googleDriveId}/preview`,
                            name: "Servidor Google Drive",
                        };
                        return NextResponse.json({ streams: [gdriveStream], ...mediaInfo });
                    }

                    const safeUrl = encodeURIComponent(decodeURIComponent(firestoreUrl));

                    const firestoreStream = {
                        playerType: "custom",
                        url: `/api/video-proxy?videoUrl=${safeUrl}`,
                        name: "Servidor Firebase",
                    };
                    return NextResponse.json({ streams: [firestoreStream], ...mediaInfo });
                }
            }
        }
    }
    return null;
}

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
    
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    
    // 1. Lógica para quando o `forceFirestore` está ativado
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) {
        console.log(`[Série ${tmdbId}] Forçando o uso do Firestore.`);
        const firestoreResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);
        if (firestoreResponse) {
            return firestoreResponse;
        }
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado para este episódio." }, { status: 404 });
    }

    // 2. Lógica Padrão: Tenta a API Principal primeiro
    try {
      const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;
      const roxanoResponse = await Promise.race([
          fetch(roxanoUrl, { redirect: 'follow' }),
          timeout(5000)
      ]) as Response;
    
      if (roxanoResponse.ok) {
          const finalUrl = roxanoResponse.url;
          console.log(`[Série ${tmdbId}] Sucesso com a API Principal (Roxano) para S${season}E${episode}. URL Final: ${finalUrl}`);
          const stream = {
              playerType: "custom",
              url: `/api/video-proxy?videoUrl=${encodeURIComponent(finalUrl)}`,
              name: `Servidor Principal (T${season} E${episode})`,
          };
          return NextResponse.json({ streams: [stream], ...mediaInfo });
      }
      throw new Error(`API Principal (Roxano) respondeu com status: ${roxanoResponse.status}`);
    } catch (error) {
        console.log(`[Série ${tmdbId}] API Principal (Roxano) falhou para S${season}E${episode}, tentando fallback para o Firestore...`, error);
        
        // 3. Fallback para o Firestore
        const firestoreResponse = await getFirestoreStream(docSnap, season, episodeNum, mediaInfo);
        if (firestoreResponse) {
            console.log(`[Série ${tmdbId}] Sucesso com o fallback para Firestore para S${season}E${episode}.`);
            return firestoreResponse;
        }
    }

    // 4. Se tudo falhar
    console.log(`[Série ${tmdbId}] Nenhuma fonte de stream disponível para S${season}E${episode}.`);
    return NextResponse.json({ error: "Nenhum stream disponível para este episódio." }, { status: 404 });

  } catch (error) {
    console.error(`[Série ${tmdbId}] Erro geral ao buscar streams para S${season}E${episode}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}