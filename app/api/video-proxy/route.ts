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
    const range = request.headers.get('range') || 'bytes=0-';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';
    // Usar a origem da URL do vídeo como referenciador é uma prática mais segura
    const referer = new URL(videoUrl).origin + '/';

    // --- LÓGICA CORRIGIDA ---

    // Passo 1: Fazer a requisição inicial sem seguir o redirecionamento automaticamente.
    // Isso nos permite capturar o link final para onde o script PHP aponta.
    const initialResponse = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Referer': referer,
      },
      redirect: 'manual', // Impedir que o fetch siga o redirect automaticamente
    });

    let finalVideoUrl = videoUrl;
    
    // Passo 2: Verificar se a resposta é um redirecionamento (status 3xx).
    if (initialResponse.status >= 300 && initialResponse.status < 400) {
      const location = initialResponse.headers.get('Location');
      if (location) {
        // A nova URL para o vídeo é o cabeçalho 'Location'
        finalVideoUrl = new URL(location, videoUrl).toString();
        console.log(`[PROXY] Redirecionamento detectado para: ${finalVideoUrl}`);
      } else {
        // Se for um redirect sem o cabeçalho 'Location', não é possível continuar.
        throw new Error(`[PROXY] Redirect (status ${initialResponse.status}) sem cabeçalho 'Location'.`);
      }
    }

    // Passo 3: Buscar o conteúdo do vídeo da URL final, enviando os cabeçalhos corretos.
    const videoResponse = await fetch(finalVideoUrl, {
      headers: {
        'User-Agent': userAgent,
        'Referer': referer,
        'Range': range, // Encaminhar o cabeçalho Range é essencial para o streaming/busca no vídeo.
      },
    });

    if (!videoResponse.ok || !videoResponse.body) {
      console.error(`[PROXY] Erro ao buscar do URL final (${finalVideoUrl}): Status ${videoResponse.status}`);
      return new Response('Falha ao buscar o vídeo da origem final.', { status: videoResponse.status });
    }

    // Passo 4: Fazer o stream (transmitir) da resposta do vídeo para o cliente.
    const stream = videoResponse.body;
    const responseHeaders = new Headers({
      'Content-Type': videoResponse.headers.get('Content-Type') || 'video/mp4',
      'Content-Length': videoResponse.headers.get('Content-Length') || '',
      'Content-Range': videoResponse.headers.get('Content-Range') || '',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400, immutable',
    });

    // Retorna o fluxo de vídeo com os cabeçalhos corretos.
    return new Response(stream, {
      status: videoResponse.status, // Geralmente 206 para conteúdo parcial (streaming)
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[PROXY] Erro no streaming de vídeo:', error);
    return new Response('Erro ao fazer streaming do vídeo', { status: 500 });
  }
}