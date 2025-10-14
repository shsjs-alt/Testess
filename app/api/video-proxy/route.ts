// app/api/video-proxy/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('videoUrl');

  if (!videoUrl) {
    return new Response('Parâmetro videoUrl ausente', { status: 400 });
  }

  try {
    // Busca o vídeo no servidor de origem com os cabeçalhos corretos
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        // --- MUDANÇA CRÍTICA AQUI ---
        // Alterado para um referer genérico para evitar bloqueios.
        'Referer': 'https://www.google.com/',
        // Repassa o cabeçalho 'Range' para permitir que o player busque partes do vídeo (essencial para streaming)
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

    // Cria novos cabeçalhos para a resposta que será enviada ao navegador
    const responseHeaders = new Headers();
    // Copia os cabeçalhos essenciais da resposta original para a nova resposta
    responseHeaders.set('Content-Type', videoResponse.headers.get('Content-Type') || 'video/mp4');
    responseHeaders.set('Content-Length', videoResponse.headers.get('Content-Length') || '');
    responseHeaders.set('Content-Range', videoResponse.headers.get('Content-Range') || '');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=604800, immutable');

    // Retorna a resposta com o stream do vídeo para o player
    // O status da resposta original é importante (ex: 206 Partial Content para seeking)
    return new Response(stream, {
      status: videoResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[PROXY] Erro no streaming de vídeo:', error);
    return new Response('Erro ao fazer streaming do vídeo', { status: 500 });
  }
}