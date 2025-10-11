// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Revertemos para o 'edge' runtime para redirecionamentos mais rápidos
export const runtime = "edge";

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
    // Tenta resolver a URL final fazendo uma requisição HEAD para seguir os redirecionamentos.
    // Isso é útil para players em dispositivos móveis que podem ter problemas com cadeias de redirecionamento.
    const videoResponse = await fetch(videoUrl, { method: 'HEAD', redirect: 'follow' });

    // A URL final após todos os redirecionamentos.
    const finalUrl = videoResponse.url;

    // Redireciona o cliente para a URL final.
    return NextResponse.redirect(new URL(finalUrl), 307);
    
  } catch (error) {
    console.warn("Proxy: Falha ao resolver a URL final com HEAD, tentando redirecionamento direto.", error);
    // Se a requisição HEAD falhar (ex: não suportada pelo servidor de vídeo),
    // recorremos ao comportamento original de redirecionamento direto, que funciona na maioria dos casos.
    try {
        return NextResponse.redirect(new URL(videoUrl), 307);
    } catch (redirectError) {
        console.error("Proxy: URL de redirecionamento de fallback inválida:", videoUrl, redirectError);
        return new NextResponse("URL de vídeo inválida.", { status: 400 });
    }
  }
}