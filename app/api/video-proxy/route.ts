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
    // Copiando os headers importantes da requisição original do player
    requestHeaders.set('Accept', request.headers.get('Accept') || 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5');
    requestHeaders.set('Accept-Language', request.headers.get('Accept-Language') || 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
    requestHeaders.set('Connection', 'keep-alive');
    // ✨ CORREÇÃO APLICADA AQUI ✨
    // Alinhado com a função de stream para usar o referer do seu site, evitando bloqueios.
    requestHeaders.set('Referer', 'https://cineveo.lat/');
    requestHeaders.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    
    // Essencial para o seeking (avançar/retroceder) funcionar corretamente.
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
      const statusText = videoResponse.statusText || 'Falha ao buscar o vídeo da origem';
      return new Response(statusText, { status: videoResponse.status, statusText });
    }

    // O corpo da resposta já é um stream que o navegador pode ler.
    const stream = videoResponse.body;

    // Criando os headers da nossa resposta para o player.
    const responseHeaders = new Headers();
    // Copiando os headers relevantes da resposta da origem (Content-Type, Content-Length, etc.)
    videoResponse.headers.forEach((value, key) => {
        if (['content-type', 'content-length', 'content-range', 'last-modified', 'etag'].includes(key.toLowerCase())) {
             responseHeaders.append(key, value);
        }
    });
    
    // Garantindo que o player saiba que pode fazer requisições parciais (essencial para seeking).
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*'); // Permite que o player funcione em qualquer domínio.

    // Retorna a resposta com o status correto (geralmente 206 para conteúdo parcial quando o usuário avança o vídeo).
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