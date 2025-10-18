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

                const externalResponse = await fetch(downloadUrl);

                if (!externalResponse.ok || !externalResponse.body) {
                    return NextResponse.json({ error: "Não foi possível buscar o arquivo na origem." }, { status: 502 });
                }

                const body = externalResponse.body;
                const headers = new Headers();

                headers.set('Content-Type', externalResponse.headers.get('Content-Type') || 'application/octet-stream');
                headers.set('Content-Length', externalResponse.headers.get('Content-Length') || '0');

                let filename = `serie_${tmdbId}_s${season}_e${episode}.mp4`;
                try {
                    const urlPath = new URL(downloadUrl).pathname;
                    const parts = urlPath.split('/');
                    filename = decodeURIComponent(parts[parts.length - 1]);
                } catch (e) {
                    console.warn("Não foi possível extrair o nome do arquivo da URL.");
                }

                headers.set('Content-Disposition', `attachment; filename="${filename}"`);

                return new NextResponse(body, {
                    status: 200,
                    headers: headers,
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