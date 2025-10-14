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
    // --- LÓGICA DE CABEÇALHOS APRIMORADA ---
    // Simula um navegador real para evitar bloqueios de segurança.
    const requestHeaders = new Headers();
    requestHeaders.set('Accept', 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5');
    requestHeaders.set('Accept-Language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
    requestHeaders.set('Connection', 'keep-alive');
    requestHeaders.set('Referer', 'https://primevicio.vercel.app/'); // Usando o seu próprio site como Referer.
    requestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    
    // Repassa o cabeçalho 'Range' do player para a fonte original.
    // Isso é ESSENCIAL para o streaming funcionar (permitir avançar/retroceder o vídeo).
    const range = request.headers.get('range');
    if (range) {
      requestHeaders.set('Range', range);
    }
    
    // Busca o vídeo no servidor de origem com os cabeçalhos aprimorados.
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
    responseHeaders.set('Accept-Ranges', 'bytes'); // Garante que o navegador saiba que pode fazer requisições parciais.

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