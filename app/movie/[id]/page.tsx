// app/movie/[id]/page.tsx

import MovieDetailClient from "./MovieDetailClient";
import Loading from "./loading";
import { Suspense } from "react";

// Este agora é um Componente de Servidor.
export default function MovieDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Loading />}>
      <MovieDetailClient id={params.id} />
    </Suspense>
  );
}