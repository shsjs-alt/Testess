// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

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
                return NextResponse.json({ streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Principal" }], ...mediaInfo });
            }
            return NextResponse.json({ streams: [{ playerType: "iframe", url: firestoreUrl, name: "Servidor Principal" }], ...mediaInfo });
        }
    }
    return null;
}

// Função para extrair o link .m3u8 do HTML
function extractM3u8Url(html: string): string | null {
    const regex = /(https?:\/\/[^'"]+\.(?:m3u8|mp4))/i;
    const match = html.match(regex);
    return match ? match[0] : null;
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
    const { protocol, host } = new URL(request.url);
    const baseUrl = `${protocol}//${host}`;

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
        console.warn(`API de Filmes: Não foi possível buscar TMDB para ${tmdbId}`, tmdbError);
    }
    
    // 1. Tenta buscar no Firestore
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
    if (firestoreResponse) {
        return firestoreResponse;
    }

    // 2. Se não encontrou, raspa a URL da Roxano
    console.log(`[Filme ${tmdbId}] Raspando RoxanoPlay...`);
    const roxanoPageUrl = `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${tmdbId}`;
    const pageResponse = await fetch(roxanoPageUrl);
    if (!pageResponse.ok) {
        throw new Error("Página da Roxano não encontrada.");
    }
    const pageHtml = await pageResponse.text();
    const scrapedUrl = extractM3u8Url(pageHtml);

    if (scrapedUrl) {
        console.log(`[Filme ${tmdbId}] URL extraída: ${scrapedUrl}`);
        // 3. Passa a URL raspada pelo nosso proxy
        const proxyUrl = `${baseUrl}/api/video-proxy?videoUrl=${encodeURIComponent(scrapedUrl)}`;
        return NextResponse.json({ streams: [{ playerType: "custom", url: proxyUrl, name: "Servidor Secundário" }], ...mediaInfo });
    }

    console.error(`[Filme ${tmdbId}] Não foi possível extrair o link do vídeo da página.`);
    return NextResponse.json({ error: "Nenhum stream disponível para este filme no momento." }, { status: 404 });

  } catch (error: any) {
    console.error(`[Filme ${tmdbId}] Erro geral:`, error.message);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}