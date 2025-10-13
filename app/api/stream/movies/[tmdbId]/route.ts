// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * Verifica se a URL é um link direto para um arquivo de vídeo (.mp4 ou .m3u8).
 * @param url A URL para verificar.
 * @returns `true` se for um link de stream direto, senão `false`.
 */
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
                console.log(`[Filme] Link de stream direto do Firestore, enviando diretamente: ${firestoreUrl}`);
                return NextResponse.json({
                    streams: [{ playerType: "custom", url: firestoreUrl, name: "Servidor Direto" }],
                    ...mediaInfo
                });
            }

            console.log(`[Filme] Link de player embed (iframe) do Firestore: ${firestoreUrl}`);
            return NextResponse.json({
                streams: [{ playerType: "iframe", url: firestoreUrl, name: "Servidor Externo" }],
                ...mediaInfo
            });
        }
    }
    return null;
}

const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

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

    try {
      const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
      const roxanoResponse = await Promise.race([
          fetch(roxanoUrl, { redirect: 'follow' }),
          timeout(5000)
      ]) as Response;

      if (roxanoResponse.ok) {
          const finalUrl = roxanoResponse.url;
          console.log(`[Filme ${tmdbId}] Sucesso com a API Principal (Roxano). URL Final: ${finalUrl}`);
          
          if (isDirectStreamLink(finalUrl)) {
            const stream = {
                playerType: "custom", 
                url: finalUrl,
                name: "Servidor Principal",
            };
            return NextResponse.json({ streams: [stream], ...mediaInfo });
          } else {
            console.log(`[Filme ${tmdbId}] URL da API Principal não é um stream direto, tratando como iframe: ${finalUrl}`);
            const stream = {
                playerType: "iframe",
                url: finalUrl,
                name: "Servidor Principal (Embed)",
            };
            return NextResponse.json({ streams: [stream], ...mediaInfo });
          }
      }
      throw new Error(`API Principal (Roxano) respondeu com status: ${roxanoResponse.status}`);
    } catch (error) {
        console.log(`[Filme ${tmdbId}] API Principal (Roxano) falhou, tentando fallback para o Firestore...`, error);

        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) {
            console.log(`[Filme ${tmdbId}] Sucesso com o fallback para Firestore.`);
            return firestoreResponse;
        }
    }
    
    console.log(`[Filme ${tmdbId}] Nenhuma fonte de stream disponível.`);
    return NextResponse.json({ error: "Nenhum stream disponível para este filme." }, { status: 404 });

  } catch (error) {
    console.error(`[Filme ${tmdbId}] Erro geral ao buscar streams em todas as fontes:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}