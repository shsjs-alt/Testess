// app/api/video-proxy/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('videoUrl');

  if (!videoUrl) {
    console.error('[PROXY-REDIRECT] Erro: Parâmetro videoUrl ausente.');
    return new Response('Parâmetro videoUrl ausente', { status: 400 });
  }

  try {
    // ✨ NOVA ESTRATÉGIA: REDIRECIONAMENTO ✨
    // Em vez de fazer o stream do vídeo, vamos apenas redirecionar o navegador
    // do usuário para a URL final do vídeo. Isso é mais simples e remove nosso
    // servidor como um ponto de falha no streaming.
    console.log(`[PROXY-REDIRECT] Redirecionando player para: ${videoUrl}`);
    return NextResponse.redirect(videoUrl, 302);

  } catch (error) {
    console.error('[PROXY-REDIRECT] Erro ao tentar criar o redirecionamento:', error);
    return new Response('Erro ao processar a URL do vídeo', { status: 500 });
  }
}