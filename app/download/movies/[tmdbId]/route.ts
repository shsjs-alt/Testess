// app/api/download/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const TMDB_API_KEY = "860b66ade580bacae581f4228fad49fc";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function getFirestoreStreamUrl(docData: any) {
    if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
        return docData.urls[0].url;
    }
    return null;
}

async function fetchAndStream(url: string, title: string) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": "https://www.google.com/"
        }
    });

    if (!response.ok || !response.body) {
        throw new Error(`Falha ao buscar o vídeo de ${url}. Status: ${response.status}`);
    }

    const headers = new Headers({
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9 ]/g, '')}.mp4"`,
    });

    return new NextResponse(response.body, { headers });
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
    let mediaTitle = "filme";
    try {
      const tmdbRes = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        mediaTitle = tmdbData.title || mediaTitle;
      }
    } catch (e) {
        console.warn("API de Download: Não foi possível buscar título do TMDB")
    }
    
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);
    const docData = docSnap.exists() ? docSnap.data() : null;

    const firestoreUrl = await getFirestoreStreamUrl(docData);
    if (firestoreUrl) return fetchAndStream(firestoreUrl, mediaTitle);

    return NextResponse.json({ error: "Nenhum link de download disponível." }, { status: 404 });

  } catch (error: any) {
    console.error(`Erro ao processar download para o filme ${tmdbId}:`, error);
    return NextResponse.json({ error: error.message || "Falha ao processar o download." }, { status: 500 });
  }
}