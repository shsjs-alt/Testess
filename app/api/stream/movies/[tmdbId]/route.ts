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
            console.log(`[Filme ${docSnap.id}] Encontrado stream no Firestore: ${firestoreUrl}`);
            if (isDirectStreamLink(firestoreUrl)) {
                return NextResponse.json({ streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Direto" }], ...mediaInfo });
            }
            return NextResponse.json({ streams: [{ playerType: "iframe", url: firestoreUrl, name: "Servidor Externo" }], ...mediaInfo });
        }
    }
    return null;
}

// ✨ NOVA FUNÇÃO PARA EXTRAIR O LINK DO HTML ✨
function extractUrlFromHtml(html: string): string | null {
    // Tenta encontrar o link dentro de uma tag <source src="...">
    const match = html.match(/<source.*?src=["'](.*?)["']/);
    if (match && match[1]) {
        return match[1];
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
        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) return firestoreResponse;
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado." }, { status: 404 });
    }

    const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
    if (firestoreResponse) {
        return firestoreResponse;
    }
    
    // LÓGICA DA API EXTERNA ATUALIZADA
    try {
        const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
        console.log(`[Filme ${tmdbId}] Buscando da API externa: ${roxanoUrl}`);
        
        const roxanoRes = await fetch(roxanoUrl, { headers: { 'Referer': 'https://google.com/' }});

        if (!roxanoRes.ok) {
            throw new Error(`API Externa respondeu com status ${roxanoRes.status}`);
        }

        // ✨ MUDANÇA: PEGA A RESPOSTA COMO TEXTO (HTML) ✨
        const htmlText = await roxanoRes.text();

        // ✨ MUDANÇA: EXTRAI A URL DO HTML ✨
        const finalStreamUrl = extractUrlFromHtml(htmlText);

        if (!finalStreamUrl) {
            console.error(`[Filme ${tmdbId}] Não foi possível extrair a URL do vídeo do HTML da API externa.`);
            throw new Error("A resposta da API externa mudou e o link do vídeo não foi encontrado.");
        }
        
        console.log(`[Filme ${tmdbId}] URL final extraída do HTML: ${finalStreamUrl}`);

        const proxyUrl = `/api/video-proxy?videoUrl=${encodeURIComponent(finalStreamUrl)}`;

        const stream = {
            playerType: "custom",
            url: proxyUrl,
            name: "Servidor Principal",
        };

        return NextResponse.json({ streams: [stream], ...mediaInfo });

    } catch (externalApiError: any) {
        console.error(`[Filme ${tmdbId}] Falha ao processar API externa:`, externalApiError.message);
        return NextResponse.json({ error: "Nenhum stream disponível para este filme no momento." }, { status: 404 });
    }

  } catch (error) {
    console.error(`[Filme ${tmdbId}] Erro geral:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}