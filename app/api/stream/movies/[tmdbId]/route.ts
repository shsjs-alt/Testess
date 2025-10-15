// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase"; //
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php"; ///route.ts]
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

async function getFirestoreStream(docSnap: DocumentSnapshot, mediaInfo: any) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
            const firestoreUrl = docData.urls[0].url as string;
            console.log(`[Filme ${docSnap.id}] Encontrado stream no Firestore: ${firestoreUrl}`);
            if (isDirectStreamLink(firestoreUrl)) {
                return NextResponse.json({ streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Direto" }], ...mediaInfo });
            }
            return NextResponse.json({ streams: [{ playerType: "iframe", url: firestoreUrl, name: "Servidor Externo" }], ...mediaInfo });
        }
    }
    return null;
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
    let mediaInfo = { title: null, originalTitle: null, backdropPath: null };
    try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`); ///route.ts]
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        mediaInfo = {
            title: tmdbData.title,
            originalTitle: tmdbData.original_title,
            backdropPath: tmdbData.backdrop_path,
        };
      }
    } catch (tmdbError) {
      console.warn(`API de Filmes: Não foi possível buscar informações do TMDB para o filme: ${tmdbId}`, tmdbError);
    }

    const docRef = doc(firestore, "media", tmdbId); ///route.ts]
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) { ///route.ts]
        console.log(`[Filme ${tmdbId}] Forçando o uso do Firestore.`);
        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) return firestoreResponse;
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado." }, { status: 404 });
    }

    const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
    if (firestoreResponse) {
        console.log(`[Filme ${tmdbId}] Encontrado stream no Firestore. Usando como prioridade.`);
        return firestoreResponse;
    }

    try {
        const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`; ///route.ts]
        console.log(`[Filme ${tmdbId}] Buscando stream da API externa: ${roxanoUrl}`);
        
        const roxanoRes = await fetch(roxanoUrl, { headers: { 'Referer': 'https://google.com/' }});

        if (!roxanoRes.ok) {
            throw new Error(`API Externa respondeu com status ${roxanoRes.status}`);
        }

        const roxanoData = await roxanoRes.json();
        console.log(`[Filme ${tmdbId}] Resposta JSON da API externa:`, JSON.stringify(roxanoData));

        const finalStreamUrl = roxanoData.url || (Array.isArray(roxanoData.streams) && roxanoData.streams[0]?.url);

        if (!finalStreamUrl || typeof finalStreamUrl !== 'string') {
            console.error(`[Filme ${tmdbId}] URL de stream não encontrada na resposta.`);
            throw new Error("A resposta da API externa não continha uma URL de stream válida.");
        }
        
        console.log(`[Filme ${tmdbId}] URL final obtida: ${finalStreamUrl}`);

        const proxyUrl = `/api/video-proxy?videoUrl=${encodeURIComponent(finalStreamUrl)}`; ///route.ts]
        console.log(`[Filme ${tmdbId}] Retornando URL para o proxy de redirecionamento: ${proxyUrl}`);

        const stream = {
            playerType: "custom", ///route.ts]
            url: proxyUrl, ///route.ts]
            name: "Servidor Principal",
        };

        return NextResponse.json({ streams: [stream], ...mediaInfo });

    } catch (externalApiError: any) {
        console.error(`[Filme ${tmdbId}] Falha ao buscar stream da API externa:`, externalApiError.message);
        return NextResponse.json({ error: "Nenhum stream disponível para este filme no momento." }, { status: 404 });
    }

  } catch (error) {
    console.error(`[Filme ${tmdbId}] Erro geral ao buscar streams:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}