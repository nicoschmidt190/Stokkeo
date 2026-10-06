import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Alerta from '../components/Alerta'
import logo from '../assets/logo.png'

const INTERVALO_POLLING_MS = 3000

export default function ComparacionPrecios() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const [comparacion, setComparacion] = useState({ nunca_ejecutado: true, items: [] })
  const [cargandoDatos, setCargandoDatos] = useState(true)

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

  const cargarComparacion = async () => {
    try {
      const res = await fetch(`${API_URL}/precios-competidor/comparacion`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setComparacion(data)
      }
    } catch (err) {
      console.error('Error al cargar comparación de precios:', err)
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
      setCargandoDatos(true)
      await cargarComparacion()
      const data = await consultarEstado()
      if (data?.en_progreso) {
        setActualizando(true)
        iniciarPolling()
      }
      setCargandoDatos(false)
    }
    inicializar()

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current)
    }
  }, [])

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
          <span className="text-sm hidden sm:inline" style={{ color: '#6b7280' }}>{usuario?.email}</span>
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
        {cargandoDatos && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(2px)' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(0,198,255,0.3)', borderTopColor: '#00c6ff' }} />
          </div>
        )}

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

        <div className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-lg font-medium text-white mb-1">Productos convenientes en La Anónima</h3>
          <p className="text-xs mb-6" style={{ color: '#6b7280' }}>
            Productos con al menos un 20% de diferencia a favor del supermercado.
          </p>

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
                No hay productos con una diferencia de precio significativa (≥20%) por ahora.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ color: '#d1d5db' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                    <th className="py-2.5 px-3 font-medium">Producto</th>
                    <th className="py-2.5 px-3 font-medium">Precio Negocio</th>
                    <th className="py-2.5 px-3 font-medium">Precio Supermercado</th>
                    <th className="py-2.5 px-3 font-medium">Supermercado</th>
                    <th className="py-2.5 px-3 font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacion.items.map((item, i) => (
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
            </div>
          )}
        </div>
      </main>
    </div>
  )
}