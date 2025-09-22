"use client"

import Link from "next/link"
import { useFavorites, FavoritesProvider } from "@/components/favorites-context"
import { Film, HeartCrack } from 'lucide-react'

function FavoritesPageInner() {
  const { favorites, remove } = useFavorites()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Favoritos</h1>
            <p className="text-sm text-zinc-400">Seus filmes e séries salvos.</p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-white/10 px-4 py-2 text-sm text-white ring-1 ring-white/10 hover:bg-white/20 transition-colors"
          >
            Voltar para Home
          </Link>
        </div>

        {favorites.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <HeartCrack className="h-8 w-8" />
            <p>Nenhum item nos favoritos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favorites.map((f) => (
              <div key={`${f.id}-${f.media_type}`} className="group relative">
                <Link href={`/${f.media_type}/${f.id}`} className="block">
                  <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5">
                    {f.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w500/${f.poster_path}`}
                        alt={f.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film className="h-8 w-8 text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold">{f.title}</p>
                </Link>
                <button
                  onClick={() => remove(f.id, f.media_type)}
                  className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-xs text-white ring-1 ring-white/10 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FavoritesPage() {
  // O FavoritesProvider já está no layout principal, então não é mais necessário aqui
  return <FavoritesPageInner />
}