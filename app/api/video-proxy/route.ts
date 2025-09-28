// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Podemos usar o runtime 'edge' para redirecionamentos super rápidos.
export const runtime = "edge";

export async function GET(request: NextRequest) {
  // Mantemos a verificação de segurança para garantir que só seu site use a rota.
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER; // Configure esta variável no seu Vercel

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse("Acesso Negado.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  // --- NOVA LÓGICA DE REDIRECIONAMENTO ---
  // Em vez de buscar o vídeo, nós simplesmente dizemos ao navegador para ir diretamente para a URL final.
  // O código 302 é um redirecionamento temporário, ideal para este caso.
  try {
    return NextResponse.redirect(new URL(videoUrl), 302);
  } catch (error) {
    console.error("URL de redirecionamento inválida:", videoUrl, error);
    return new NextResponse("URL de vídeo inválida.", { status: 400 });
  }
}