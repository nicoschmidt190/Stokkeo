import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Alerta from '../components/Alerta'
import Paginador from '../components/Paginador'
import LoaderBloqueante from '../components/LoaderBloqueante'
import ThOrdenable from '../components/ThOrdenable'
import { useDebounce } from '../hooks/useDebounce'
import logo from '../assets/logo.png'

const INTERVALO_POLLING_MS = 3000
const PAGE_SIZE = 30
// Se trae TODO el listado filtrado de una vez (son solo los productos con
// >=20% de diferencia, un subconjunto del catálogo) y se ordena y pagina en
// el navegador: así ordenar una columna es instantáneo, igual que en
// Productos/Stock/Movimientos, y aun así ordena TODAS las páginas.
const FETCH_PAGE_SIZE = 5000

export default function ComparacionPrecios() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const [comparacion, setComparacion] = useState({ nunca_ejecutado: true, items: [] })
  const [cargandoDatos, setCargandoDatos] = useState(true)
  const [page, setPage] = useState(1)

  // El filtro por nombre se resuelve en el backend (con debounce, como en
  // los otros módulos). El orden y la paginación son locales (ver arriba).
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 400)
  const [orden, setOrden] = useState({ columna: 'diferencia_porcentual', direccion: 'desc' })

  const [estado, setEstado] = useState(null) // { en_progreso, ultima_actualizacion, mensaje, supermercados_ok, supermercados_fallidos }
  const [actualizando, setActualizando] = useState(false)

  const [notificacion, setNotificacion] = useState(null)
  const mostrarAlerta = (tipo, mensaje) => setNotificacion({ tipo, mensaje })

  useEffect(() => {
    if (!notificacion) return
    const t = setTimeout(() => setNotificacion(null), 4000)
    return () => clearTimeout(t)
  }, [notificacion])

  const intervaloRef = useRef(null)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  // Solo la ÚLTIMA request puede escribir estado y apagar el loader.
  const reqId = useRef(0)

  // Último texto de búsqueda en un ref: el polling del scraping (más abajo)
  // llama a cargarComparacion desde una función creada en el primer render;
  // sin esto recargaría con el buscador de ESE momento y no con el que el
  // usuario tiene puesto ahora.
  const busquedaRef = useRef('')
  busquedaRef.current = busquedaDebounced.trim()

  const cargarComparacion = async () => {
    const miReq = ++reqId.current
    setCargandoDatos(true)
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(FETCH_PAGE_SIZE) })
      if (busquedaRef.current) params.set('search', busquedaRef.current)
      const res = await fetch(`${API_URL}/precios-competidor/comparacion?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (miReq !== reqId.current) return
      if (res.ok) {
        const data = await res.json()
        if (miReq !== reqId.current) return
        setComparacion(data)
      }
    } catch (err) {
      console.error('Error al cargar comparación de precios:', err)
    } finally {
      if (miReq === reqId.current) setCargandoDatos(false)
    }
  }

  const consultarEstado = async () => {
    try {
      const res = await fetch(`${API_URL}/precios-competidor/estado`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setEstado(data)
        return data
      }
    } catch (err) {
      console.error('Error al consultar estado del scraping:', err)
    }
    return null
  }

  // Sondea /estado cada pocos segundos mientras haya un scraping en curso,
  // y se detiene solo cuando termina (sea por éxito, error, o por venir
  // ya en curso desde el job automático de las 3 AM del backend).
  const iniciarPolling = () => {
    if (intervaloRef.current) return
    intervaloRef.current = setInterval(async () => {
      const data = await consultarEstado()
      if (data && !data.en_progreso) {
        clearInterval(intervaloRef.current)
        intervaloRef.current = null
        setActualizando(false)
        setPage(1)
        cargarComparacion()
        if (data.supermercados_fallidos?.length > 0 && data.supermercados_ok?.length === 0) {
          mostrarAlerta('error', data.mensaje || 'No se pudo actualizar los precios')
        } else if (data.supermercados_fallidos?.length > 0) {
          mostrarAlerta('advertencia', data.mensaje || 'Actualización parcial')
        } else {
          mostrarAlerta('ok', data.mensaje || 'Precios actualizados correctamente')
        }
      }
    }, INTERVALO_POLLING_MS)
  }

  useEffect(() => {
    const inicializar = async () => {
      await cargarComparacion()
      const data = await consultarEstado()
      if (data?.en_progreso) {
        setActualizando(true)
        iniciarPolling()
      }
    }
    inicializar()

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
    }
  }, [])

  // Al cambiar la búsqueda (ya con debounce) se vuelve a pedir el listado al
  // backend y se vuelve a la página 1. La primera carga la hace `inicializar`
  // (junto con el estado del scraping).
  // Se compara contra el valor anterior (y no con un "primer render") para
  // que no se dispare una request de más cuando React, en desarrollo,
  // ejecuta los efectos dos veces al montar.
  const busquedaPrev = useRef(busquedaDebounced)
  useEffect(() => {
    if (busquedaPrev.current === busquedaDebounced) return
    busquedaPrev.current = busquedaDebounced
    setPage(1)
    cargarComparacion()
  }, [busquedaDebounced])

  // Ordenar es instantáneo: se hace acá, sobre el listado completo ya
  // cargado. Desempate por id_producto para que el orden sea estable.
  const handleCambiarOrden = (columna) => {
    setOrden((prev) => ({
      columna,
      direccion: prev.columna === columna && prev.direccion === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  const itemsOrdenados = useMemo(() => {
    const dir = orden.direccion === 'asc' ? 1 : -1
    const esTexto = orden.columna === 'nombre_producto' || orden.columna === 'supermercado'
    return [...comparacion.items].sort((a, b) => {
      const va = a[orden.columna]
      const vb = b[orden.columna]
      const cmp = esTexto
        ? String(va ?? '').localeCompare(String(vb ?? ''), 'es', { sensitivity: 'base' })
        : Number(va ?? 0) - Number(vb ?? 0)
      return cmp * dir || a.id_producto - b.id_producto
    })
  }, [comparacion.items, orden])

  const totalItems = itemsOrdenados.length
  const totalPaginas = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  // Si el listado se achica (ej. se actualizaron los precios) y la página
  // actual ya no existe, mostramos la última.
  const paginaActual = Math.min(page, totalPaginas)
  const itemsPagina = itemsOrdenados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)

  const handleLogout = () => { logout(); navigate('/login') }

  const handleActualizarPrecios = async () => {
    setActualizando(true)
    try {
      const res = await fetch(`${API_URL}/precios-competidor/actualizar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()

      if (!data.iniciado) {
        // Ya había uno en curso, o no hay internet — no arrancó nada nuevo
        setActualizando(data.mensaje?.includes('en curso') || false)
        mostrarAlerta('advertencia', data.mensaje)
        if (data.mensaje?.includes('en curso')) iniciarPolling()
        return
      }

      iniciarPolling()
    } catch (err) {
      console.error(err)
      setActualizando(false)
      mostrarAlerta('error', 'Sin conexión al intentar iniciar la actualización.')
    }
  }

  const formatearFecha = (iso) => {
    if (!iso) return null
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <Alerta tipo={notificacion?.tipo} mensaje={notificacion?.mensaje} onCerrar={() => setNotificacion(null)} />

      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src={logo} alt="Stokkeo" className="h-12" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors" style={{ color: '#9ca3af' }}>
            Dashboard
          </button>
          <button onClick={handleLogout} className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-4xl mx-auto relative">
        <LoaderBloqueante visible={cargandoDatos} />

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-white">Comparación de Precios</h2>
          <button
            onClick={handleActualizarPrecios}
            disabled={actualizando}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:cursor-not-allowed"
            style={{
              background: actualizando ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #00c6ff, #39ff14)',
              color: actualizando ? '#9ca3af' : '#0a0a0f',
            }}
          >
            {actualizando && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(156,163,175,0.4)', borderTopColor: '#9ca3af' }} />
            )}
            {actualizando ? 'Actualizando...' : 'Actualizar precios'}
          </button>
        </div>

        {/* Estado del proceso / última actualización */}
        <div className="mb-6 text-xs" style={{ color: '#6b7280' }}>
          {actualizando ? (
            <span style={{ color: '#00c6ff' }}>⏳ Actualización en curso — esto puede tardar unos minutos...</span>
          ) : estado?.ultima_actualizacion ? (
            <span>Última actualización: {formatearFecha(estado.ultima_actualizacion)}</span>
          ) : (
            <span>Todavía no se actualizaron los precios.</span>
          )}
        </div>

        <div data-lista className="scroll-mt-4 rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Productos convenientes en La Anónima</h3>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                Productos con al menos un 20% de diferencia a favor del supermercado.
              </p>
            </div>
            {!comparacion.nunca_ejecutado && (
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', width: '220px' }}
              />
            )}
          </div>

          {comparacion.nunca_ejecutado ? (
            <div className="text-center py-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-sm" style={{ color: '#9ca3af' }}>
                Todavía no se ejecutó ninguna actualización de precios.
              </p>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                Tocá "Actualizar precios" para comparar contra La Anónima.
              </p>
            </div>
          ) : comparacion.items.length === 0 ? (
            <div className="text-center py-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-sm" style={{ color: '#9ca3af' }}>
                {busquedaDebounced.trim()
                  ? 'No se encontraron productos que coincidan con la búsqueda.'
                  : 'No hay productos con una diferencia de precio significativa (≥20%) por ahora.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ color: '#d1d5db' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                    <ThOrdenable columna="nombre_producto" orden={orden} onCambiarOrden={handleCambiarOrden}>Producto</ThOrdenable>
                    <ThOrdenable columna="precio_negocio" orden={orden} onCambiarOrden={handleCambiarOrden}>Precio Negocio</ThOrdenable>
                    <ThOrdenable columna="precio_supermercado" orden={orden} onCambiarOrden={handleCambiarOrden}>Precio Supermercado</ThOrdenable>
                    <ThOrdenable columna="supermercado" orden={orden} onCambiarOrden={handleCambiarOrden}>Supermercado</ThOrdenable>
                    <ThOrdenable columna="diferencia_porcentual" orden={orden} onCambiarOrden={handleCambiarOrden}>Diferencia</ThOrdenable>
                  </tr>
                </thead>
                <tbody>
                  {itemsPagina.map((item, i) => (
                    <tr key={item.id_producto}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                      }}>
                      <td className="py-3 px-3 font-medium text-white">{item.nombre_producto}</td>
                      <td className="py-3 px-3 font-mono">
                        ${item.precio_negocio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        ${item.precio_supermercado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-xs" style={{ color: '#9ca3af' }}>{item.supermercado}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold inline-block"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                          -{item.diferencia_porcentual.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Paginador page={paginaActual} totalPages={totalPaginas} total={totalItems} pageSize={PAGE_SIZE} onCambiarPagina={setPage} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}