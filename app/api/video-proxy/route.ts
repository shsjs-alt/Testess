// app/api/video-proxy/route.ts
import { NextResponse, NextRequest } from "next/server";

// Revertemos para o runtime 'nodejs', que é mais estável para este caso de uso.
export const runtime = "nodejs";

// Lista de cabeçalhos que não devem ser repassados para o servidor de vídeo
const BLOCKED_HEADERS = new Set([
  "host", "content-length", "transfer-encoding", "connection", "keep-alive",
  "upgrade", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-dest",
  "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
]);

// Função para limpar e preparar os cabeçalhos da requisição
function sanitizeHeaders(input: Record<string, string> | undefined | null) {
  const out: Record<string, string> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    const key = k.toLowerCase();
    if (BLOCKED_HEADERS.has(key)) continue;
    if (typeof v !== "string" || v.length === 0) continue;
    out[key === "referer" ? "Referer" : key === "origin" ? "Origin" : k] = v;
  }
  return out;
}

// Função para gerar possíveis URLs de Referer
function buildRefererCandidates(target: URL): string[] {
  const hostParts = target.hostname.split(".");
  const baseDomain = hostParts.length >= 2 ? `${hostParts.slice(-2).join(".")}` : target.hostname;
  const rootOrigin = `${target.protocol}//${baseDomain}`;
  const assetOrigin = `${target.protocol}//${target.hostname}`;
  const ensureSlash = (u: string) => (u.endsWith("/") ? u : `${u}/`);
  const candidates = [ensureSlash(rootOrigin), ensureSlash(assetOrigin)];
  return Array.from(new Set(candidates));
}

async function proxyOnce(videoUrl: string, headersToSend: HeadersInit) {
  return fetch(videoUrl, {
    headers: headersToSend,
    cache: "no-store",
  });
}

export async function GET(request: NextRequest) {
  const referer = request.headers.get("referer");
  const allowedReferer = process.env.ALLOWED_REFERER;

  if (allowedReferer && (!referer || !referer.startsWith(allowedReferer))) {
    return new NextResponse(
      "ops, sem permissão mn, a gente tenta disponibilizar um bglh grátis, mas vem uns fdp tentar roubar nossas urls, pode roubar mas como que tu vai usar? é nois mn",
      { status: 403, headers: { 'Content-Type': 'text/plain' } }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get("videoUrl");
  const encodedHeaders = searchParams.get("headers");
  const rangeHeader = request.headers.get("range");

  if (!videoUrl) {
    return new NextResponse("URL do vídeo não fornecida.", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(videoUrl);
  } catch {
    return new NextResponse("URL do vídeo inválida.", { status: 400 });
  }

  const baseHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8,en-US;q=0.7",
    "Accept-Encoding": "identity",
    Connection: "keep-alive",
  };

  let provided: Record<string, string> = {};
  if (encodedHeaders) {
    try {
      const decoded = JSON.parse(decodeURIComponent(encodedHeaders));
      const maybeRequest = decoded?.request && typeof decoded.request === "object" ? decoded.request : decoded;
      provided = sanitizeHeaders(maybeRequest);
    } catch (e) {
      console.error("[VideoProxy] Erro ao decodificar cabeçalhos:", e);
    }
  }

  if (rangeHeader) {
    baseHeaders["Range"] = rangeHeader;
  }

  const referers = buildRefererCandidates(target);
  const attempts: HeadersInit[] = [];

  if (Object.keys(provided).length > 0) {
    attempts.push({ ...baseHeaders, ...provided });
  }

  for (const ref of referers) {
    const origin = ref.replace(/\/+$/, "");
    const withDerived = { ...baseHeaders, Referer: ref, Origin: origin, ...provided };
    attempts.push(withDerived);
  }

  let lastResponse: Response | null = null;
  for (const headersToSend of attempts) {
    try {
      const res = await proxyOnce(videoUrl, headersToSend);
      // Se a resposta for bem-sucedida (OK ou Partial Content), transmita-a diretamente.
      if (res.ok || res.status === 206) {
        const responseHeaders = new Headers();
        const contentType = res.headers.get("Content-Type");
        const contentLength = res.headers.get("Content-Length");
        const acceptRanges = res.headers.get("Accept-Ranges");
        const contentRange = res.headers.get("Content-Range");

        if (contentType) responseHeaders.set("Content-Type", contentType);
        if (contentLength) responseHeaders.set("Content-Length", contentLength);
        if (acceptRanges) responseHeaders.set("Accept-Ranges", acceptRanges);
        if (contentRange) responseHeaders.set("Content-Range", contentRange);
        
        // Cabeçalhos para garantir que o navegador não armazene o vídeo em cache
        responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
        responseHeaders.set("Pragma", "no-cache");
        responseHeaders.set("Expires", "0");
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
        responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
        
        return new NextResponse(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: responseHeaders,
        });
      }
      lastResponse = res;
      if (res.status === 401 || res.status === 403) continue; // Tenta o próximo se for erro de permissão

      // Otimização: Não lê o corpo do erro, apenas repassa o status
      return new NextResponse(`Falha ao carregar vídeo: ${res.status} - ${res.statusText}`, { status: res.status });
    } catch (error: any) {
      lastResponse = null; // Reseta em caso de erro de rede para não retornar uma resposta inválida
      continue;
    }
  }

  if (lastResponse) {
    return new NextResponse(
      `Acesso negado pelo provedor (status ${lastResponse.status}). O link pode ter expirado ou requer Referer específico.`,
      { status: lastResponse.status }
    );
  }

  return new NextResponse("Não foi possível alcançar o provedor de vídeo.", { status: 502 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}