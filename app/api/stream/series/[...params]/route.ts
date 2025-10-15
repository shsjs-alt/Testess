// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(
  request: Request,
  { params }: { params: { params: string[] } }
) {
  const [tmdbId, season, episode] = params.params;
  const episodeNum = parseInt(episode, 10);

  if (!tmdbId || !season || isNaN(episodeNum)) {
    return NextResponse.json({ error: "ID da série, temporada e episódio são necessários." }, { status: 400 });
  }

  try {
    // Busca informações da série no TMDB para o overlay
    let mediaInfo = { title: null, originalTitle: null, backdropPath: null };
    try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        mediaInfo = {
            title: tmdbData.name,
            originalTitle: tmdbData.original_name,
            backdropPath: tmdbData.backdrop_path,
        };
      }
    } catch (tmdbError) {
      console.warn(`[API de Séries] Não foi possível buscar TMDB para ${tmdbId}`, tmdbError);
    }
    
    // Monta a URL direta da Roxano para o episódio da série
    const roxanoUrl = `https://roxanoplay.bb-bet.top/pages/proxys.php?id=${tmdbId}/${season}/${episode}`;
    console.log(`[API de Séries] Montada URL da Roxano para S${season}E${episode}: ${roxanoUrl}`);

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
    console.error(`[Série ${tmdbId}] Erro geral para S${season}E${episode}:`, error.message);
    return NextResponse.json({ error: "Falha ao processar a requisição da série" }, { status: 500 });
  }
}