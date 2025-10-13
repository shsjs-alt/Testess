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
                return NextResponse.json({
                    streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Direto" }],
                    ...mediaInfo
                });
            }

            return NextResponse.json({
                streams: [{ playerType: "iframe", url: firestoreUrl, name: "Servidor Externo" }],
                ...mediaInfo
            });
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
      console.warn("API de Filmes: Não foi possível buscar informações do TMDB para o filme:", tmdbId, tmdbError);
    }

    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) {
        console.log(`[Filme ${tmdbId}] Forçando o uso do Firestore.`);
        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) {
            return firestoreResponse;
        }
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado." }, { status: 404 });
    }

    // --- LÓGICA CORRIGIDA: Resolve o redirecionamento da Roxano API ---
    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
    console.log(`[Filme ${tmdbId}] Resolvendo URL da API Roxano: ${roxanoUrl}`);
    
    try {
      const roxanoResponse = await fetch(roxanoUrl, {
          method: 'GET',
          redirect: 'manual', // Impede que o fetch siga o redirect automaticamente
          headers: {
              // Simula um navegador para evitar bloqueios simples
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
              "Referer": "https://primevicio.vercel.app/" 
          }
      });

      // Se a resposta for um redirecionamento (status 3xx), pegamos a URL final
      if (roxanoResponse.status >= 300 && roxanoResponse.status < 400) {
          const finalUrl = roxanoResponse.headers.get('location');
          if (finalUrl) {
              console.log(`[Filme ${tmdbId}] URL resolvida para (MP4): ${finalUrl}`);
              const stream = {
                  playerType: "custom", // O player tratará como <video src="...">
                  url: finalUrl,
                  name: "Servidor Principal",
              };
              return NextResponse.json({ streams: [stream], ...mediaInfo });
          }
      }
      
      // Se não for um redirect, algo está errado
      throw new Error(`Roxano API não retornou um redirecionamento. Status: ${roxanoResponse.status}`);

    } catch (roxanoError) {
        console.error(`[Filme ${tmdbId}] Falha ao resolver a URL da Roxano, tentando fallback para Firestore...`, roxanoError);
        
        // Se a API principal falhar, tenta o fallback do Firestore
        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) {
            return firestoreResponse;
        }

        return NextResponse.json({ error: "Nenhum stream funcional encontrado." }, { status: 404 });
    }
    // --- FIM DA LÓGICA CORRIGIDA ---

  } catch (error) {
    console.error(`[Filme ${tmdbId}] Erro geral ao buscar streams:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}