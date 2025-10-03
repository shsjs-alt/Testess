import { NextRequest, NextResponse } from "next/server";

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
        const url = new URL(videoUrl);
        const isManifest = videoUrl.includes('.m3u8') || videoUrl.endsWith('.txt');

        // Fetch do recurso original (manifesto ou segmento de vídeo)
        const originResponse = await fetch(videoUrl, {
            headers: {
                'Referer': `https://${url.hostname}/`, // Referer dinâmico
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        if (!originResponse.ok) {
            return new NextResponse('Falha ao buscar o conteúdo de origem.', { status: originResponse.status });
        }

        // Se for um manifesto, precisamos reescrever as URLs internas
        if (isManifest) {
            const manifestText = await originResponse.text();
            
            // A URL completa do manifesto serve como base para resolver caminhos relativos
            const baseUrlForRelativePaths = videoUrl; 

            const rewrittenManifest = manifestText
                .split('\n')
                .map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        // Se a linha não é um comentário, é uma URL
                        const absoluteSegmentUrl = new URL(trimmedLine, baseUrlForRelativePaths).toString();
                        // Reescreve a URL para apontar de volta para o nosso proxy
                        return `/api/video-proxy?videoUrl=${encodeURIComponent(absoluteSegmentUrl)}`;
                    }
                    return line;
                })
                .join('\n');

            const headers = new Headers({
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin': '*',
            });

            return new NextResponse(rewrittenManifest, { status: 200, headers });
        } else {
            // Se for um segmento de vídeo (.ts) ou outro arquivo, apenas faz o stream
            const readableStream = originResponse.body;
            const headers = new Headers(originResponse.headers);
            headers.set('Access-Control-Allow-Origin', '*');

            return new NextResponse(readableStream, {
                status: originResponse.status,
                statusText: originResponse.statusText,
                headers: headers
            });
        }

    } catch (error) {
        console.error("Erro no proxy de vídeo:", error);
        return new NextResponse("Erro interno no servidor de proxy.", { status: 500 });
    }
}