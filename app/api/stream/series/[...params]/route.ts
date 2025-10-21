// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function getFirestoreStreamData(docSnap: DocumentSnapshot, season: string, episodeNum: number) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        const seasonData = docData?.seasons?.[season];
        if (seasonData?.episodes) {
            const episodeData = seasonData.episodes.find((ep: any) => ep.episode_number === episodeNum);
            if (episodeData?.urls?.length > 0) {
                console.log(`[Série ${docSnap.id}] Stream encontrado no Firestore.`);
                return episodeData.urls.map((stream: any) => ({
                    playerType: "custom",
                    url: stream.url,
                    name: stream.quality || "HD",
                    thumbnailUrl: stream.thumbnailUrl,
                }));
            }
        }
    }
    return null;
}

async function getTmdbInfo(tmdbId: string) {
    try {
        const tmdbRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
        if (tmdbRes.ok) {
            const tmdbData = await tmdbRes.json();
            return {
                title: tmdbData.name,
                originalTitle: tmdbData.original_name,
                backdropPath: tmdbData.backdrop_path,
            };
        }
    } catch (e) {
        console.warn(`[API de Séries] Falha ao buscar TMDB para ${tmdbId}`, e);
    }
    return { title: null, originalTitle: null, backdropPath: null };
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
    // MODIFICAÇÃO: Executa as buscas em paralelo
    const [tmdbInfo, firestoreDoc] = await Promise.all([
        getTmdbInfo(tmdbId),
        getDoc(doc(firestore, "media", tmdbId))
    ]);

    const firestoreStreams = await getFirestoreStreamData(firestoreDoc, season, episodeNum);

    if (firestoreStreams) {
        return NextResponse.json({ streams: firestoreStreams, ...tmdbInfo });
    }

    // Se não encontrou no Firestore, usa o fallback
    console.log(`[API de Séries] Nenhum stream no Firestore. Usando fallback para S${season}E${episode}`);
    const fallbackUrl = `https://roxanoplay.bb-bet.top/pages/proxys.php?id=${tmdbId}/${season}/${episode}`;

    return NextResponse.json({
        streams: [{ playerType: "custom", url: fallbackUrl, name: "Servidor Secundário" }],
        ...tmdbInfo
    });

  } catch (error: any) {
    console.error(`[Série ${tmdbId}] Erro geral para S${season}E${episode}:`, error.message);
    return NextResponse.json({ error: "Falha ao processar a requisição da série" }, { status: 500 });
  }
}