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

                // Redireciona para a URL do vídeo
                return NextResponse.redirect(downloadUrl);
            }
        }
    }
    
    return NextResponse.json({ error: "Link de download não encontrado." }, { status: 404 });

  } catch (error: any) {
    console.error(`[Download Série ${tmdbId}] Erro para S${season}E${episode}:`, error.message);
    return NextResponse.json({ error: "Falha ao buscar link de download." }, { status: 500 });
  }
}