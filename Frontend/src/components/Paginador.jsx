// Controles de paginación compartidos por Productos, Stock y Movimientos.
// No se renderiza nada si hay 1 sola página (o 0), para no ensuciar la
// pantalla en catálogos chicos.
export default function Paginador({ page, totalPages, total, pageSize, onCambiarPagina }) {
  if (!totalPages || totalPages <= 1) return null

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-xs" style={{ color: '#9ca3af' }}>
      <span>Mostrando {desde}-{hasta} de {total}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onCambiarPagina(page - 1)}
          className="px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}
        >
          ← Anterior
        </button>
        <span className="px-2 text-white">Página {page} de {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onCambiarPagina(page + 1)}
          className="px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}