// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// O runtime 'edge' é ideal para redirecionamentos, pois é muito rápido.
export const runtime = "edge";

export async function GET(request: NextRequest) {
  // 1. Verificação de segurança (Referer)
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER;

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse("Acesso Negado.", { status: 403 });
  }

  // 2. Obtenção da URL do vídeo
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  // 3. Redirecionamento simples e direto para a URL do vídeo
  try {
    return NextResponse.redirect(new URL(videoUrl), 307);
  } catch (error) {
    console.error("URL de redirecionamento inválida:", videoUrl, error);
    return new NextResponse("URL de vídeo inválida.", { status: 400 });
  }
}