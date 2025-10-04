// app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// O runtime 'edge' é ideal para redirecionamentos, pois é muito rápido.
export const runtime = "edge";

export async function GET(request: NextRequest) {
  // 1. Verificação de segurança (Referer) - Opcional, mas recomendado.
  // Descomente e configure a variável ALLOWED_REFERER no Vercel se precisar restringir o acesso.
  /*
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER; 

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse("Acesso Negado.", { status: 403 });
  }
  */

  // 2. Obtenção da URL do vídeo do parâmetro da query.
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
  }

  // 3. Redirecionar o player para a URL final do vídeo.
  // searchParams.get() já decodifica a URL, então usamos diretamente.
  try {
    // O código 307 (Redirecionamento Temporário) mantém o método da requisição original.
    return NextResponse.redirect(new URL(videoUrl), 307);
  } catch (error) {
    console.error("URL de redirecionamento inválida:", videoUrl, error);
    return new NextResponse("URL de vídeo inválida.", { status: 400 });
  }
}