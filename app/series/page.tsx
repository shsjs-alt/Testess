// app/series/page.tsx
import MediaGridPage from "@/components/media-grid-page";

export default function SeriesPage() {
  const fetchUrl = "/discover/tv?sort_by=popularity.desc";
  return <MediaGridPage title="Séries Populares" fetchUrl={fetchUrl} mediaType="tv" />;
}