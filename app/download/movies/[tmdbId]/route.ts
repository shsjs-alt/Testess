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
            // Verifica se é um link de vídeo direto para o nosso player
            if (isDirectStreamLink(firestoreUrl)) {
                console.log(`[Filme ${docSnap.id}] Encontrado stream direto no Firestore: ${firestoreUrl}`);
                return NextResponse.json({ streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Principal" }], ...mediaInfo });
            }
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
    
    // 1. Tenta buscar no Firestore um link direto (.mp4, .m3u8)
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
    if (firestoreResponse) {
        return firestoreResponse; // Se encontrou link direto, retorna imediatamente
    }

    // 2. Se não encontrou no Firestore, usa a API Roxanoplay como fallback
    const roxanoUrl = `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${tmdbId}`;
    console.log(`[Filme ${tmdbId}] Usando fallback da API RoxanoPlay.`);
    return NextResponse.json({ streams: [{ playerType: "custom", url: roxanoUrl, name: "Servidor Secundário" }], ...mediaInfo });

  } catch (error) {
    console.error(`[Filme ${tmdbId}] Erro geral:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}