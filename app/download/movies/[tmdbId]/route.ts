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
    
    // 1. Tenta buscar no Firestore
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
    if (firestoreResponse) {
        return firestoreResponse;
    }

    // 2. Se não encontrou, usa a API Roxanoplay diretamente
    console.log(`[Filme ${tmdbId}] Nenhum stream no Firestore. Usando fallback direto da API RoxanoPlay.`);
    const roxanoUrl = `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${tmdbId}`;
    
    return NextResponse.json({ streams: [{ playerType: "custom", url: roxanoUrl, name: "Servidor Secundário" }], ...mediaInfo });

  } catch (error) {
    console.error(`[Filme ${tmdbId}] Erro geral:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}