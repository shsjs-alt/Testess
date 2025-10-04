// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  try {
    // Busca o vídeo no servidor, atuando como um proxy
    const videoResponse = await fetch(decodeURIComponent(videoUrl), {
      headers: {
        // Adiciona um referer para simular uma requisição válida
        'Referer': 'https://watch.brplayer.cc/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!videoResponse.ok) {
      return new NextResponse(`Falha ao buscar o vídeo: ${videoResponse.statusText}`, { status: videoResponse.status });
    }

    // Cria uma resposta de streaming
    const headers = new Headers();
    headers.set('Content-Type', videoResponse.headers.get('Content-Type') || 'application/vnd.apple.mpegurl');
    headers.set('Content-Length', videoResponse.headers.get('Content-Length') || '');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Connection', 'keep-alive');

    // Retorna o corpo do vídeo como um stream
    return new NextResponse(videoResponse.body, {
      status: videoResponse.status,
      headers: headers
    });

  } catch (error) {
    console.error("Erro no proxy de vídeo:", error);
    return new NextResponse("Erro ao processar o proxy de vídeo.", { status: 500 });
  }
}