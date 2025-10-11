// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER;

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse("Acesso Negado.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  try {
    // Busca o vídeo da URL de origem
    const videoResponse = await fetch(videoUrl, {
      headers: {
        // Adiciona um referer genérico para maior compatibilidade
        Referer: "https://www.google.com/",
      },
    });

    if (!videoResponse.ok || !videoResponse.body) {
      return new NextResponse("Falha ao buscar o conteúdo do vídeo.", { status: videoResponse.status });
    }

    // Cria os cabeçalhos da resposta, repassando os cabeçalhos importantes do vídeo original
    const headers = new Headers({
      "Content-Type": videoResponse.headers.get("Content-Type") || "video/mp4",
      "Content-Length": videoResponse.headers.get("Content-Length") || "",
      "Accept-Ranges": "bytes",
    });

    // Retorna o corpo do vídeo como um stream
    return new NextResponse(videoResponse.body, {
      status: 200,
      headers,
    });
    
  } catch (error) {
    console.error("Erro no proxy de vídeo:", error);
    return new NextResponse("Erro interno ao processar o vídeo.", { status: 500 });
  }
}