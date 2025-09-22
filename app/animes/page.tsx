// app/animes/page.tsx
import MediaGridPage from "@/components/media-grid-page";

export default function AnimesPage() {
  // Busca por séries (tv) com o gênero Animação (16) e país de origem Japão (JP)
  const fetchUrl = "/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc";
  return <MediaGridPage title="Animes Populares" fetchUrl={fetchUrl} mediaType="tv" />;
}