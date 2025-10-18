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

        // Busca o arquivo externo para fazer o streaming
        const externalResponse = await fetch(downloadUrl);

        if (!externalResponse.ok || !externalResponse.body) {
          return NextResponse.json({ error: "Não foi possível buscar o arquivo na origem." }, { status: 502 });
        }

        const body = externalResponse.body;
        const headers = new Headers();

        // Copia headers essenciais para o navegador saber o tipo e tamanho do arquivo
        headers.set('Content-Type', externalResponse.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Content-Length', externalResponse.headers.get('Content-Length') || '0');

        // Tenta extrair um nome de arquivo legível da URL
        let filename = `filme_${tmdbId}.mp4`;
        try {
          const urlPath = new URL(downloadUrl).pathname;
          const parts = urlPath.split('/');
          filename = decodeURIComponent(parts[parts.length - 1]);
        } catch (e) {
          console.warn("Não foi possível extrair o nome do arquivo da URL.");
        }

        // **A MÁGICA ACONTECE AQUI: Força o navegador a baixar o arquivo**
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);

        // Retorna uma nova resposta que transmite o arquivo para o usuário
        return new NextResponse(body, {
            status: 200,
            headers: headers,
        });
      }
    }

    return NextResponse.json({ error: "Link de download não encontrado." }, { status: 404 });

  } catch (error: any) {
    console.error(`[Download Filme ${tmdbId}] Erro:`, error.message);
    return NextResponse.json({ error: "Falha ao buscar link de download." }, { status: 500 });
  }
}