// app/doramas/page.tsx
import MediaGridPage from "@/components/media-grid-page";

export default function DoramasPage() {
  // Busca por séries (tv) com país de origem Coreia do Sul (KR) e exclui o gênero animação (16)
  const fetchUrl = "/discover/tv?with_origin_country=KR&sort_by=popularity.desc&without_genres=16";
  return <MediaGridPage title="Doramas Populares" fetchUrl={fetchUrl} mediaType="tv" />;
}