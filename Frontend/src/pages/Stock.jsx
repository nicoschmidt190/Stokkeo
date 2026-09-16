import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

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
    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ background: s.background, border: s.border, color: s.color }}>
      {s.texto}
    </span>
  )
}

export default function Stock() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [stock, setStock] = useState([])
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [orden, setOrden] = useState({ columna: 'nombre', direccion: 'asc' })

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const [resStock, resCat] = await Promise.all([
        fetch(`${API_URL}/stock`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_URL}/categorias`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ])
      if (resStock.ok) setStock(await resStock.json())
      else setError('No se pudo cargar el stock')

      if (resCat.ok) setCategorias(await resCat.json())
    } catch {
      setError('Sin conexión al cargar el stock')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const formatearCantidad = (num, unidad) => {
    const esDecimal = UNIDADES_DECIMALES.includes(unidad)
    return Number(num).toLocaleString('es-AR', {
      minimumFractionDigits: esDecimal ? 2 : 0,
      maximumFractionDigits: esDecimal ? 2 : 0,
    })
  }

  // --- Filtrado por nombre (desde 3 caracteres) y categoría ---
  const stockFiltrado = stock.filter((s) => {
    const textoLimpio = busqueda.trim().toLowerCase()
    const cumpleBusqueda = textoLimpio.length >= 3 ? s.nombre.toLowerCase().includes(textoLimpio) : true
    const cumpleCategoria = categoriaFiltro ? s.categoria?.id_categoria === parseInt(categoriaFiltro) : true
    return cumpleBusqueda && cumpleCategoria
  })

  // --- Orden por columna, ascendente/descendente ---
  const stockOrdenado = [...stockFiltrado].sort((a, b) => {
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

  const renderIconoOrden = (columna) => {
    if (orden.columna !== columna) return <span className="text-gray-600 text-[10px] ml-1">⇅</span>
    return <span className="text-cyan-400 text-xs ml-1 font-bold">{orden.direccion === 'asc' ? '↑' : '↓'}</span>
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
        {/* Loader bloqueante mientras carga */}
        {cargando && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(2px)' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(0,198,255,0.3)', borderTopColor: '#00c6ff' }} />
          </div>
        )}

        <h2 className="text-xl font-semibold text-white mb-4">Stock</h2>

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <div className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-medium text-white">Listado de Stock</h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Buscar por nombre (mín. 3 letras)..."
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
                  <th onClick={() => handleCambiarOrden('nombre')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Producto {renderIconoOrden('nombre')}
                  </th>
                  <th onClick={() => handleCambiarOrden('categoria')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Categoría {renderIconoOrden('categoria')}
                  </th>
                  <th onClick={() => handleCambiarOrden('cantidad')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Cantidad {renderIconoOrden('cantidad')}
                  </th>
                  <th onClick={() => handleCambiarOrden('stock_minimo')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Mínimo {renderIconoOrden('stock_minimo')}
                  </th>
                  <th onClick={() => handleCambiarOrden('estado')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Estado {renderIconoOrden('estado')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stockOrdenado.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-xs" style={{ color: '#6b7280' }}>
                      {stock.length === 0 ? 'No hay productos con stock registrado.' : 'No se encontraron productos que coincidan.'}
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
                      <td className="py-3 px-3"><BadgeEstado estado={s.estado} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}