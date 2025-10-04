// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Removido: export const runtime = "edge";
// A remoção do runtime 'edge' é necessária para o streaming de corpo de resposta funcionar de forma confiável.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  const decodedUrl = decodeURIComponent(videoUrl);

  // Lógica condicional: se for um link 'brplayer.cc', faz o proxy de streaming.
  // Caso contrário, usa o redirecionamento antigo que funcionava para as outras fontes.
  if (decodedUrl.includes('brplayer.cc')) {
    try {
      const videoResponse = await fetch(decodedUrl, {
        headers: {
          'Referer': 'https://brplayer.cc/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!videoResponse.ok) {
        return new NextResponse(`Falha ao buscar o vídeo: ${videoResponse.statusText}`, { status: videoResponse.status });
      }

      const headers = new Headers();
      const contentType = videoResponse.headers.get('Content-Type');
      
      // Define o Content-Type corretamente para HLS (m3u8) ou vídeo normal
      if (contentType) {
        headers.set('Content-Type', contentType);
      } else if (decodedUrl.includes('.m3u8')) {
        headers.set('Content-Type', 'application/vnd.apple.mpegurl');
      } else {
        headers.set('Content-Type', 'video/mp4');
      }

      // Copia outros cabeçalhos importantes
      const contentLength = videoResponse.headers.get('Content-Length');
      if (contentLength) {
        headers.set('Content-Length', contentLength);
      }
      headers.set('Accept-Ranges', 'bytes');
      
      return new NextResponse(videoResponse.body, {
        status: videoResponse.status,
        headers: headers
      });

    } catch (error) {
      console.error("Erro no proxy de vídeo para brplayer:", error);
      return new NextResponse("Erro ao processar o vídeo do brplayer.", { status: 500 });
    }
  } else {
    // Lógica de redirecionamento original para as outras APIs (ex: RoxanoPlay)
    try {
      return NextResponse.redirect(new URL(decodedUrl), 307);
    } catch (error) {
      console.error("URL de redirecionamento inválida:", decodedUrl, error);
      return new NextResponse("URL de vídeo inválida.", { status: 400 });
    }
  }
}