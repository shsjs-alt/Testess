export default function Loading() {
  return (
    <div className="bg-black min-h-screen text-white animate-pulse">
      <div className="relative h-[40vh] md:h-[60vh] bg-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black" />
      </div>

      <main className="container mx-auto px-4 pb-16 -mt-24 md:-mt-48 relative z-10">
        <div className="md:flex md:gap-12">
          <div className="flex-shrink-0 w-60 md:w-72 mx-auto md:mx-0">
            <div className="w-full aspect-[2/3] bg-zinc-800 rounded-lg shadow-2xl"></div>
          </div>

          <div className="mt-6 md:mt-0 text-center md:text-left flex-grow">
            <div className="h-12 bg-zinc-800 rounded w-3/4 mx-auto md:mx-0"></div>
            <div className="h-5 bg-zinc-800 rounded w-1/2 mx-auto md:mx-0 mt-4"></div>
            <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
              <div className="h-7 bg-zinc-800 rounded-full w-20"></div>
              <div className="h-7 bg-zinc-800 rounded-full w-24"></div>
              <div className="h-7 bg-zinc-800 rounded-full w-16"></div>
            </div>
            <div className="mt-8">
              <div className="h-6 bg-zinc-800 rounded w-32 mb-2"></div>
              <div className="space-y-2">
                <div className="h-4 bg-zinc-800 rounded w-full"></div>
                <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 space-y-12">
          <section>
            <div className="h-8 bg-zinc-800 rounded w-48 mb-4"></div>
            <div className="h-12 bg-zinc-800 rounded w-64 mb-4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-zinc-800 rounded w-full"></div>
              <div className="h-10 bg-zinc-800 rounded w-full"></div>
              <div className="h-10 bg-zinc-800 rounded w-full"></div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
