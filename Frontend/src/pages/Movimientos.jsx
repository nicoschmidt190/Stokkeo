import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCategorias } from '../context/CategoriasContext'
import { useDebounce } from '../hooks/useDebounce'
import Paginador from '../components/Paginador'
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

const MOTIVOS_SALIDA = [
  { valor: '', label: 'Sin motivo (salida normal)' },
  { valor: 'Donacion', label: 'Donación' },
  { valor: 'Decomiso', label: 'Decomiso' },
  { valor: 'Perdida', label: 'Pérdida' },
  { valor: 'Rotura', label: 'Rotura' },
]

const obtenerFechaHoraLocal = () => {
  const ahora = new Date()
  const offsetMs = ahora.getTimezoneOffset() * 60000
  return new Date(ahora.getTime() - offsetMs).toISOString().slice(0, 16)
}

export default function Movimientos() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const { categorias, cargarCategorias } = useCategorias()
  const inputScannerRef = useRef(null)
  const fechaInicialRef = useRef(obtenerFechaHoraLocal())

  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [busquedaRapida, setBusquedaRapida] = useState('')
  const [cargandoDatos, setCargandoDatos] = useState(true)

  const [form, setForm] = useState({
    id_producto: '',
    cantidad: '',
    tipo: 'Entrada',
    origen: 'Manual',
    fecha_hora: fechaInicialRef.current,
    motivo: '',
    observaciones: '',
  })

  const [erroresCampos, setErroresCampos] = useState({})
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [cargando, setCargando] = useState(false)

  // --- Filtros y orden del historial ---
  const [busquedaLista, setBusquedaLista] = useState('')
  const busquedaListaDebounced = useDebounce(busquedaLista, 400)
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [orden, setOrden] = useState({ columna: 'fecha_hora', direccion: 'desc' })

  const [page, setPage] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarMovimientos = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      if (fechaDesde) params.set('desde', fechaDesde)
      if (fechaHasta) params.set('hasta', fechaHasta)
      if (busquedaListaDebounced.trim()) params.set('search', busquedaListaDebounced.trim())
      if (categoriaFiltro) params.set('id_categoria', categoriaFiltro)

      const res = await fetch(`${API_URL}/movimientos?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setMovimientos(Array.isArray(data.items) ? data.items : [])
        setTotalPaginas(data.total_pages || 1)
        setTotalItems(data.total || 0)
      }
    } catch (err) {
      console.error('Error al cargar movimientos:', err)
      setError('Error al sincronizar el historial con el servidor.')
    }
  }

  const cargarDatosIniciales = async () => {
    setCargandoDatos(true)
    try {
      // page_size=5000: el formulario de arriba necesita el catálogo
      // completo para poder buscar el producto por nombre/código al
      // registrar un movimiento — no tiene que ver con la paginación
      // del historial de abajo.
      const resProd = await fetch(`${API_URL}/productos?page_size=5000`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (resProd.ok) {
        const dataProd = await resProd.json()
        if (Array.isArray(dataProd.items)) setProductos(dataProd.items)
      }
      cargarCategorias()
      await cargarMovimientos()
    } catch (err) {
      console.error('Error al cargar datos:', err)
      setError('Error al sincronizar datos con el servidor.')
    } finally {
      setCargandoDatos(false)
    }
  }

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  // Igual que en Productos/Stock: al cambiar cualquier filtro del
  // historial, volvemos a la página 1.
  useEffect(() => { setPage(1) }, [busquedaListaDebounced, categoriaFiltro, fechaDesde, fechaHasta])

  useEffect(() => {
    if (!cargandoDatos) cargarMovimientos()
  }, [page, busquedaListaDebounced, categoriaFiltro, fechaDesde, fechaHasta])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const productoSeleccionado = productos.find(
    (p) => p.id_producto === parseInt(form.id_producto)
  )
  const stockActual = productoSeleccionado?.stock?.cantidad ?? 0
  const unidadProducto = productoSeleccionado?.unidad_medida || 'unidad'
  const admiteDecimales = UNIDADES_DECIMALES.includes(unidadProducto)

  const handleBusquedaRapida = (valor) => {
    setBusquedaRapida(valor)
    const valLimpio = valor.trim().toLowerCase()
    if (!valLimpio) return

    const matchBarcode = productos.find(
      (p) => p.codigo_barras && p.codigo_barras.trim().toLowerCase() === valLimpio
    )
    if (matchBarcode) {
      setForm((prev) => ({ ...prev, id_producto: matchBarcode.id_producto.toString(), origen: 'Scanner' }))
      setErroresCampos((prev) => ({ ...prev, id_producto: false }))
      setError('')
      return
    }

    const matchNombre = productos.find((p) => p.nombre.toLowerCase().includes(valLimpio))
    if (matchNombre) {
      setForm((prev) => ({ ...prev, id_producto: matchNombre.id_producto.toString(), origen: 'Manual' }))
      setErroresCampos((prev) => ({ ...prev, id_producto: false }))
      setError('')
    }
  }

  const handleKeyDownScanner = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const valLimpio = busquedaRapida.trim().toLowerCase()
      const match = productos.find(
        (p) =>
          (p.codigo_barras && p.codigo_barras.toLowerCase() === valLimpio) ||
          p.nombre.toLowerCase() === valLimpio
      )
      if (match) {
        setForm((prev) => ({
          ...prev,
          id_producto: match.id_producto.toString(),
          origen: match.codigo_barras?.toLowerCase() === valLimpio ? 'Scanner' : 'Manual',
        }))
        setErroresCampos((prev) => ({ ...prev, id_producto: false }))
        setBusquedaRapida('')
        setError('')
      } else {
        setError(`No se encontró ningún producto con el código o nombre: "${busquedaRapida}"`)
      }
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    setError('')
    if (erroresCampos[name]) {
      setErroresCampos((prev) => ({ ...prev, [name]: false }))
    }
  }

  const alternarTipo = () => {
    setForm((prev) => ({
      ...prev,
      tipo: prev.tipo === 'Entrada' ? 'Salida' : 'Entrada',
      motivo: '',
      observaciones: '',
    }))
    setErroresCampos({})
    setError('')
  }

  const fechaFueModificada = form.fecha_hora !== fechaInicialRef.current

  const resetearFormulario = () => {
    const nuevaFechaInicial = obtenerFechaHoraLocal()
    fechaInicialRef.current = nuevaFechaInicial
    setForm((prev) => ({
      id_producto: '',
      cantidad: '',
      tipo: prev.tipo,
      origen: 'Manual',
      fecha_hora: nuevaFechaInicial,
      motivo: '',
      observaciones: '',
    }))
    setErroresCampos({})
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errores = {}
    if (!form.id_producto) {
      errores.id_producto = true
    }

    const cant = parseFloat(form.cantidad)
    if (!form.cantidad || isNaN(cant) || cant <= 0) {
      errores.cantidad = true
    }

    if (Object.keys(errores).length > 0) {
      setErroresCampos(errores)
      setError('Completá los campos obligatorios marcados en rojo (*)')
      return
    }

    if (form.tipo === 'Salida' && cant > stockActual) {
      setErroresCampos({ cantidad: true })
      setError(
        `No podés retirar ${cant} ${ETIQUETAS_UNIDAD[unidadProducto] || unidadProducto}: el stock disponible es de ${stockActual}`
      )
      return
    }

    if (fechaFueModificada) {
      const confirmar = window.confirm(
        'Modificaste la fecha del movimiento. ¿Estás seguro de que querés registrarlo con esa fecha?'
      )
      if (!confirmar) return
    }

    setCargando(true)
    setError('')
    setMensajeExito('')

    try {
      const body = {
        id_producto: parseInt(form.id_producto),
        cantidad: cant,
        tipo: form.tipo,
        origen: form.origen,
      }

      if (fechaFueModificada) {
        body.fecha_hora = new Date(form.fecha_hora).toISOString()
      }
      if (form.tipo === 'Salida') {
        body.motivo = form.motivo || null
        body.observaciones = form.observaciones.trim() || null
      }

      const res = await fetch(`${API_URL}/movimientos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Error al registrar el movimiento')
        return
      }

      const nuevoTotal = form.tipo === 'Entrada' ? stockActual + cant : stockActual - cant

      // El nuevo movimiento aparece arriba de todo (orden por fecha desc).
      // Si no estábamos en la página 1, volvemos ahí para verlo; si ya
      // estábamos, simplemente recargamos esa página.
      if (page !== 1) {
        setPage(1)
      } else {
        cargarMovimientos()
      }
      setProductos((prev) =>
        prev.map((p) =>
          p.id_producto === parseInt(form.id_producto)
            ? { ...p, stock: { ...p.stock, cantidad: nuevoTotal } }
            : p
        )
      )

      const unidad = ETIQUETAS_UNIDAD[unidadProducto] || unidadProducto
      const accion = form.tipo === 'Entrada' ? 'sumaron' : 'retiraron'
      let mensaje = `Se ${accion} ${cant} ${unidad} de "${productoSeleccionado?.nombre}". Stock actual: ${nuevoTotal} ${unidad}`

      if (form.tipo === 'Salida' && nuevoTotal <= (productoSeleccionado?.stock_minimo ?? 0)) {
        mensaje += nuevoTotal <= 0
          ? ' — ⚠ El producto se quedó sin stock.'
          : ' — ⚠ El producto llegó a su stock mínimo.'
      }

      setMensajeExito(mensaje)
      setTimeout(() => setMensajeExito(''), 5000)

      resetearFormulario()
      setBusquedaRapida('')
      if (inputScannerRef.current) inputScannerRef.current.focus()

    } catch (err) {
      console.error(err)
      setError('Sin conexión al registrar el movimiento.')
    } finally {
      setCargando(false)
    }
  }

  const nuevoTotalPreview = form.cantidad && parseFloat(form.cantidad) > 0
    ? (form.tipo === 'Entrada' ? stockActual + parseFloat(form.cantidad) : stockActual - parseFloat(form.cantidad))
    : null

  // El filtro por nombre, categoría y fechas ya se resolvió en el backend
  // (query params de cargarMovimientos). Acá solo ordenamos la página
  // actual, que es lo único que tenemos en memoria.
  const movimientosOrdenados = [...movimientos].sort((a, b) => {
    let valorA, valorB

    switch (orden.columna) {
      case 'producto':
        valorA = a.producto?.nombre || ''
        valorB = b.producto?.nombre || ''
        return orden.direccion === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA)
      case 'cantidad':
        return orden.direccion === 'asc' ? a.cantidad - b.cantidad : b.cantidad - a.cantidad
      case 'fecha_hora':
        valorA = new Date(a.fecha_hora).getTime()
        valorB = new Date(b.fecha_hora).getTime()
        return orden.direccion === 'asc' ? valorA - valorB : valorB - valorA
      default:
        valorA = (a[orden.columna] || '').toString().toLowerCase()
        valorB = (b[orden.columna] || '').toString().toLowerCase()
        return orden.direccion === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA)
    }
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
      <nav
        style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src={logo} alt="Stokkeo" className="h-12" />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ color: '#9ca3af' }}
          >
            Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-4xl mx-auto relative">
        {cargandoDatos && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(2px)' }}
          >
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(0,198,255,0.3)', borderTopColor: '#00c6ff' }}
            />
          </div>
        )}

        <h2 className="text-xl font-semibold text-white mb-4">Movimientos de Stock</h2>

        {mensajeExito && (
          <div
            className="mb-6 text-xs px-4 py-3 rounded-lg flex items-center justify-between transition-all"
            style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399' }}
          >
            <span>✓ {mensajeExito}</span>
            <button onClick={() => setMensajeExito('')} className="text-xs hover:opacity-75 ml-2 text-emerald-400">✕</button>
          </div>
        )}

        <div
          className="rounded-xl p-6 mb-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">
              {form.tipo === 'Entrada' ? 'Ingreso de Mercadería' : 'Salida de Mercadería'}
            </h3>
            {form.origen === 'Scanner' && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-medium">
                ⚡ Modo Escáner
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={alternarTipo}
            className="w-full text-sm py-2.5 rounded-lg font-semibold mb-4 transition-colors"
            style={{
              background: form.tipo === 'Entrada' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: form.tipo === 'Entrada' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(239,68,68,0.4)',
              color: form.tipo === 'Entrada' ? '#34d399' : '#f87171',
            }}
          >
            {form.tipo === 'Entrada' ? '⬇ Entrada' : '⬆ Salida'} — tocá para cambiar a {form.tipo === 'Entrada' ? 'Salida' : 'Entrada'}
          </button>

          <div className="mb-4">
            <label className="text-xs mb-1 block" style={{ color: '#9ca3af' }}>
              Escanear código de barras o escribir para autocompletar:
            </label>
            <input
              ref={inputScannerRef}
              type="text"
              placeholder="Escaneá con lector de barras o escribí el nombre..."
              value={busquedaRapida}
              onChange={(e) => handleBusquedaRapida(e.target.value)}
              onKeyDown={handleKeyDownScanner}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0, 198, 255, 0.4)' }}
            />
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selección de Producto */}
            <div className="flex flex-col gap-1">
              <label
                className="text-xs"
                style={{ color: erroresCampos.id_producto ? '#f87171' : '#9ca3af' }}
              >
                Seleccionar Producto *
              </label>
              <select
                name="id_producto"
                value={form.id_producto}
                onChange={(e) => {
                  handleChange(e)
                  setForm((prev) => ({ ...prev, origen: 'Manual' }))
                }}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none transition-all"
                style={{
                  background: '#121218',
                  border: erroresCampos.id_producto
                    ? '1px solid #ef4444'
                    : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <option value="">-- Seleccionar de la lista --</option>
                {productos.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.nombre} {p.codigo_barras ? `[${p.codigo_barras}]` : ''} (Stock: {p.stock?.cantidad ?? 0} {ETIQUETAS_UNIDAD[p.unidad_medida] || p.unidad_medida})
                  </option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
            <div className="flex flex-col gap-1">
              <label
                className="text-xs"
                style={{ color: erroresCampos.cantidad ? '#f87171' : '#9ca3af' }}
              >
                Cantidad a {form.tipo === 'Entrada' ? 'sumar' : 'retirar'} *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step={admiteDecimales ? '0.01' : '1'}
                  max={form.tipo === 'Salida' ? stockActual : undefined}
                  name="cantidad"
                  placeholder={admiteDecimales ? '0.00' : '0'}
                  value={form.cantidad}
                  onChange={handleChange}
                  className="w-full pl-3 pr-12 py-2 rounded-lg text-sm text-white focus:outline-none transition-all font-mono"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: erroresCampos.cantidad
                      ? '1px solid #ef4444'
                      : '1px solid rgba(255,255,255,0.1)',
                  }}
                />
                <span className="absolute right-3 top-2.5 text-xs text-cyan-400 font-semibold pointer-events-none select-none">
                  {ETIQUETAS_UNIDAD[unidadProducto] || unidadProducto}
                </span>
              </div>
            </div>

            {/* Fecha del movimiento */}
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: '#9ca3af' }}>
                Fecha y hora {fechaFueModificada && <span style={{ color: '#fb923c' }}>(modificada)</span>}
              </label>
              <input
                type="datetime-local"
                name="fecha_hora"
                value={form.fecha_hora}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: fechaFueModificada ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>

            {/* Motivo y observaciones (Salida) */}
            {form.tipo === 'Salida' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: '#9ca3af' }}>Motivo (opcional)</label>
                  <select
                    name="motivo"
                    value={form.motivo}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                    style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {MOTIVOS_SALIDA.map((m) => (
                      <option key={m.valor} value={m.valor}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs" style={{ color: '#9ca3af' }}>Observaciones (opcional)</label>
                  <textarea
                    name="observaciones"
                    placeholder="Detalle adicional sobre esta salida..."
                    value={form.observaciones}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              </>
            )}

            {productoSeleccionado && (
              <div
                className="md:col-span-2 p-3 rounded-lg flex items-center justify-between text-xs"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-white font-medium">{productoSeleccionado.nombre}</span>
                  <span style={{ color: '#6b7280' }}>
                    Categoría: {productoSeleccionado.categoria?.nombre || '-'} | Cód: {productoSeleccionado.codigo_barras || 'Sin código'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="block" style={{ color: '#9ca3af' }}>Stock Actual</span>
                    <span className="text-sm font-semibold text-white">{stockActual} {ETIQUETAS_UNIDAD[unidadProducto] || unidadProducto}</span>
                  </div>
                  <div>
                    <span className="block" style={{ color: '#9ca3af' }}>Stock Mínimo</span>
                    <span className="text-sm font-semibold text-white">{productoSeleccionado.stock_minimo}</span>
                  </div>
                  {nuevoTotalPreview !== null && (
                    <div>
                      <span className="block" style={{ color: nuevoTotalPreview <= productoSeleccionado.stock_minimo ? '#fb923c' : '#34d399' }}>
                        Nuevo Total
                      </span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: nuevoTotalPreview < 0 ? '#f87171' : nuevoTotalPreview <= productoSeleccionado.stock_minimo ? '#fb923c' : '#34d399' }}
                      >
                        {nuevoTotalPreview}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div
                className="md:col-span-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171' }}
              >
                {error}
              </div>
            )}

            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                disabled={cargando}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #00c6ff, #39ff14)',
                  color: '#0a0a0f',
                }}
              >
                {cargando && (
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(10,10,15,0.3)', borderTopColor: '#0a0a0f' }}
                  />
                )}
                {cargando ? 'Registrando...' : `Registrar ${form.tipo}`}
              </button>
            </div>
          </form>
        </div>

        {/* Historial */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex flex-col gap-3 mb-6">
            <h3 className="text-lg font-medium text-white">Historial de Movimientos</h3>

            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Buscar por producto..."
                value={busquedaLista}
                onChange={(e) => setBusquedaLista(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', width: '200px' }}
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

              <div className="flex items-center gap-2 text-xs" style={{ color: '#9ca3af' }}>
                <span>Desde</span>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <span>Hasta</span>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                {(fechaDesde || fechaHasta) && (
                  <button
                    onClick={() => { setFechaDesde(''); setFechaHasta('') }}
                    className="text-xs px-2 py-1 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ color: '#d1d5db' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                  <th onClick={() => handleCambiarOrden('fecha_hora')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Fecha y Hora {renderIconoOrden('fecha_hora')}
                  </th>
                  <th onClick={() => handleCambiarOrden('producto')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Producto {renderIconoOrden('producto')}
                  </th>
                  <th onClick={() => handleCambiarOrden('tipo')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Tipo {renderIconoOrden('tipo')}
                  </th>
                  <th onClick={() => handleCambiarOrden('origen')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Origen {renderIconoOrden('origen')}
                  </th>
                  <th onClick={() => handleCambiarOrden('cantidad')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Cantidad {renderIconoOrden('cantidad')}
                  </th>
                  <th className="py-2.5 px-3 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-xs" style={{ color: '#6b7280' }}>
                      {totalItems === 0 ? 'No hay movimientos que coincidan con los filtros.' : 'No se encontraron movimientos que coincidan.'}
                    </td>
                  </tr>
                ) : (
                  movimientosOrdenados.map((m, i) => {
                    const unidad = ETIQUETAS_UNIDAD[m.producto?.unidad_medida] || m.producto?.unidad_medida || ''
                    return (
                      <tr
                        key={m.id_movimiento}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                        }}
                        title={m.observaciones || ''}
                      >
                        <td className="py-3 px-3" style={{ color: '#9ca3af' }}>{new Date(m.fecha_hora).toLocaleString()}</td>
                        <td className="py-3 px-3 font-medium text-white">{m.producto?.nombre || `Producto #${m.id_producto}`}</td>
                        <td className="py-3 px-3">
                          <span
                            className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                            style={{
                              background: m.tipo === 'Entrada' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: m.tipo === 'Entrada' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                              color: m.tipo === 'Entrada' ? '#34d399' : '#f87171',
                            }}
                          >
                            {m.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-3" style={{ color: '#9ca3af' }}>{m.origen}</td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {m.tipo === 'Entrada' ? '+' : '-'}{m.cantidad} {unidad}
                        </td>
                        <td className="py-3 px-3 text-xs" style={{ color: '#9ca3af' }}>
                          {m.motivo ? MOTIVOS_SALIDA.find((mo) => mo.valor === m.motivo)?.label || m.motivo : '-'}
                        </td>
                      </tr>
                    )
                  })
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