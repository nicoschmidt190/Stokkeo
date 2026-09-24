import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCategorias } from '../context/CategoriasContext'
import logo from '../assets/logo.png'

const UMBRAL_ESCANER_MS = 50

export default function VentaRapida() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const { categorias, cargarCategorias } = useCategorias()
  const inputBusquedaRef = useRef(null)

  const [vista, setVista] = useState('buscar') // 'buscar' | 'categorias'

  const [productos, setProductos] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
const [cargandoDatos, setCargandoDatos] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [procesandoId, setProcesandoId] = useState(null)
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0)
  const [indiceCategoria, setIndiceCategoria] = useState(0)

  const [notificacion, setNotificacion] = useState(null)

  const bufferEscanerRef = useRef('')
  const ultimoTiempoRef = useRef(0)
  const inicioBufferRef = useRef(0)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarDatos = async () => {
    setCargandoDatos(true)
    try {
      // page_size=5000: esta pantalla necesita el catálogo completo en
      // memoria para poder buscar al vuelo mientras se escanea, como una
      // caja registradora — no tiene sentido paginarla acá.
      const resProd = await fetch(`${API_URL}/productos?page_size=5000`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (resProd.ok) {
        const data = await resProd.json()
        if (Array.isArray(data.items)) setProductos(data.items)
      }
    } catch (err) {
      console.error('Error al cargar catálogo:', err)
    } finally {
      setCargandoDatos(false)
    }
  }

  useEffect(() => {
    cargarDatos()
    cargarCategorias() // no dispara fetch si ya estaban cargadas por otro módulo
    if (inputBusquedaRef.current) inputBusquedaRef.current.focus()
  }, [])

  // Auto-cierre del mensaje flotante — excepto "no_encontrado", que tiene
  // un botón de acción y necesita que el usuario decida qué hacer
  useEffect(() => {
    if (!notificacion || notificacion.tipo === 'no_encontrado') return
    const timer = setTimeout(() => setNotificacion(null), 4000)
    return () => clearTimeout(timer)
  }, [notificacion])

  const handleLogout = () => { logout(); navigate('/login') }

  const cambiarVista = (nueva) => {
    setVista(nueva)
    setNotificacion(null)
    setCategoriaActiva(null)
    setBusqueda('')
    setIndiceCategoria(0)
  }

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
      if (item) handleDescontarStock(item, 'Manual')
    } else if (e.key === 'Escape') {
      setBusqueda('')
      setNotificacion(null)
    }
  }

  const productosDeCategoria = categoriaActiva
    ? productos.filter((p) => p.id_categoria === categoriaActiva.id_categoria)
    : []

  useEffect(() => { setIndiceSeleccionado(0) }, [categoriaActiva])

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
          if (item) handleDescontarStock(item, 'Manual')
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [vista, categoriaActiva, categorias, productosDeCategoria, indiceCategoria, indiceSeleccionado])

  useEffect(() => {
    const handleKeyDownEscaner = (e) => {
      const ahora = Date.now()

      if (e.key === 'Enter') {
        const codigo = bufferEscanerRef.current.trim()
        const duracion = ahora - inicioBufferRef.current
        const pareceEscaneo = codigo.length >= 4 && duracion < codigo.length * UMBRAL_ESCANER_MS * 2
        bufferEscanerRef.current = ''

        if (pareceEscaneo) {
          e.preventDefault()
          e.stopPropagation()
          procesarCodigoEscaneado(codigo)
        }
        return
      }

      if (e.key.length === 1) {
        if (ahora - ultimoTiempoRef.current > UMBRAL_ESCANER_MS) {
          bufferEscanerRef.current = e.key
          inicioBufferRef.current = ahora
        } else {
          bufferEscanerRef.current += e.key
        }
        ultimoTiempoRef.current = ahora
      } else if (e.key !== 'Shift') {
        bufferEscanerRef.current = ''
      }
    }

    window.addEventListener('keydown', handleKeyDownEscaner, true)
    return () => window.removeEventListener('keydown', handleKeyDownEscaner, true)
  }, [productos])

  const limpiarCodigo = (str) => (str || '').replace(/[^\x20-\x7E]/g, '').trim()

  const procesarCodigoEscaneado = (codigoCrudo) => {
    const codigo = limpiarCodigo(codigoCrudo)
    const producto = productos.find((p) => limpiarCodigo(p.codigo_barras) === codigo)

    if (!producto) {
      setNotificacion({
        tipo: 'no_encontrado',
        mensaje: `El código "${codigo}" no está registrado en el catálogo.`,
        codigo,
      })
      return
    }

    handleDescontarStock(producto, 'Scanner')
  }

  const handleDescontarStock = async (prod, origen = 'Manual') => {
    if (!prod) return
    const stockActual = prod.stock?.cantidad ?? 0

    if (stockActual <= 0) {
      setNotificacion({ tipo: 'error', mensaje: `Sin stock disponible para este producto: "${prod.nombre}"` })
      if (vista === 'buscar') {
        setBusqueda('')
        if (inputBusquedaRef.current) inputBusquedaRef.current.focus()
      }
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
        body: JSON.stringify({ id_producto: prod.id_producto, origen }),
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

  const irAAgregarProducto = (codigo) => {
    navigate('/productos', { state: { codigoBarrasPendiente: codigo } })
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
        onClick={() => handleDescontarStock(p, 'Manual')}
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
      {/* Mensaje flotante fijo arriba de la pantalla, por encima de todo */}
      {notificacion && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
          <div className="p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-lg"
            style={{
              background: notificacion.tipo === 'ok' ? '#0f2e22'
                : notificacion.tipo === 'minimo' ? '#3a2410'
                : notificacion.tipo === 'no_encontrado' ? '#1a1a22'
                : '#3a1414',
              border: notificacion.tipo === 'ok' ? '1px solid rgba(16, 185, 129, 0.4)'
                : notificacion.tipo === 'minimo' ? '1px solid rgba(249, 115, 22, 0.45)'
                : notificacion.tipo === 'no_encontrado' ? '1px solid rgba(255,255,255,0.2)'
                : '1px solid rgba(239, 68, 68, 0.45)',
              color: notificacion.tipo === 'ok' ? '#34d399'
                : notificacion.tipo === 'minimo' ? '#fb923c'
                : notificacion.tipo === 'no_encontrado' ? '#d1d5db'
                : '#f87171',
            }}>
            <span>
              {notificacion.tipo === 'ok' && '✓ '}
              {notificacion.tipo === 'minimo' && '⚠️ '}
              {notificacion.tipo === 'error' && '✕ '}
              {notificacion.tipo === 'no_encontrado' && '❓ '}
              {notificacion.mensaje}
            </span>
            <div className="flex items-center gap-3 ml-4">
              {notificacion.tipo === 'no_encontrado' && (
                <button onClick={() => irAAgregarProducto(notificacion.codigo)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(0,198,255,0.15)', border: '1px solid rgba(0,198,255,0.4)', color: '#00c6ff' }}>
                  Agregar producto
                </button>
              )}
              <button onClick={() => setNotificacion(null)} className="text-xs hover:opacity-75 font-semibold">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src={logo} alt="Stokkeo" className="h-12" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ color: '#9ca3af' }}>
            Dashboard
          </button>
          <button onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-4xl mx-auto">
        {cargandoDatos && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
             style={{ background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(2px)' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(0,198,255,0.3)', borderTopColor: '#00c6ff' }} />
            </div>
 )}
        <h2 className="text-xl font-semibold text-white mb-2">Venta Rápida</h2>

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
                  ? <>Productos en "{categoriaActiva.nombre}". <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↓</kbd>, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Enter</kbd> descuenta, <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Esc</kbd> vuelve.</>
                  : <>Tocá una categoría o navegá con <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">↓</kbd> y <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-xs">Enter</kbd>.</>}
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
                            style={{ background: 'rgba(0,198,255,0.15)', border: '1px solid rgba(0,198,255,0.35)' }} />
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