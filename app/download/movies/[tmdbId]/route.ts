// app/download/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(
  request: Request,
  { params }: { params: { tmdbId: string } }
) {
  const { tmdbId } = params;
  if (!tmdbId) {
    return NextResponse.json({ error: "TMDB ID é necessário." }, { status: 400 });
  }

  try {
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const docData = docSnap.data();
      if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
        const downloadUrl = docData.urls[0].url;
        
        // Redireciona para a URL do vídeo, o navegador irá lidar com o download se for um link direto
        return NextResponse.redirect(downloadUrl);
      }
    }

    return NextResponse.json({ error: "Link de download não encontrado." }, { status: 404 });

  } catch (error: any) {
    console.error(`[Download Filme ${tmdbId}] Erro:`, error.message);
    return NextResponse.json({ error: "Falha ao buscar link de download." }, { status: 500 });
  }
}