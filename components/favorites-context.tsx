"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type FavoriteItem = {
  id: number
  media_type: "movie" | "tv"
  title: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string | null
}

type FavoritesContextValue = {
  favorites: FavoriteItem[]
  add: (item: FavoriteItem) => void
  remove: (id: number, media_type: "movie" | "tv") => void
  toggle: (item: FavoriteItem) => void
  isFavorite: (id: number, media_type: "movie" | "tv") => boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)
const STORAGE_KEY = "btnmovies:favorites"

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setFavorites(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
    } catch {
      // ignore
    }
  }, [favorites])

  const add = useCallback((item: FavoriteItem) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === item.id && f.media_type === item.media_type)) return prev
      return [item, ...prev]
    })
  }, [])

  const remove = useCallback((id: number, media_type: "movie" | "tv") => {
    setFavorites((prev) => prev.filter((f) => !(f.id === id && f.media_type === media_type)))
  }, [])

  const toggle = useCallback((item: FavoriteItem) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === item.id && f.media_type === item.media_type)
      if (exists) return prev.filter((f) => !(f.id === item.id && f.media_type === item.media_type))
      return [item, ...prev]
    })
  }, [])

  const isFavorite = useCallback(
    (id: number, media_type: "movie" | "tv") => favorites.some((f) => f.id === id && f.media_type === media_type),
    [favorites],
  )

  const value = useMemo(() => ({ favorites, add, remove, toggle, isFavorite }), [favorites, add, remove, toggle, isFavorite])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider")
  return ctx
}
