// app/download/movies/[tmdbId]/route.ts
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(
  request: Request,
  { params }: { params: { tmdbId: string } }
) {
  const { tmdbId } = params;
  if (!tmdbId) {
    return NextResponse.json({ error: "TMDB ID é necessário." }, { status: 400 });
  }

  try {
    const docRef = doc(firestore, "media", tmdbId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const docData = docSnap.data();
      if (docData && Array.isArray(docData.urls) && docData.urls.length > 0 && docData.urls[0].url) {
        const downloadUrl = docData.urls[0].url;
        const adUrl = "https://otieu.com/4/9835277";

        // Tenta extrair um nome de arquivo da URL para o download
        let filename = `filme_${tmdbId}.mp4`;
        try {
          const urlPath = new URL(downloadUrl).pathname;
          const parts = urlPath.split('/');
          const decodedPart = decodeURIComponent(parts[parts.length - 1]);
          if (decodedPart) filename = decodedPart;
        } catch (e) {
          console.warn("Não foi possível extrair o nome do arquivo da URL.");
        }
        
        const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Download</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #111; color: #eee; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                .container { padding: 2rem; background-color: #1c1c1c; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                h1 { color: #fff; margin-bottom: 1.5rem; }
                #downloadBtn { background-color: #f5c518; color: #111; border: none; padding: 1rem 2rem; font-size: 1.2rem; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background-color 0.3s; }
                #downloadBtn:hover { background-color: #e0b416; }
                #downloadBtn:disabled { background-color: #555; color: #999; cursor: not-allowed; }
                .spinner { display: none; width: 48px; height: 48px; border: 5px solid #fff; border-bottom-color: #f5c518; border-radius: 50%; animation: rotation 1s linear infinite; }
                @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Preparando seu Download</h1>
                <button id="downloadBtn">Download</button>
                <div id="spinner" class="spinner"></div>
            </div>
            <script>
                const downloadBtn = document.getElementById('downloadBtn');
                const spinner = document.getElementById('spinner');

                downloadBtn.addEventListener('click', function() {
                    // 1. Esconde o botão e mostra a bolinha de loading
                    downloadBtn.style.display = 'none';
                    spinner.style.display = 'inline-block';
                    
                    // 2. Inicia o download
                    const url = "${downloadUrl}";
                    const filename = "${filename}";
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.setAttribute('download', filename);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // 3. Redireciona para o anúncio após 4 segundos
                    setTimeout(function() {
                        window.location.href = '${adUrl}';
                    }, 4000);
                });
            </script>
        </body>
        </html>
        `;

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' },
        });
      }
    }

    return NextResponse.json({ error: "Link de download não encontrado." }, { status: 404 });

  } catch (error: any) {
    console.error(`[Download Filme ${tmdbId}] Erro:`, error.message);
    return NextResponse.json({ error: "Falha ao buscar link de download." }, { status: 500 });
  }
}