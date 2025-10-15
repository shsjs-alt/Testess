// app/api/stream/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(
  request: Request,
  { params }: { params: { tmdbId: string } }
) {
  const { tmdbId } = params;
  if (!tmdbId) {
    return NextResponse.json({ error: "TMDB ID é necessário." }, { status: 400 });
  }

  try {
    // Busca informações do filme no TMDB para o overlay (título, imagem de fundo, etc.)
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
        console.warn(`[API de Filmes] Não foi possível buscar informações do TMDB para o filme: ${tmdbId}`, tmdbError);
    }
    
    // Monta a URL direta da Roxano para o filme
    const roxanoUrl = `https://roxanoplay.bb-bet.top/pages/hostmov.php?id=${tmdbId}`;
    console.log(`[API de Filmes] Montada URL da Roxano para TMDB ${tmdbId}: ${roxanoUrl}`);

    // Retorna a URL para ser usada no player personalizado
    return NextResponse.json({ 
        streams: [{ 
            playerType: "custom", 
            url: roxanoUrl, 
            name: "Servidor Principal" 
        }], 
        ...mediaInfo 
    });

  } catch (error: any) {
    console.error(`[Filme ${tmdbId}] Erro geral:`, error.message);
    return NextResponse.json({ error: "Falha ao processar a requisição do filme" }, { status: 500 });
  }
}