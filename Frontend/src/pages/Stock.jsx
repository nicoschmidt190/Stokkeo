import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCategorias } from '../context/CategoriasContext'
import { useDebounce } from '../hooks/useDebounce'
import Paginador from '../components/Paginador'
import ThOrdenable from '../components/ThOrdenable'
import LoaderBloqueante from '../components/LoaderBloqueante'
import logo from '../assets/logo.png'

const PAGE_SIZE = 30

const ETIQUETAS_UNIDAD = {
  unidad: 'u',
  kg: 'kg',
  litros: 'L',
  gramos: 'gr',
  caja: 'cj',
  pack: 'pk',
}

const UNIDADES_DECIMALES = ['kg', 'litros']

function BadgeEstado({ estado }) {
  const estilos = {
    ok: { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', texto: 'OK' },
    bajo: { background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c', texto: 'Stock bajo' },
    sin_stock: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', texto: 'Sin stock' },
  }
  const s = estilos[estado] || estilos.ok

  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap inline-block"
      style={{ background: s.background, border: s.border, color: s.color }}>
      {s.texto}
    </span>
  )
}

export default function Stock() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { categorias, cargarCategorias } = useCategorias()

  const [stock, setStock] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 400)
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [orden, setOrden] = useState({ columna: 'nombre', direccion: 'asc' })

  const [page, setPage] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  // Solo la ÚLTIMA request puede escribir estado y apagar el loader: si el
  // usuario sigue tipeando/paginando y hay dos pedidos en vuelo, el primero
  // en volver ya no pisa los datos ni esconde el spinner antes de tiempo.
  const reqId = useRef(0)

  const cargarDatos = async () => {
    const miReq = ++reqId.current
    setCargando(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      if (busquedaDebounced.trim()) params.set('search', busquedaDebounced.trim())
      if (categoriaFiltro) params.set('id_categoria', categoriaFiltro)

      const resStock = await fetch(`${API_URL}/stock?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (miReq !== reqId.current) return
      if (resStock.ok) {
        const data = await resStock.json()
        if (miReq !== reqId.current) return
        setStock(Array.isArray(data.items) ? data.items : [])
        setTotalPaginas(data.total_pages || 1)
        setTotalItems(data.total || 0)
      } else {
        setError('No se pudo cargar el stock')
      }
    } catch {
      if (miReq === reqId.current) setError('Sin conexión al cargar el stock')
    } finally {
      if (miReq === reqId.current) setCargando(false)
    }
  }

  // Si cambia el buscador o la categoría estando en la página 5, volvemos a
  // la 1 SIN disparar antes una request inútil con "página 5 + filtro nuevo"
  // (antes salían dos pedidos y el primero apagaba el loader a medias).
  const filtrosPrev = useRef(`${busquedaDebounced}|${categoriaFiltro}`)
  useEffect(() => {
    const filtros = `${busquedaDebounced}|${categoriaFiltro}`
    if (filtrosPrev.current !== filtros) {
      filtrosPrev.current = filtros
      if (page !== 1) { setPage(1); return }
    }
    cargarDatos()
    cargarCategorias() // no dispara fetch si ya estaban cargadas por otro módulo
  }, [page, busquedaDebounced, categoriaFiltro])

  const handleLogout = () => { logout(); navigate('/login') }

  const formatearCantidad = (num, unidad) => {
    const esDecimal = UNIDADES_DECIMALES.includes(unidad)
    return Number(num).toLocaleString('es-AR', {
      minimumFractionDigits: esDecimal ? 2 : 0,
      maximumFractionDigits: esDecimal ? 2 : 0,
    })
  }

  // El filtro por nombre y categoría ya se resolvió en el backend (query
  // params de cargarDatos). Acá solo ordenamos la página actual.
  const stockOrdenado = [...stock].sort((a, b) => {
    let valorA = a[orden.columna]
    let valorB = b[orden.columna]

    if (orden.columna === 'categoria') {
      valorA = a.categoria?.nombre || ''
      valorB = b.categoria?.nombre || ''
    }

    if (orden.columna === 'cantidad' || orden.columna === 'stock_minimo') {
      valorA = Number(valorA || 0)
      valorB = Number(valorB || 0)
      return orden.direccion === 'asc' ? valorA - valorB : valorB - valorA
    }

    const strA = (valorA || '').toString().toLowerCase()
    const strB = (valorB || '').toString().toLowerCase()
    return orden.direccion === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
  })

  const handleCambiarOrden = (columna) => {
    setOrden((prev) => ({
      columna,
      direccion: prev.columna === columna && prev.direccion === 'asc' ? 'desc' : 'asc',
    }))
  }


  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src={logo} alt="Stokkeo" className="h-12" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ color: '#9ca3af' }}>
            Dashboard
          </button>
          <button onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-4xl mx-auto relative">
        <LoaderBloqueante visible={cargando} />

        <h2 className="text-xl font-semibold text-white mb-4">Stock</h2>

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <div data-lista className="scroll-mt-4 rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-medium text-white">Listado de Stock</h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', width: '220px' }}
              />
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <option value="">Todas las categorías</option>
                {categorias.map((cat) => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ color: '#d1d5db' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                  <ThOrdenable columna="nombre" orden={orden} onCambiarOrden={handleCambiarOrden}>Producto</ThOrdenable>
                  <ThOrdenable columna="categoria" orden={orden} onCambiarOrden={handleCambiarOrden}>Categoría</ThOrdenable>
                  <ThOrdenable columna="cantidad" orden={orden} onCambiarOrden={handleCambiarOrden}>Cantidad</ThOrdenable>
                  <ThOrdenable columna="stock_minimo" orden={orden} onCambiarOrden={handleCambiarOrden}>Mínimo</ThOrdenable>
                  <ThOrdenable columna="estado" orden={orden} onCambiarOrden={handleCambiarOrden} className="min-w-[120px]">Estado</ThOrdenable>
                </tr>
              </thead>
              <tbody>
                {stockOrdenado.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-xs" style={{ color: '#6b7280' }}>
                      {totalItems === 0 ? 'No hay productos con stock registrado.' : 'No se encontraron productos que coincidan.'}
                    </td>
                  </tr>
                ) : (
                  stockOrdenado.map((s, i) => (
                    <tr key={s.id_producto}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      }}>
                      <td className="py-3 px-3 font-medium text-white">{s.nombre}</td>
                      <td className="py-3 px-3">{s.categoria?.nombre || '-'}</td>
                      <td className="py-3 px-3 font-mono">
                        {formatearCantidad(s.cantidad, s.unidad_medida)} {ETIQUETAS_UNIDAD[s.unidad_medida] || s.unidad_medida}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {formatearCantidad(s.stock_minimo, s.unidad_medida)} {ETIQUETAS_UNIDAD[s.unidad_medida] || s.unidad_medida}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap"><BadgeEstado estado={s.estado} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Paginador page={page} totalPages={totalPaginas} total={totalItems} pageSize={PAGE_SIZE} onCambiarPagina={setPage} />
        </div>
      </main>
    </div>
  )
}