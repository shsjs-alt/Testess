// PrimeVicio - Site/app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Revertemos para o runtime 'nodejs', que é mais estável para streaming de arquivos grandes.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // 1. Verificação de segurança (Referer)
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER;

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
    // A chave aqui é simular um navegador comum para evitar bloqueios.
    const videoUrlObject = new URL(videoUrl);
    const genericReferer = videoUrlObject.origin + "/";

    const range = request.headers.get("range"); // Essencial para o player poder avançar/retroceder o vídeo

    const headersToSend = new Headers();
    headersToSend.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
    headersToSend.set("Referer", genericReferer);
    if (range) {
      headersToSend.set("Range", range);
    }
    
    // 4. Buscando o vídeo no servidor de origem
    const videoResponse = await fetch(videoUrl, {
      headers: headersToSend,
      cache: "no-store", // Importante para não armazenar o vídeo em cache no seu servidor
    });

    // 5. Verificando se a resposta é válida
    if (!videoResponse.ok || !videoResponse.body) {
      const errorText = await videoResponse.text();
      console.error(`[Proxy de Streaming] Falha ao buscar o vídeo de ${videoUrl}. Status: ${videoResponse.status}. Resposta: ${errorText}`);
      return new NextResponse(`Erro no servidor de origem: Status ${videoResponse.status}`, { status: videoResponse.status });
    }

    // 6. Retransmitindo (streaming) o vídeo para o usuário
    // O navegador do usuário só verá a URL do seu site, nunca a URL final.
    const responseHeaders = new Headers();
    // Copiamos cabeçalhos importantes como Content-Length, Content-Type, e Accept-Ranges
    responseHeaders.set("Content-Length", videoResponse.headers.get("Content-Length") || '0');
    responseHeaders.set("Content-Type", videoResponse.headers.get("Content-Type") || 'video/mp4');
    responseHeaders.set("Accept-Ranges", videoResponse.headers.get("Accept-Ranges") || 'bytes');
    
    // O status da resposta precisa ser 206 (Partial Content) se o navegador pedir um 'range'
    const status = videoResponse.status === 206 ? 206 : 200;

    return new NextResponse(videoResponse.body, {
      status: status,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error(`[Proxy de Streaming] Erro crítico ao processar a URL ${videoUrl}:`, error);
    return new NextResponse("Erro interno no servidor ao tentar processar o vídeo.", { status: 500 });
  }
}