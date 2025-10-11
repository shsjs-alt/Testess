// app/api/video-proxy/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // O Edge Runtime é excelente para streaming

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
        // Passa o cabeçalho 'Range' do pedido original, essencial para o seeking (avançar/retroceder)
        'Range': request.headers.get('range') || 'bytes=0-',
      },
    });

    // Verifica se a fonte externa respondeu com sucesso
    if (!videoResponse.ok) {
      console.error(`[PROXY] Erro ao buscar do URL de origem: Status ${videoResponse.status}`);
      return new Response('Falha ao buscar o vídeo da origem', { status: videoResponse.status });
    }

    // Obtém o stream (fluxo de dados) da resposta do vídeo
    const stream = videoResponse.body;

    // Cria uma nova resposta, transmitindo o corpo do vídeo original para o cliente
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', videoResponse.headers.get('Content-Type') || 'video/mp4');
    responseHeaders.set('Content-Length', videoResponse.headers.get('Content-Length') || '');
    responseHeaders.set('Content-Range', videoResponse.headers.get('Content-Range') || '');
    responseHeaders.set('Accept-Ranges', 'bytes'); // Crucial para permitir o seeking no player
    responseHeaders.set('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // Adiciona cache

    return new Response(stream, {
      status: videoResponse.status, // Geralmente 206 (Partial Content) para streaming
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[PROXY] Erro no streaming de vídeo:', error);
    return new Response('Erro ao fazer streaming do vídeo', { status: 500 });
  }
}