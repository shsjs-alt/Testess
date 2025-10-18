// app/api/download-proxy/movies/[tmdbId]/route.ts
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

        const externalResponse = await fetch(downloadUrl);

        if (!externalResponse.ok || !externalResponse.body) {
          return NextResponse.json({ error: "Não foi possível buscar o arquivo na origem." }, { status: 502 });
        }

        const body = externalResponse.body;
        const headers = new Headers();

        headers.set('Content-Type', externalResponse.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Content-Length', externalResponse.headers.get('Content-Length') || '0');

        let filename = `filme_${tmdbId}.mp4`;
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

    return NextResponse.json({ error: "Link de download não encontrado." }, { status: 404 });

  } catch (error: any) {
    console.error(`[Proxy Download Filme ${tmdbId}] Erro:`, error.message);
    return NextResponse.json({ error: "Falha ao processar o download." }, { status: 500 });
  }
}