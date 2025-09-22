// app/filmes/page.tsx
import MediaGridPage from "@/components/media-grid-page";

export default function FilmesPage() {
  const fetchUrl = "/discover/movie?sort_by=popularity.desc";
  return <MediaGridPage title="Filmes Populares" fetchUrl={fetchUrl} mediaType="movie" />;
}