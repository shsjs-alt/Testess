import { NextRequest, NextResponse } from "next/server";

const uriRegex = /URI="([^"]+)"/g;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get("videoUrl");

    if (!videoUrl) {
        return new NextResponse("URL do vídeo não foi fornecida.", { status: 400 });
    }

    try {
        const url = new URL(videoUrl);
        const originResponse = await fetch(videoUrl, {
            headers: {
                'Referer': `https://${url.hostname}/`,
                'Origin': `https://${url.hostname}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
        });

        if (!originResponse.ok) {
            console.error(`Falha ao buscar URL original: ${videoUrl} - Status: ${originResponse.status}`);
            return new NextResponse('Falha ao buscar o conteúdo de origem.', { status: originResponse.status });
        }

        const finalUrl = originResponse.url;
        const isManifest = finalUrl.includes('.m3u8') || finalUrl.includes('.txt');
        
        const responseHeaders = new Headers({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        });

        if (isManifest) {
            let manifestText = await originResponse.text();
            
            // Extrai a URL base (tudo antes do último '/')
            const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);

            const proxyUrl = (path: string) => {
                // Se o caminho já for uma URL absoluta, use-a diretamente
                if (path.startsWith('http')) {
                    return `/api/video-proxy?videoUrl=${encodeURIComponent(path)}`;
                }
                // Se for relativo, constrói a URL completa corretamente
                const fullSegmentUrl = new URL(path, baseUrl).href;
                return `/api/video-proxy?videoUrl=${encodeURIComponent(fullSegmentUrl)}`;
            };
            
            manifestText = manifestText.replace(uriRegex, (match, uri) => `URI="${proxyUrl(uri)}"`);
            
            const rewrittenManifest = manifestText.split('\n').map(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    return proxyUrl(trimmed);
                }
                return line;
            }).join('\n');

            responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl');
            return new NextResponse(rewrittenManifest, { status: 200, headers: responseHeaders });
        } else {
            const readableStream = originResponse.body;
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
        console.error("Erro CRÍTICO no proxy de vídeo:", error);
        return new NextResponse("Erro interno no servidor de proxy.", { status: 500 });
    }
}