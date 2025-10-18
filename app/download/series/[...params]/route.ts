// app/download/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(
  request: Request,
  { params }: { params: { params: string[] } }
) {
  const [tmdbId, season, episode] = params.params;
  const episodeNum = parseInt(episode, 10);

  if (!tmdbId || !season || isNaN(episodeNum)) {
    return NextResponse.json({ error: "ID, temporada e episódio são necessários." }, { status: 400 });
  }

  try {
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const docData = docSnap.data();
        const seasonData = docData?.seasons?.[season];
        if (seasonData && Array.isArray(seasonData.episodes)) {
            const episodeData = seasonData.episodes.find((ep: any) => ep.episode_number === episodeNum);
            if (episodeData && Array.isArray(episodeData.urls) && episodeData.urls.length > 0 && episodeData.urls[0].url) {
                const downloadUrl = episodeData.urls[0].url;

                // Retorna uma página HTML que inicia o download via meta refresh.
                const html = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta http-equiv="refresh" content="3;url=${downloadUrl}">
                    <title>Iniciando Download</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #111; color: #eee; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                        .container { padding: 2rem; background-color: #1c1c1c; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                        h1 { color: #fff; margin-bottom: 0.5rem; }
                        p { color: #aaa; }
                        a { color: #e50914; text-decoration: none; font-weight: bold; }
                        a:hover { text-decoration: underline; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Seu download começará em breve...</h1>
                        <p>Se o download não iniciar automaticamente, <a href="${downloadUrl}" download>clique aqui</a>.</p>
                    </div>
                </body>
                </html>
                `;

                return new NextResponse(html, {
                    headers: {
                        'Content-Type': 'text/html',
                    },
                });
            }
        }
    }
    
    return NextResponse.json({ error: "Link de download não encontrado." }, { status: 404 });

  } catch (error: any) {
    console.error(`[Download Série ${tmdbId}] Erro para S${season}E${episode}:`, error.message);
    return NextResponse.json({ error: "Falha ao buscar link de download." }, { status: 500 });
  }
}