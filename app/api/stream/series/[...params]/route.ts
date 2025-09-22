// app/api/stream/series/[...params]/route.ts
import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCNEGDpDLuWYrxTkoONy4oQujnatx6KIS8",
  authDomain: "cineveok.firebaseapp.com",
  databaseURL: "https://cineveok-default-rtdb.firebaseio.com",
  projectId: "cineveok",
  storageBucket: "cineveok.firebasestorage.app",
  messagingSenderId: "805536124347",
  appId: "1:805536124347:web:b408c28cb0a4dc914d089e",
  measurementId: "G-H7WVDQQDVJ"
};

// Inicializa o Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);

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
    const roxanoStream = {
      playerType: "custom",
      url: `/api/video-proxy?videoUrl=${encodeURIComponent(roxanoUrl)}`,
      name: `Servidor Principal (T${season} E${episode})`,
    };

    const cacheHeaders = {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
    };

    // Lógica de fallback para o Firestore
    try {
        const response = await fetch(roxanoStream.url, { method: 'HEAD' });
        if (response.ok) {
            return NextResponse.json({
                streams: [roxanoStream],
                title: tvTitle,
                originalTitle: originalTvTitle,
                backdropPath: backdropPath,
            }, { headers: cacheHeaders });
        }
    } catch (error) {
        console.warn("API da Roxano falhou, tentando Firestore...", error);
    }

    const docRef = doc(firestore, "series", tmdbId, "seasons", season, "episodes", episode);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && docSnap.data().mp4Url) {
      const firestoreStream = {
        playerType: "custom",
        url: docSnap.data().mp4Url,
        name: `Servidor Secundário (T${season} E${episode})`,
      };
      
      return NextResponse.json({
        streams: [firestoreStream],
        title: tvTitle,
        originalTitle: originalTvTitle,
        backdropPath: backdropPath,
      }, { headers: cacheHeaders });
    }
    
    return NextResponse.json(
      { error: "Nenhum stream encontrado para este episódio." },
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