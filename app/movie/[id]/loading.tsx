export default function Loading() {
  return (
    <div className="bg-black min-h-screen text-white animate-pulse">
      {/* Skeleton do Backdrop */}
      <div className="relative h-[40vh] md:h-[60vh] bg-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black" />
      </div>

      {/* Skeleton do Conteúdo Principal */}
      <main className="container mx-auto px-4 pb-16 -mt-24 md:-mt-48 relative z-10">
        <div className="md:flex md:gap-8">
          {/* Skeleton do Poster */}
          <div className="flex-shrink-0 w-48 md:w-64 mx-auto md:mx-0">
            <div className="w-full aspect-[2/3] bg-zinc-800 rounded-lg shadow-2xl"></div>
          </div>

          {/* Skeleton dos Detalhes */}
          <div className="mt-6 md:mt-0 text-center md:text-left flex-grow">
            <div className="h-10 bg-zinc-800 rounded w-3/4 mx-auto md:mx-0"></div>
            <div className="h-5 bg-zinc-800 rounded w-1/2 mx-auto md:mx-0 mt-4"></div>
            <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
              <div className="h-7 bg-zinc-800 rounded-full w-20"></div>
              <div className="h-7 bg-zinc-800 rounded-full w-24"></div>
              <div className="h-7 bg-zinc-800 rounded-full w-16"></div>
            </div>
          </div>
        </div>

        {/* Skeleton da Sinopse, Elenco e Trailer */}
        <div className="mt-12 space-y-12">
          <section>
            <div className="h-8 bg-zinc-800 rounded w-48 mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-zinc-800 rounded w-full"></div>
              <div className="h-4 bg-zinc-800 rounded w-full"></div>
              <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
            </div>
          </section>

          <section>
            <div className="h-8 bg-zinc-800 rounded w-64 mb-4"></div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="text-center flex-shrink-0 w-28">
                  <div className="w-24 h-24 mx-auto rounded-full bg-zinc-800"></div>
                  <div className="h-4 bg-zinc-800 rounded w-20 mx-auto mt-2"></div>
                  <div className="h-3 bg-zinc-800 rounded w-16 mx-auto mt-1"></div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="h-8 bg-zinc-800 rounded w-32 mb-4"></div>
            <div className="aspect-video bg-zinc-800 rounded-lg"></div>
          </section>
        </div>
      </main>
    </div>
  )
}
