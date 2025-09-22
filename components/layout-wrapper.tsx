"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import React, { useState } from "react"
import { Search, Heart, Home, Film, Tv, Clapperboard, Drama } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const pathname = usePathname()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?query=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  // Não mostrar cabeçalho em páginas de embed
  if (pathname.startsWith('/embed')) {
    return <>{children}</>
  }
  
  const navLinks = [
    { href: "/", label: "Início", icon: Home },
    { href: "/filmes", label: "Filmes", icon: Film },
    { href: "/series", label: "Séries", icon: Tv },
    { href: "/animes", label: "Animes", icon: Clapperboard },
    { href: "/doramas", label: "Doramas", icon: Drama },
  ];


  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="container flex h-16 max-w-screen-2xl items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <img src="https://i.ibb.co/rKhmNPtV/primevicio.png" alt="PrimeVicio Logo" className="h-8 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => {
                 const isActive = pathname === link.href;
                 return (
                    <Link key={link.href} href={link.href} passHref>
                      <Button variant="ghost" className={cn("text-sm font-medium", isActive ? "text-white" : "text-zinc-400 hover:text-white")}>
                         <link.icon className="mr-2 h-4 w-4" />
                         {link.label}
                      </Button>
                    </Link>
                 )
            })}
          </nav>
          
          <div className="flex flex-1 items-center justify-end space-x-2">
            <form
              onSubmit={handleSearch}
              className="relative w-full max-w-xs"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                type="search"
                placeholder="Buscar filmes e séries..."
                className="w-full bg-zinc-900 border-zinc-800 pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <Link href="/favorites">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                <Heart className="h-5 w-5" />
                <span className="sr-only">Favoritos</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <Toaster />
    </>
  )
}