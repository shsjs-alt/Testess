// app/actor/[id]/page.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, User2, Film, Tv } from 'lucide-react'

type Credit = {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  popularity: number;
};

type Person = {
  id: number
  name: string
  biography: string
  profile_path: string | null
  birthday: string | null
  place_of_birth: string | null
  combined_credits: {
    cast: Credit[]
  }
}

const API_KEY = "860b66ade580bacae581f4228fad49fc"
const API_BASE_URL = "https://api.themoviedb.org/3"

// --- NOVA FUNÇÃO DE VERIFICAÇÃO ---
async function verifyCreditAvailability(item: Credit): Promise<boolean> {
  const url = item.media_type === 'movie' 
    ? `/api/stream/movies/${item.id}` 
    : `/api/stream/series/${item.id}/1/1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    return data.streams && data.streams.length > 0;
  } catch (error) {
    return false;
  }
}

export default function ActorDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState<Person | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verifiedCredits, setVerifiedCredits] = useState<Credit[]>([]);
  const [verifyingCredits, setVerifyingCredits] = useState(false);

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setVerifyingCredits(true);
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/person/${id}?api_key=${API_KEY}&language=pt-BR&append_to_response=combined_credits`)
        if (!res.ok) throw new Error("Falha ao buscar ator.")
        const data: Person = await res.json()
        if (!ignore) {
            setPerson(data);
            
            // Após buscar os dados do ator, inicia a verificação dos créditos
            const sorted = [...(data.combined_credits?.cast || [])]
                .sort((a, b) => b.popularity - a.popularity)
                .slice(0, 60);

            const availabilityChecks = sorted.map(async (credit) => ({
                ...credit,
                isAvailable: await verifyCreditAvailability(credit)
            }));
            
            const checkedCredits = await Promise.all(availabilityChecks);
            if (!ignore) {
                setVerifiedCredits(checkedCredits.filter(c => c.isAvailable));
            }
        }
      } catch (e: any) {
        if (!ignore) setError(e?.message || "Erro desconhecido.")
      } finally {
        if (!ignore) {
            setLoading(false);
            setVerifyingCredits(false);
        }
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [id])


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }
  if (error || !person) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-50">
        <p className="text-red-400">{error || "Erro ao carregar."}</p>
        <Link href="/" className="mt-3 inline-block underline">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="relative h-[38vh] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950" />
      </div>

      <main className="relative z-10 -mt-24 mx-auto w-full max-w-7xl px-4 pb-20">
        <section className="flex flex-col gap-6 md:flex-row md:gap-10">
          <div className="mx-auto w-36 shrink-0 sm:w-44 md:mx-0 md:w-52">
            <div className="overflow-hidden rounded-xl ring-1 ring-white/10 bg-zinc-900 aspect-[3/4]">
              {person.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500/${person.profile_path}`}
                  alt={person.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User2 className="h-10 w-10 text-zinc-600" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{person.name}</h1>
            <div className="mt-3 text-sm text-zinc-400">
              {person.birthday && <span>Nascimento: {person.birthday}</span>}
              {person.place_of_birth && <span className="ml-3">• {person.place_of_birth}</span>}
            </div>
            {person.biography && (
              <p className="mt-5 max-w-3xl text-zinc-300">{person.biography}</p>
            )}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-2xl font-bold">Participações populares</h2>
            {verifyingCredits && <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />}
          </div>
          {verifiedCredits.length === 0 && !verifyingCredits ? (
            <p className="text-zinc-400">Nenhum crédito disponível encontrado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {verifiedCredits.map((c) => {
                const title = c.title || c.name || "Título desconhecido"
                const date = c.release_date || c.first_air_date || ""
                const url = `/${c.media_type}/${c.id}`
                return (
                  <Link key={`${c.media_type}-${c.id}`} href={url} className="group">
                    <div className="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5">
                      {c.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w500/${c.poster_path}`}
                          alt={title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {c.media_type === "movie" ? (
                            <Film className="h-8 w-8 text-zinc-600" />
                          ) : (
                            <Tv className="h-8 w-8 text-zinc-600" />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold">{title}</p>
                    <p className="text-xs text-zinc-400">{date ? date.slice(0, 4) : ""}</p>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}