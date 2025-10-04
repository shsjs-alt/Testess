// app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Usar o runtime 'edge' é ideal para redirecionamentos, pois é muito rápido.
export const runtime = "edge";

export async function GET(request: NextRequest) {
  // 1. Obtenção da URL do vídeo a partir do parâmetro da query.
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  // 2. Redirecionar o player diretamente para a URL final do vídeo.
  // O método searchParams.get() já decodifica a URL para nós.
  try {
    // O código 307 (Redirecionamento Temporário) é o mais adequado aqui.
    return NextResponse.redirect(new URL(videoUrl), 307);
  } catch (error) {
    console.error("URL de redirecionamento inválida:", videoUrl, error);
    return new NextResponse("URL de vídeo inválida.", { status: 400 });
  }
}