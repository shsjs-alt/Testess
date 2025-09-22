"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, User2 } from 'lucide-react'

type Person = {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string
  popularity: number
}

const API_KEY = "860b66ade580bacae581f4228fad49fc" // <-- CHAVE ATUALIZADA
const API_BASE_URL = "https://api.themoviedb.org/3"

// ... (o resto do arquivo permanece o mesmo)
export default function ActorsSearchPage() {
  const params = useSearchParams()
  const q = params.get("query") || ""
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Person[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function load() {
      setError(null)
      if (!q) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE_URL}/search/person?query=${encodeURIComponent(q)}&api_key=${API_KEY}&language=pt-BR`)
        if (!res.ok) throw new Error("Falha ao buscar atores.")
        const data = await res.json()
        if (!ignore) setResults(data.results || [])
      } catch (e: any) {
        if (!ignore) setError(e?.message || "Erro desconhecido.")
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [q])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Buscar Atores</h1>
          <p className="text-sm text-zinc-400">Resultados para: {q ? `"${q}"` : "—"}</p>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : results.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <User2 className="h-8 w-8" />
            <p>Nenhum ator encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map((p) => (
              <Link key={p.id} href={`/actor/${p.id}`} className="group">
                <div className="aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5">
                  {p.profile_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w500/${p.profile_path}`}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User2 className="h-8 w-8 text-zinc-600" />
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-zinc-400">{p.known_for_department}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}