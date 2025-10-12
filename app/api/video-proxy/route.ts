// app/api/video-proxy/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('videoUrl');

  if (!videoUrl) {
    return new Response('Parâmetro videoUrl ausente', { status: 400 });
  }

  try {
    // Busca o vídeo no servidor de origem
    const videoResponse = await fetch(videoUrl, {
      headers: {
        // <<< MUDANÇA FINAL AQUI >>>
        // Enviando o mínimo de informações para não sermos bloqueados.
        // Removemos o 'Referer' para a requisição ficar mais "limpa".
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Range': request.headers.get('range') || 'bytes=0-',
      },
    });

    if (!videoResponse.ok) {
      console.error(`[PROXY] Erro ao buscar do URL de origem: Status ${videoResponse.status}`);
      return new Response('Falha ao buscar o vídeo da origem', { status: videoResponse.status });
    }

    const stream = videoResponse.body;
    const responseHeaders = new Headers(videoResponse.headers);
    responseHeaders.set('Cache-Control', 'public, max-age=604800, immutable');

    return new Response(stream, {
      status: videoResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[PROXY] Erro no streaming de vídeo:', error);
    return new Response('Erro ao fazer streaming do vídeo', { status: 500 });
  }
}