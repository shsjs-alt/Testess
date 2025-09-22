export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black text-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-blue-500 border-solid"></div>
    </div>
  )
}
