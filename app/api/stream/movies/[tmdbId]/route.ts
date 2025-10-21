// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function getFirestoreStreamData(docSnap: DocumentSnapshot) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData?.urls?.length > 0) {
            console.log(`[Filme ${docSnap.id}] Stream encontrado no Firestore.`);
            return docData.urls.map((stream: any) => ({
                playerType: "custom",
                url: stream.url,
                name: stream.quality || "HD",
                thumbnailUrl: stream.thumbnailUrl,
            }));
        }
    }
    return null;
}

async function getTmdbInfo(tmdbId: string) {
    try {
        const tmdbRes = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
        if (tmdbRes.ok) {
            const tmdbData = await tmdbRes.json();
            return {
                title: tmdbData.title,
                originalTitle: tmdbData.original_title,
                backdropPath: tmdbData.backdrop_path,
            };
        }
    } catch (e) {
        console.warn(`[API de Filmes] Falha ao buscar TMDB para ${tmdbId}`, e);
    }
    return { title: null, originalTitle: null, backdropPath: null };
}

export async function GET(
  request: Request,
  { params }: { params: { tmdbId: string } }
) {
  const { tmdbId } = params;
  if (!tmdbId) {
    return NextResponse.json({ error: "TMDB ID é necessário." }, { status: 400 });
  }

  try {
    // MODIFICAÇÃO: Executa as buscas em paralelo
    const [tmdbInfo, firestoreDoc] = await Promise.all([
        getTmdbInfo(tmdbId),
        getDoc(doc(firestore, "media", tmdbId))
    ]);

    const firestoreStreams = await getFirestoreStreamData(firestoreDoc);
    
    if (firestoreStreams) {
        return NextResponse.json({ streams: firestoreStreams, ...tmdbInfo });
    }

    // Se não encontrou no Firestore, usa o fallback
    console.log(`[API de Filmes] Nenhum stream no Firestore. Usando fallback para TMDB ${tmdbId}`);
    const fallbackUrl = `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${tmdbId}`;
    
    return NextResponse.json({ 
        streams: [{ playerType: "custom", url: fallbackUrl, name: "Servidor Secundário" }], 
        ...tmdbInfo 
    });

  } catch (error: any) {
    console.error(`[Filme ${tmdbId}] Erro geral:`, error.message);
    return NextResponse.json({ error: "Falha ao processar a requisição do filme" }, { status: 500 });
  }
}