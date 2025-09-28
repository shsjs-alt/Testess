// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Usamos o runtime 'nodejs' para garantir compatibilidade com streaming de arquivos grandes.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // 1. Validação do Referer (opcional, mas recomendado para segurança)
  // Garante que apenas seu site possa usar este proxy.
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER; // Ex: 'https://seusite.com'

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse("Acesso Negado", { status: 403 });
  }

  // 2. Obtenção da URL do vídeo
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  try {
    // 3. Preparação dos Cabeçalhos para a Requisição Externa
    // Repassamos o cabeçalho 'Range' essencial para o streaming (pausar, avançar, etc.)
    // e definimos um User-Agent comum para evitar bloqueios.
    const range = request.headers.get("range") || undefined;
    const headersToSend = new Headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    if (range) {
      headersToSend.set("Range", range);
    }

    // 4. Fazendo a Requisição ao Servidor do Vídeo
    // Usamos 'cache: "no-store"' para garantir que estamos sempre buscando o conteúdo "ao vivo".
    const videoResponse = await fetch(videoUrl, {
      headers: headersToSend,
      cache: "no-store",
    });

    // 5. Verificação da Resposta e Streaming para o Usuário
    // Se a resposta do servidor de vídeo não for OK (200) ou Partial Content (206), retornamos um erro claro.
    if (!videoResponse.ok || !videoResponse.body) {
      const errorText = await videoResponse.text();
      console.error(`Falha ao buscar o vídeo de ${videoUrl}. Status: ${videoResponse.status}. Resposta: ${errorText}`);
      return new NextResponse(`Não foi possível carregar o vídeo. Status: ${videoResponse.status}`, { status: videoResponse.status });
    }

    // Criamos uma resposta de streaming, repassando o corpo do vídeo.
    const responseHeaders = new Headers(videoResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");

    return new NextResponse(videoResponse.body, {
      status: videoResponse.status,
      statusText: videoResponse.statusText,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error(`[VideoProxy] Erro ao processar a URL ${videoUrl}:`, error);
    return new NextResponse("Erro interno no servidor ao tentar buscar o vídeo.", { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204, // No Content
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}