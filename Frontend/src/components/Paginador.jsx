// Controles de paginación compartidos por Productos, Stock, Movimientos y
// Comparación de precios. No se renderiza nada si hay 1 sola página (o 0),
// para no ensuciar la pantalla en catálogos chicos.
export default function Paginador({ page, totalPages, total, pageSize, onCambiarPagina }) {
  if (!totalPages || totalPages <= 1) return null

  // Al cambiar de página volvemos al principio de la LISTA: el botón está
  // al final de la tabla, así que sin esto el usuario quedaba mirando el
  // final de la página nueva. Se sube hasta la tarjeta marcada con
  // `data-lista` (y no hasta el tope de la pantalla) porque en Movimientos
  // y Productos arriba de la lista hay un formulario: subir al tope dejaba
  // al usuario mirando el formulario en vez de los resultados.
  const cambiarPagina = (nuevaPagina, e) => {
    onCambiarPagina(nuevaPagina)
    // Salto directo (no "smooth"): la página nueva suele tener otra cantidad
    // de filas, el documento cambia de alto mientras se anima el scroll y
    // el navegador cancela la animación a mitad de camino (se probó: la
    // última página, con menos filas, dejaba al usuario abajo de todo).
    const lista = e?.currentTarget?.closest('[data-lista]')
    if (lista) lista.scrollIntoView({ block: 'start' })
    else window.scrollTo({ top: 0 })
  }

  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-xs" style={{ color: '#9ca3af' }}>
      <span>Mostrando {desde}-{hasta} de {total}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={(e) => cambiarPagina(page - 1, e)}
          className="px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}
        >
          ← Anterior
        </button>
        <span className="px-2 text-white">Página {page} de {totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={(e) => cambiarPagina(page + 1, e)}
          className="px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}