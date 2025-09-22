// app/tv/[id]/page.tsx

import TvDetailClient from "./TvDetailClient";
import Loading from "./loading";
import { Suspense } from "react";

// Este agora é um Componente de Servidor que lida corretamente com os `params`.
export default function TVDetailPage({ params }: { params: { id: string } }) {
  // Ele passa o ID para o componente de cliente que cuidará do carregamento dos dados e da interatividade.
  // Usamos <Suspense> para que a tela de loading do Next.js seja exibida enquanto o componente de cliente carrega.
  return (
    <Suspense fallback={<Loading />}>
      <TvDetailClient id={params.id} />
    </Suspense>
  );
}