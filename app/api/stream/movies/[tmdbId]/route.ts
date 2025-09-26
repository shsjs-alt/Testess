// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function getFirestoreStream(docData: any, mediaInfo: any) {
    if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
        const firestoreUrl = docData.urls[0].url;
        const firestoreStream = {
            playerType: "custom",
            // CORREÇÃO: O link para o player deve usar o video-proxy
            url: `/api/video-proxy?videoUrl=${encodeURIComponent(firestoreUrl)}`,
            name: "Servidor Firebase",
        };
        return NextResponse.json({
            streams: [firestoreStream],
            ...mediaInfo
        });
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
      console.warn("API de Filmes: Não foi possível buscar informações do TMDB para o filme:", tmdbId, tmdbError);
    }

    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const docData = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;

    if (docData?.forceFirestore === true) {
        const firestoreResponse = await getFirestoreStream(docData, mediaInfo);
        if (firestoreResponse) return firestoreResponse;
        
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado." }, { status: 404 });
    }

    try {
      const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
      const response = await fetch(roxanoUrl, { method: 'HEAD', redirect: 'manual' }); // Usamos HEAD para verificar a existência e tamanho
      // Verifica se a resposta é OK e se tem conteúdo
      if ((response.ok || response.status === 206) && Number(response.headers.get('content-length')) > 0) {
        const stream = {
          playerType: "custom",
          url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
          name: "Servidor Principal",
        };
        return NextResponse.json({ streams: [stream], ...mediaInfo });
      }
    } catch (error) {
      console.log("API Principal falhou, tentando fallback para o Firestore...");
    }

    const firestoreFallbackResponse = await getFirestoreStream(docData, mediaInfo);
    if (firestoreFallbackResponse) return firestoreFallbackResponse;

    return NextResponse.json({ error: "Nenhum stream disponível para este filme." }, { status: 404 });

  } catch (error) {
    console.error(`Erro ao buscar streams para o filme ${tmdbId}:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}