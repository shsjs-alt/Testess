// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php";
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

async function getFirestoreStream(docSnap: DocumentSnapshot, mediaInfo: any) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
            const firestoreUrl = docData.urls[0].url as string;
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
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
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

    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) {
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

    // ✨ NOVA LÓGICA CORRIGIDA AQUI ✨
    try {
        const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
        console.log(`[Filme ${tmdbId}] Buscando stream da API externa: ${roxanoUrl}`);
        const roxanoRes = await fetch(roxanoUrl, { headers: { 'Referer': 'https://cineveo.lat/' }});

        if (!roxanoRes.ok) {
            throw new Error(`API Externa respondeu com status ${roxanoRes.status}`);
        }

        const roxanoData = await roxanoRes.json();
        // Tenta pegar a URL de 'url' ou do primeiro item de 'streams'
        const finalStreamUrl = roxanoData.url || (Array.isArray(roxanoData.streams) && roxanoData.streams[0]?.url);

        if (!finalStreamUrl || typeof finalStreamUrl !== 'string') {
            throw new Error("A resposta da API externa não continha uma URL de stream válida.");
        }
        
        console.log(`[Filme ${tmdbId}] URL final obtida: ${finalStreamUrl}`);

        const proxyUrl = `/api/video-proxy?videoUrl=${encodeURIComponent(finalStreamUrl)}`;
        console.log(`[Filme ${tmdbId}] Retornando URL final via proxy local: ${proxyUrl}`);

        const stream = {
            playerType: "custom",
            url: proxyUrl,
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