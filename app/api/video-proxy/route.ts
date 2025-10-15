// app/api/video-proxy/route.ts

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('videoUrl');

  if (!videoUrl) {
    return new Response('Parâmetro videoUrl ausente', { status: 400 });
  }

  try {
    const requestHeaders = new Headers();
    requestHeaders.set('Accept', 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5');
    requestHeaders.set('Accept-Language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
    requestHeaders.set('Connection', 'keep-alive');
    // ✨ CORREÇÃO APLICADA AQUI ✨
    // Alinhado com a função de download para usar o referer do Google
    requestHeaders.set('Referer', 'https://www.google.com/');
    requestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    
    const range = request.headers.get('range');
    if (range) {
      requestHeaders.set('Range', range);
    }
    
    const videoResponse = await fetch(videoUrl, {
      method: 'GET',
      headers: requestHeaders,
    });

    if (!videoResponse.ok) {
      console.error(`[PROXY] Erro ao buscar do URL de origem: Status ${videoResponse.status}`);
      return new Response('Falha ao buscar o vídeo da origem', { status: videoResponse.status });
    }

    const stream = videoResponse.body;

    const responseHeaders = new Headers();
    videoResponse.headers.forEach((value, key) => {
      responseHeaders.append(key, value);
    });
    responseHeaders.set('Accept-Ranges', 'bytes');

    return new Response(stream, {
      status: videoResponse.status,
      statusText: videoResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[PROXY] Erro no streaming de vídeo:', error);
    return new Response('Erro ao fazer streaming do vídeo', { status: 500 });
  }
}