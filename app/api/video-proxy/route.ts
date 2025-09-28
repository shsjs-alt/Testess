// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER;

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse("Acesso Negado", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  try {
    const videoUrlObject = new URL(videoUrl);
    
    // --- MODIFICAÇÃO IMPORTANTE AQUI ---
    // Adicionamos um cabeçalho 'Referer' genérico, usando a origem da própria URL do vídeo.
    // Isso faz a requisição parecer mais legítima para o servidor de destino.
    const genericReferer = videoUrlObject.origin + "/";

    const range = request.headers.get("range") || undefined;
    const headersToSend = new Headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": genericReferer,
    });
    if (range) {
      headersToSend.set("Range", range);
    }

    const videoResponse = await fetch(videoUrl, {
      headers: headersToSend,
      cache: "no-store",
    });

    if (!videoResponse.ok || !videoResponse.body) {
      const errorText = await videoResponse.text();
      console.error(`Falha ao buscar o vídeo de ${videoUrl}. Status: ${videoResponse.status}. Resposta: ${errorText}`);
      return new NextResponse(`Não foi possível carregar o vídeo. Status: ${videoResponse.status}`, { status: videoResponse.status });
    }

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
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}