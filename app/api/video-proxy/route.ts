// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Removido: export const runtime = "edge"; para suportar streaming de dados.

export async function GET(request: NextRequest) {
  // 1. Verificação de segurança (Referer)
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER;

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse("Acesso Negado.", { status: 403 });
  }

  // 2. Obtenção e decodificação da URL do vídeo
  const { searchParams } = new URL(request.url);
  const videoUrlParam = searchParams.get("videoUrl");

  if (!videoUrlParam) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }
  
  const videoUrl = decodeURIComponent(videoUrlParam);

  try {
    // 3. Buscar o vídeo da URL de origem com um referer genérico
    const videoResponse = await fetch(videoUrl, {
      headers: {
        // Adiciona um Referer para evitar bloqueios de hotlink
        "Referer": "https://www.google.com/"
      }
    });

    if (!videoResponse.ok || !videoResponse.body) {
      // Se a busca falhar, retorna o erro do servidor de origem
      return new NextResponse(`Falha ao buscar o vídeo de origem. Status: ${videoResponse.status}`, { status: videoResponse.status });
    }

    // 4. Criar uma nova resposta de streaming
    const headers = new Headers();
    // Copia cabeçalhos essenciais da resposta original para a nova resposta,
    // permitindo que o player de vídeo funcione corretamente (ex: seeking).
    headers.set("Content-Type", videoResponse.headers.get("Content-Type") || "video/mp4");
    headers.set("Content-Length", videoResponse.headers.get("Content-Length") || "");
    headers.set("Accept-Ranges", videoResponse.headers.get("Accept-Ranges") || "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");


    // O corpo (ReadableStream) da resposta original é transmitido diretamente para o cliente.
    return new NextResponse(videoResponse.body, {
      status: videoResponse.status,
      headers: headers
    });

  } catch (error) {
    console.error("Erro no proxy de vídeo:", error);
    return new NextResponse("Erro interno no servidor de proxy.", { status: 500 });
  }
}