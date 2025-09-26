// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Função para obter o stream do Firestore a partir de um DocumentSnapshot
async function getFirestoreStream(docSnap: DocumentSnapshot, mediaInfo: any) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
            const firestoreUrl = docData.urls[0].url;
            const firestoreStream = {
                playerType: "custom",
                url: `/api/video-proxy?videoUrl=${encodeURIComponent(firestoreUrl)}`,
                name: "Servidor Firebase",
            };
            return NextResponse.json({
                streams: [firestoreStream],
                ...mediaInfo
            });
        }
    }
    return null;
}

// Função para tentar buscar da API principal (Roxano)
async function getRoxanoStream(tmdbId: string, mediaInfo: any) {
    try {
        const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
        const response = await fetch(roxanoUrl, { signal: AbortSignal.timeout(4000) }); // Timeout de 4s

        if (response.ok) {
            const stream = {
                playerType: "custom",
                url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
                name: "Servidor Principal",
            };
            return NextResponse.json({ streams: [stream], ...mediaInfo });
        }
        return null; // Retorna nulo se a resposta não for OK
    } catch (error) {
        console.log("API Principal (Roxano) falhou ou demorou:", error);
        return null; // Retorna nulo em caso de erro ou timeout
    }
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
    // Busca informações do TMDB primeiro, pois são necessárias em ambas as respostas
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

    // Inicia a busca no Firestore
    const docRef = doc(firestore, "media", tmdbId);
    const firestorePromise = getDoc(docRef);

    // Lógica para 'forceFirestore'
    const docSnap = await firestorePromise;
    const docData = docSnap.exists() ? docSnap.data() : null;
    if (docData?.forceFirestore === true) {
        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) return firestoreResponse;
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado." }, { status: 404 });
    }

    // Dispara as duas fontes de dados em paralelo
    const roxanoPromise = getRoxanoStream(tmdbId, mediaInfo);
    // Reutiliza o resultado já buscado do firestorePromise
    const firestoreStreamPromise = getFirestoreStream(docSnap, mediaInfo);

    // Espera pela primeira resposta válida
    const firstValidResponse = await Promise.any([roxanoPromise, firestoreStreamPromise].filter(p => p));
    
    if(firstValidResponse) {
        return firstValidResponse;
    }

    // Se ambas as promessas resultarem em nulo ou forem rejeitadas
    return NextResponse.json({ error: "Nenhum stream disponível para este filme." }, { status: 404 });

  } catch (error) {
    // O Promise.any lança um AggregateError se todas as promessas forem rejeitadas
    console.error(`Erro ao buscar streams para o filme ${tmdbId} em todas as fontes:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}