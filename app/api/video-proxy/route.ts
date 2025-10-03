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
        const videoResponse = await fetch(videoUrl, {
            headers: {
                "Referer": "https://brplayer.cc/" // Adicionando um referer para compatibilidade
            }
        });

        if (!videoResponse.ok) {
            return new NextResponse("Falha ao buscar o vídeo.", { status: videoResponse.status });
        }

        const headers = new Headers(videoResponse.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        // Força o content-type correto para links m3u8 que terminam em .txt
        if (videoUrl.endsWith('.txt') && (videoUrl.includes('/m3u8/') || videoUrl.includes('master.m3u8'))) {
             headers.set('Content-Type', 'application/vnd.apple.mpegurl');
        }

        // Faz o stream do conteúdo do vídeo
        const readableStream = videoResponse.body;

        return new NextResponse(readableStream, {
            status: videoResponse.status,
            statusText: videoResponse.statusText,
            headers: headers
        });

    } catch (error) {
        console.error("Erro no proxy de vídeo:", error);
        return new NextResponse("Erro interno no servidor de proxy.", { status: 500 });
    }
}