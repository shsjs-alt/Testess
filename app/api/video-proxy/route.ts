// app/api/video-proxy/route.ts
export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('videoUrl');

  if (!videoUrl) {
    return new Response('Parâmetro videoUrl ausente', { status: 400 });
  }

  try {
    const requestHeaders = new Headers(request.headers);

    // ✨ CORREÇÃO DEFINITIVA: Adiciona um Referer genérico para burlar proteções de hotlink simples.
    requestHeaders.set('Referer', 'https://www.google.com/');
    requestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    
    // Passa o header 'Range' da requisição original, essencial para o seeking (avançar/retroceder) funcionar.
    const range = request.headers.get('range');
    if (range) {
      requestHeaders.set('Range', range);
    }
    
    const videoResponse = await fetch(videoUrl, {
      method: 'GET',
      headers: requestHeaders,
      signal: request.signal, // Passa o sinal de abort para cancelar o fetch se o usuário fechar a aba
    });

    if (!videoResponse.ok) {
      console.error(`[PROXY] Erro ao buscar do URL de origem: Status ${videoResponse.status}`);
      return new Response(`Falha ao buscar o vídeo da origem. Status: ${videoResponse.status}`, { 
        status: videoResponse.status,
        statusText: videoResponse.statusText
      });
    }

    // O corpo da resposta já é um stream legível (ReadableStream).
    const stream = videoResponse.body;

    // Cria os headers da nossa resposta para o player.
    const responseHeaders = new Headers();
    // Copia os headers essenciais da resposta da origem (Content-Type, Content-Length, etc.)
    const importantHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    videoResponse.headers.forEach((value, key) => {
        if (importantHeaders.includes(key.toLowerCase())) {
             responseHeaders.set(key, value);
        }
    });
    
    // Garante que o player saiba que pode fazer requisições parciais.
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    
    // Retorna a resposta com o status correto (geralmente 200 para o início ou 206 para conteúdo parcial).
    return new Response(stream, {
      status: videoResponse.status,
      statusText: videoResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[PROXY] Erro catastrófico no streaming de vídeo:', error);
    return new Response('Erro interno no servidor de streaming.', { status: 500 });
  }
}