// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, DocumentSnapshot } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/hostmov.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Função para extrair o ID de um link do Google Drive
function getGoogleDriveId(url: string): string | null {
    const regex = /\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Helper para obter o stream do Firestore. Retorna um objeto de resposta ou null.
async function getFirestoreStream(docSnap: DocumentSnapshot, mediaInfo: any) {
    if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
            const firestoreUrl = docData.urls[0].url as string;
            
            const googleDriveId = getGoogleDriveId(firestoreUrl);

            if (googleDriveId) {
                const gdriveStream = {
                    playerType: "gdrive",
                    url: `https://drive.google.com/file/d/${googleDriveId}/preview`,
                    name: "Servidor Google Drive",
                };
                return NextResponse.json({
                    streams: [gdriveStream],
                    ...mediaInfo
                });
            }
            
            const safeUrl = encodeURIComponent(decodeURIComponent(firestoreUrl));

            const firestoreStream = {
                playerType: "custom",
                url: `/api/video-proxy?videoUrl=${safeUrl}`,
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

// Helper para criar uma promessa que rejeita após um timeout
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
    
    // 1. Lógica para quando o `forceFirestore` está ativado
    if (docSnap.exists() && docSnap.data()?.forceFirestore === true) {
        console.log(`[Filme ${tmdbId}] Forçando o uso do Firestore.`);
        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) {
            return firestoreResponse;
        }
        // Se forçado, mas não encontrado, retorna erro.
        return NextResponse.json({ error: "Stream forçado do Firestore não encontrado." }, { status: 404 });
    }

    // 2. Lógica Padrão: Tenta a API Principal primeiro
    try {
      const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}`;
      const roxanoResponse = await Promise.race([
          fetch(roxanoUrl, { redirect: 'follow' }), // Segue os redirecionamentos
          timeout(5000)
      ]) as Response;

      if (roxanoResponse.ok) {
          const finalUrl = roxanoResponse.url; // Pega a URL final após os redirecionamentos
          console.log(`[Filme ${tmdbId}] Sucesso com a API Principal (Roxano). URL Final: ${finalUrl}`);
          const stream = {
              playerType: "custom",
              url: `/api/video-proxy?videoUrl=${encodeURIComponent(finalUrl)}`,
              name: "Servidor Principal",
          };
          return NextResponse.json({ streams: [stream], ...mediaInfo });
      }
      throw new Error(`API Principal (Roxano) respondeu com status: ${roxanoResponse.status}`);
    } catch (error) {
        console.log(`[Filme ${tmdbId}] API Principal (Roxano) falhou, tentando fallback para o Firestore...`, error);

        // 3. Fallback para o Firestore
        const firestoreResponse = await getFirestoreStream(docSnap, mediaInfo);
        if (firestoreResponse) {
            console.log(`[Filme ${tmdbId}] Sucesso com o fallback para Firestore.`);
            return firestoreResponse;
        }
    }
    
    // 4. Se tudo falhar
    console.log(`[Filme ${tmdbId}] Nenhuma fonte de stream disponível.`);
    return NextResponse.json({ error: "Nenhum stream disponível para este filme." }, { status: 404 });

  } catch (error) {
    console.error(`[Filme ${tmdbId}] Erro geral ao buscar streams em todas as fontes:`, error);
    return NextResponse.json({ error: "Falha ao buscar streams" }, { status: 500 });
  }
}