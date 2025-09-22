"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type Props = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

// Função para gerar os números da paginação com "..."
const generatePagination = (currentPage: number, totalPages: number) => {
  // Se o total de páginas for 7 ou menos, mostra todos os números
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  // Se a página atual está perto do início
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages - 1, totalPages]
  }

  // Se a página atual está perto do fim
  if (currentPage >= totalPages - 2) {
    return [1, 2, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  // Se a página atual está no meio
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages]
}

export default function PaginationComponent({ currentPage, totalPages, onPageChange }: Props) {
  const paginationItems = generatePagination(currentPage, totalPages)

  const handlePrevious = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handlePageClick = (e: React.MouseEvent<HTMLAnchorElement>, page: number) => {
    e.preventDefault()
    onPageChange(page)
  }

  return (
    <Pagination>
      <PaginationContent>
        {/* Botão Anterior */}
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={handlePrevious}
            aria-disabled={currentPage === 1}
            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {/* Números da Página */}
        {paginationItems.map((item, index) => (
          <PaginationItem key={index}>
            {item === "..." ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={currentPage === item}
                onClick={(e) => handlePageClick(e, item as number)}
              >
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        {/* Botão Próximo */}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={handleNext}
            aria-disabled={currentPage === totalPages}
            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}