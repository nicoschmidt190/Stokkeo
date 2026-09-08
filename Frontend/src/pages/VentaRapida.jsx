import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function VentaRapida() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const inputBusquedaRef = useRef(null)

  const [vista, setVista] = useState('buscar') // 'buscar' | 'categorias'

  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)

  const [busqueda, setBusqueda] = useState('')
  const [procesandoId, setProcesandoId] = useState(null)
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0) // producto activo (buscar o dentro de categoría)
  const [indiceCategoria, setIndiceCategoria] = useState(0) // categoría activa en la grilla

  const [notificacion, setNotificacion] = useState(null)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarDatos = async () => {
    try {
      const [resProd, resCat] = await Promise.all([
        fetch(`${API_URL}/productos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_URL}/categorias`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ])
      if (resProd.ok) {
        const data = await resProd.json()
        if (Array.isArray(data)) setProductos(data)
      }
      if (resCat.ok) {
        const data = await resCat.json()
        if (Array.isArray(data)) setCategorias(data)
      }
    } catch (err) {
      console.error('Error al cargar catálogo:', err)
    }
  }

  useEffect(() => {
    cargarDatos()
    if (inputBusquedaRef.current) inputBusquedaRef.current.focus()
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const cambiarVista = (nueva) => {
    setVista(nueva)
    setNotificacion(null)
    setCategoriaActiva(null)
    setBusqueda('')
    setIndiceCategoria(0)
  }

  // --- Lógica de la pestaña "Buscar" ---
  const textoLimpio = busqueda.trim().toLowerCase()
  const productosFiltrados = textoLimpio.length >= 3
    ? productos.filter((p) => p.nombre.toLowerCase().includes(textoLimpio))
    : []

  useEffect(() => { setIndiceSeleccionado(0) }, [busqueda])

  const handleKeyDownBuscar = (e) => {
    if (productosFiltrados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceSeleccionado((prev) => (prev + 1) % productosFiltrados.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceSeleccionado((prev) => (prev - 1 + productosFiltrados.length) % productosFiltrados.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = productosFiltrados[indiceSeleccionado]
      if (item) handleDescontarStock(item)
    } else if (e.key === 'Escape') {
      setBusqueda('')
      setNotificacion(null)
    }
  }

  // --- Lógica de la pestaña "Categorías" ---
  const productosDeCategoria = categoriaActiva
    ? productos.filter((p) => p.id_categoria === categoriaActiva.id_categoria)
    : []

  useEffect(() => { setIndiceSeleccionado(0) }, [categoriaActiva])

  // Navegación por teclado a nivel ventana, solo activa en la pestaña "Categorías"
  // (acá no hay un input enfocado como en "Buscar", así que escuchamos el keydown global)
  useEffect(() => {
    if (vista !== 'categorias') return

    const handler = (e) => {
      if (!categoriaActiva) {
        if (categorias.length === 0) return
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setIndiceCategoria((prev) => (prev + 1) % categorias.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setIndiceCategoria((prev) => (prev - 1 + categorias.length) % categorias.length)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const cat = categorias[indiceCategoria]
          if (cat) setCategoriaActiva(cat)
        }
      } else {
        if (e.key === 'Escape') {
          e.preventDefault()
          setCategoriaActiva(null)
          return
        }
        if (productosDeCategoria.length === 0) return
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setIndiceSeleccionado((prev) => (prev + 1) % productosDeCategoria.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setIndiceSeleccionado((prev) => (prev - 1 + productosDeCategoria.length) % productosDeCategoria.length)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const item = productosDeCategoria[indiceSeleccionado]
          if (item) handleDescontarStock(item)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [vista, categoriaActiva, categorias, productosDeCategoria, indiceCategoria, indiceSeleccionado])

  // --- Acción compartida: descontar 1 unidad (misma para ambas pestañas) ---
  const handleDescontarStock = async (prod) => {
    if (!prod) return
    const stockActual = prod.stock?.cantidad ?? 0

    if (stockActual <= 0) {
      setNotificacion({ tipo: 'error', mensaje: `Sin stock disponible para este producto: "${prod.nombre}"` })
      return
    }

    setProcesandoId(prod.id_producto)
    setNotificacion(null)

    try {
      const res = await fetch(`${API_URL}/movimientos/venta-rapida`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id_producto: prod.id_producto, origen: 'Manual' }),
      })

      const data = await res.json()

      if (!res.ok) {
        setNotificacion({ tipo: 'error', mensaje: data.detail || 'Error al procesar la salida' })
        return
      }

      setProductos((prev) =>
        prev.map((p) =>
          p.id_producto === prod.id_producto
            ? { ...p, stock: { ...p.stock, cantidad: data.stock_restante } }
            : p
        )
      )

      if (data.stock_restante === 0 || data.estado === 'sin_stock') {
        setNotificacion({ tipo: 'error', mensaje: `Sin stock disponible para "${prod.nombre}" (Quedan 0 unidades)` })
      } else if (data.estado === 'minimo_alcanzado') {
        setNotificacion({ tipo: 'minimo', mensaje: `${prod.nombre}: Stock mínimo alcanzado - Quedan ${data.stock_restante} unidades` })
      } else {
        setNotificacion({ tipo: 'ok', mensaje: `${prod.nombre} vendido - Stock restante: ${data.stock_restante}` })
      }

      if (vista === 'buscar') {
        setBusqueda('')
        if (inputBusquedaRef.current) inputBusquedaRef.current.focus()
      }
    } catch (err) {
      console.error(err)
      setNotificacion({ tipo: 'error', mensaje: 'Error de conexión al procesar el descuento.' })
    } finally {
      setProcesandoId(null)
    }
  }

  const renderCardProducto = (p, idx, resaltar, mostrarCategoria) => {
    const stock = p.stock?.cantidad ?? 0
    const sinStock = stock <= 0
    const stockBajo = stock > 0 && stock <= p.stock_minimo
    const estaActivo = resaltar && idx === indiceSeleccionado

    return (
      <button
        key={p.id_producto}
        disabled={procesandoId === p.id_producto || sinStock}
        onClick={() => handleDescontarStock(p)}
        onMouseEnter={() => resaltar && setIndiceSeleccionado(idx)}
        className="flex items-center justify-between p-4 rounded-xl text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: estaActivo ? 'rgba(0, 198, 255, 0.08)' : 'rgba(255,255,255,0.04)',
          border: estaActivo ? '1px solid #00c6ff' : sinStock ? '1px solid rgba(239, 68, 68, 0.25)' : stockBajo ? '1px solid rgba(249, 115, 22, 0.25)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: estaActivo ? '0 0 15px rgba(0, 198, 255, 0.15)' : 'none',
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            {estaActivo && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-bold">↵ Enter</span>
            )}
            <h4 className="text-white font-medium text-sm leading-snug">{p.nombre}</h4>
          </div>
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
            Mínimo: {p.stock_minimo}{mostrarCategoria ? ` | ${p.categoria?.nombre || 'General'}` : ''}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs px-2.5 py-1 rounded-full font-bold inline-block"
            style={{
              background: sinStock ? 'rgba(239,68,68,0.1)' : stockBajo ? 'rgba(249,115,22,0.1)' : 'rgba(16,185,129,0.1)',
              color: sinStock ? '#f87171' : stockBajo ? '#fb923c' : '#34d399',
            }}>
            {sinStock ? 'Sin Stock' : `${stock} disp.`}
          </span>
          <span className="block text-[11px] mt-1" style={{ color: '#9ca3af' }}>
            {sinStock ? 'Bloqueado' : 'Resta 1'}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src={logo} alt="Stokkeo" className="h-16" />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm hidden sm:inline" style={{ color: '#6b7280' }}>{usuario?.email}</span>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ color: '#9ca3af' }}>
            Dashboard
          </button>
          <button onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-white mb-2">Venta Rápida</h2>

        <div className="flex gap-2 mb-6">
          <button onClick={() => cambiarVista('buscar')}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              background: vista === 'buscar' ? 'rgba(0,198,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: vista === 'buscar' ? '1px solid rgba(0,198,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: vista === 'buscar' ? '#00c6ff' : '#9ca3af',
            }}>
            Buscar
          </button>
          <button onClick={() => cambiarVista('categorias')}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              background: vista === 'categorias' ? 'rgba(0,198,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: vista === 'categorias' ? '1px solid rgba(0,198,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: vista === 'categorias' ? '#00c6ff' : '#9ca3af',
            }}>
            Categorías
          </button>
        </div>

        {notificacion && (
          <div className="mb-6 p-4 rounded-xl text-sm font-medium flex items-center justify-between transition-all"
            style={{
              background: notificacion.tipo === 'ok' ? 'rgba(16, 185, 129, 0.12)' : notificacion.tipo === 'minimo' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: notificacion.tipo === 'ok' ? '1px solid rgba(16, 185, 129, 0.3)' : notificacion.tipo === 'minimo' ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
              color: notificacion.tipo === 'ok' ? '#34d399' : notificacion.tipo === 'minimo' ? '#fb923c' : '#f87171',
            }}>
            <span>
              {notificacion.tipo === 'ok' && '✓ '}
              {notificacion.tipo === 'minimo' && '⚠️ '}
              {notificacion.tipo === 'error' && '✕ '}
              {notificacion.mensaje}
            </span>
            <button onClick={() => setNotificacion(null)} className="text-xs hover:opacity-75 ml-4 font-semibold">Cerrar</button>
          </div>
        )}

        {vista === 'buscar' && (
          <>
            <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
              Buscá un producto. Navegá con <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↓</kbd> y presioná <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Enter</kbd> para descontar.
            </p>

            <div className="mb-6">
              <input
                ref={inputBusquedaRef}
                type="text"
                placeholder="Escribí el nombre del producto (mínimo 3 letras)..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={handleKeyDownBuscar}
                className="w-full px-4 py-3.5 rounded-xl text-base text-white focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0, 198, 255, 0.35)' }}
              />
            </div>

            {textoLimpio.length > 0 && textoLimpio.length < 3 && (
              <p className="text-center py-8 text-xs" style={{ color: '#6b7280' }}>
                Ingresá al menos 3 caracteres para ver coincidencias...
              </p>
            )}

            {textoLimpio.length >= 3 && productosFiltrados.length === 0 && (
              <div className="text-center py-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <p className="text-sm" style={{ color: '#9ca3af' }}>No se encontraron productos con el nombre "{busqueda}"</p>
              </div>
            )}

            {productosFiltrados.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosFiltrados.map((p, idx) => renderCardProducto(p, idx, true, true))}
              </div>
            )}
          </>
        )}

        {vista === 'categorias' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              {categoriaActiva && (
                <button onClick={() => setCategoriaActiva(null)}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                  ← Categorías
                </button>
              )}
              <p className="text-sm" style={{ color: '#6b7280' }}>
                {categoriaActiva
                  ? <>Productos en "{categoriaActiva.nombre}". Navegá con <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↓</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Enter</kbd> descuenta, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Esc</kbd> vuelve.</>
                  : <>Tocá una categoría, o navegá con <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↓</kbd> y <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Enter</kbd>.</>}
              </p>
            </div>

            {!categoriaActiva && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {categorias.length === 0 ? (
                  <p className="text-xs col-span-full text-center py-8" style={{ color: '#6b7280' }}>No hay categorías registradas.</p>
                ) : (
                  categorias.map((cat, idx) => {
                    const estaActivo = idx === indiceCategoria
                    return (
                      <button key={cat.id_categoria}
                        onClick={() => setCategoriaActiva(cat)}
                        onMouseEnter={() => setIndiceCategoria(idx)}
                        className="p-6 rounded-xl text-left transition-all duration-150 hover:scale-105"
                        style={{
                          background: estaActivo ? 'rgba(0, 198, 255, 0.08)' : 'rgba(255,255,255,0.04)',
                          border: estaActivo ? '1px solid #00c6ff' : '1px solid rgba(255,255,255,0.08)',
                          boxShadow: estaActivo ? '0 0 15px rgba(0, 198, 255, 0.15)' : 'none',
                        }}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg"
                            style={{ background: 'linear-gradient(135deg, #00c6ff22, #39ff1422)', border: '1px solid rgba(57,255,20,0.2)' }} />
                          {estaActivo && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-bold">↵ Enter</span>
                          )}
                        </div>
                        <h3 className="text-white font-medium">{cat.nombre}</h3>
                        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                          {productos.filter((p) => p.id_categoria === cat.id_categoria).length} productos
                        </p>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            {categoriaActiva && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {productosDeCategoria.length === 0 ? (
                  <p className="text-xs col-span-full text-center py-8" style={{ color: '#6b7280' }}>No hay productos en esta categoría.</p>
                ) : (
                  productosDeCategoria.map((p, idx) => renderCardProducto(p, idx, true, false))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}