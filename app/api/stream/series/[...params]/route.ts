// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const ROXANO_API_URL = "https://roxanoplay.bb-bet.top/pages/proxys.php";
const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function GET(
  request: Request,
  { params }: { params: { params: string[] } }
) {
  const [tmdbId, season, episode] = params.params;

  if (!tmdbId || !season || !episode) {
    return NextResponse.json(
      { error: "TMDB ID, temporada e episódio são necessários." },
      { status: 400 }
    );
  }

  try {
    let tvTitle: string | null = null;
    let originalTvTitle: string | null = null;
    let backdropPath: string | null = null;

    try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        tvTitle = tmdbData.name;
        originalTvTitle = tmdbData.original_name;
        backdropPath = tmdbData.backdrop_path;
      }
    } catch (tmdbError) {
      console.warn("API de Séries: Não foi possível buscar informações do TMDB para a série:", tmdbId, tmdbError);
    }

    const roxanoUrl = `${ROXANO_API_URL}?id=${tmdbId}/${season}/${episode}`;
    try {
      // Tenta a API principal primeiro
      const response = await fetch(roxanoUrl);
      if (response.ok && response.headers.get('content-length') !== '0') {
        const stream = {
          playerType: "custom",
          url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
          name: `Servidor Principal (T${season} E${episode})`,
        };
        return NextResponse.json({
          streams: [stream],
          title: tvTitle,
          originalTitle: originalTvTitle,
          backdropPath: backdropPath,
        });
      }
    } catch (error) {
      console.log("API Principal de séries falhou, tentando fallback para o Firestore...");
    }

    // Fallback para o Firestore
    try {
      const docRef = doc(firestore, "media", tmdbId);
      const docSnap = await getDoc(docRef);
      const docData = docSnap.data();
      const episodeKey = `${season}-${episode}`;

      // Verifica se o documento existe, se 'urls' é um mapa e se a chave do episódio existe
      if (docSnap.exists() && docData && typeof docData.urls === 'object' && docData.urls[episodeKey]) {
        const firestoreStream = {
          playerType: "custom",
          url: docData.urls[episodeKey],
          name: "Servidor Firebase",
        };
        return NextResponse.json({
          streams: [firestoreStream],
          title: tvTitle,
          originalTitle: originalTvTitle,
          backdropPath: backdropPath,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar episódio do Firestore:", error);
    }

    return NextResponse.json(
      { error: "Nenhum stream disponível para este episódio." },
      { status: 404 }
    );

  } catch (error) {
    console.error(
      `Erro ao buscar streams para a série ${tmdbId} S${season}E${episode}:`,
      error
    );
    return NextResponse.json(
      { error: "Falha ao buscar streams" },
      { status: 500 }
    );
  }
}