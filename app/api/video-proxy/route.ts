import { NextRequest, NextResponse } from "next/server";

// Expressão regular para encontrar atributos URI="..." nos manifestos HLS
const uriRegex = /URI="([^"]+)"/g;

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
        // Uma heurística mais ampla para detectar manifestos
        const isManifest = videoUrl.includes('.m3u8') || videoUrl.endsWith('.txt');

        const originResponse = await fetch(videoUrl, {
            headers: {
                'Referer': `https://${url.hostname}/`,
                'Origin': `https://${url.hostname}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            redirect: 'follow', // Segue redirecionamentos automaticamente
        });

        if (!originResponse.ok) {
            return new NextResponse('Falha ao buscar o conteúdo de origem.', { status: originResponse.status });
        }

        // Usa a URL final após redirecionamentos como base para links relativos
        const finalUrl = originResponse.url;

        // Headers de resposta para o cliente, prevenindo o cache
        const responseHeaders = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });

        if (isManifest) {
            let manifestText = await originResponse.text();

            // Função para resolver um caminho relativo e criar a URL do proxy
            const proxyUrl = (path: string) => {
                const absoluteUrl = new URL(path, finalUrl).toString();
                return `/api/video-proxy?videoUrl=${encodeURIComponent(absoluteUrl)}`;
            };

            // 1. Reescreve URLs dentro de atributos URI="..."
            manifestText = manifestText.replace(uriRegex, (match, uri) => {
                return `URI="${proxyUrl(uri)}"`;
            });

            // 2. Reescreve URLs que estão sozinhas em uma linha
            const rewrittenManifest = manifestText
                .split('\n')
                .map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        return proxyUrl(trimmedLine);
                    }
                    return line;
                })
                .join('\n');

            responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
            return new NextResponse(rewrittenManifest, { status: 200, headers: responseHeaders });

        } else {
            // Se for um segmento de vídeo (.ts) ou outro arquivo, apenas faz o stream
            const readableStream = originResponse.body;
            
            // Repassa os headers originais importantes
            const contentType = originResponse.headers.get('Content-Type');
            if (contentType) responseHeaders.set('Content-Type', contentType);
            const contentLength = originResponse.headers.get('Content-Length');
            if (contentLength) responseHeaders.set('Content-Length', contentLength);

            return new NextResponse(readableStream, {
                status: originResponse.status,
                statusText: originResponse.statusText,
                headers: responseHeaders
            });
        }

    } catch (error) {
        console.error("Erro no proxy de vídeo:", error);
        return new NextResponse("Erro interno no servidor de proxy.", { status: 500 });
    }
}