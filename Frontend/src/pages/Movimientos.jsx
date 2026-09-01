import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Movimientos() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const inputScannerRef = useRef(null)

  const [productos, setProductos] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [busquedaRapida, setBusquedaRapida] = useState('')

  const [form, setForm] = useState({
    id_producto: '',
    cantidad: '',
    tipo: 'Entrada',
    origen: 'Manual',
  })

  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [cargando, setCargando] = useState(false)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarDatos = async () => {
    try {
      const [resProd, resMov] = await Promise.all([
        fetch(`${API_URL}/productos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_URL}/movimientos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ])
      if (resProd.ok) {
        const dataProd = await resProd.json()
        if (Array.isArray(dataProd)) setProductos(dataProd)
      }
      if (resMov.ok) {
        const dataMov = await resMov.json()
        if (Array.isArray(dataMov)) setMovimientos(dataMov)
      }
    } catch (err) {
      console.error('Error al cargar datos:', err)
      setError('Error al sincronizar datos con el servidor.')
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const productoSeleccionado = productos.find(
    (p) => p.id_producto === parseInt(form.id_producto)
  )
  const stockActual = productoSeleccionado?.stock?.cantidad ?? 0

  const handleBusquedaRapida = (valor) => {
    setBusquedaRapida(valor)
    const valLimpio = valor.trim().toLowerCase()
    if (!valLimpio) return

    const matchBarcode = productos.find((p) => p.codigo_barras && p.codigo_barras.trim().toLowerCase() === valLimpio)
    if (matchBarcode) {
      setForm((prev) => ({ ...prev, id_producto: matchBarcode.id_producto.toString(), origen: 'Scanner' }))
      setError('')
      return
    }

    const matchNombre = productos.find((p) => p.nombre.toLowerCase().includes(valLimpio))
    if (matchNombre) {
      setForm((prev) => ({ ...prev, id_producto: matchNombre.id_producto.toString(), origen: 'Manual' }))
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
        setBusquedaRapida('')
        setError('')
      } else {
        setError(`No se encontró ningún producto con el código o nombre: "${busquedaRapida}"`)
      }
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const cambiarTipo = (tipo) => {
    setForm((prev) => ({ ...prev, tipo }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.id_producto) {
      setError('Tenés que seleccionar o escanear un producto')
      return
    }

    const cant = parseInt(form.cantidad)
    if (!form.cantidad || isNaN(cant) || cant <= 0) {
      setError('La cantidad debe ser un número entero mayor a 0')
      return
    }

    // Validación de salida: no permitir retirar más de lo disponible
    if (form.tipo === 'Salida' && cant > stockActual) {
      setError(`No podés retirar ${cant} unidades: el stock disponible es de ${stockActual}`)
      return
    }

    setCargando(true)
    setError('')
    setMensajeExito('')

    try {
      const res = await fetch(`${API_URL}/movimientos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id_producto: parseInt(form.id_producto),
          cantidad: cant,
          tipo: form.tipo,
          origen: form.origen,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Error al registrar el movimiento')
        return
      }

      const nuevoTotal = form.tipo === 'Entrada' ? stockActual + cant : stockActual - cant

      setMovimientos((prev) => [data, ...prev])
      setProductos((prev) =>
        prev.map((p) => {
          if (p.id_producto === parseInt(form.id_producto)) {
            return { ...p, stock: { ...p.stock, cantidad: nuevoTotal } }
          }
          return p
        })
      )

      const accion = form.tipo === 'Entrada' ? 'sumaron' : 'retiraron'
      let mensaje = `Se ${accion} ${cant} unidades de "${productoSeleccionado?.nombre}". Stock actual: ${nuevoTotal}`

      // Alerta si la salida deja el stock en el mínimo o por debajo
      if (form.tipo === 'Salida' && nuevoTotal <= (productoSeleccionado?.stock_minimo ?? 0)) {
        mensaje += nuevoTotal === 0
          ? ' — ⚠ El producto se quedó sin stock.'
          : ' — ⚠ El producto llegó a su stock mínimo.'
      }

      setMensajeExito(mensaje)
      setTimeout(() => setMensajeExito(''), 5000)

      setForm({ id_producto: '', cantidad: '', tipo: form.tipo, origen: 'Manual' })
      setBusquedaRapida('')
      if (inputScannerRef.current) inputScannerRef.current.focus()

    } catch (err) {
      console.error(err)
      setError('Sin conexión al registrar el movimiento.')
    } finally {
      setCargando(false)
    }
  }

  const nuevoTotalPreview = form.cantidad && parseInt(form.cantidad) > 0
    ? (form.tipo === 'Entrada' ? stockActual + parseInt(form.cantidad) : stockActual - parseInt(form.cantidad))
    : null

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
        <h2 className="text-2xl font-semibold text-white mb-6">Movimientos de Stock</h2>

        {mensajeExito && (
          <div className="mb-6 text-xs px-4 py-3 rounded-lg flex items-center justify-between transition-all"
            style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
            <span>✓ {mensajeExito}</span>
            <button onClick={() => setMensajeExito('')} className="text-xs hover:opacity-75 ml-2 text-emerald-400">✕</button>
          </div>
        )}

        <div className="rounded-xl p-6 mb-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

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

          {/* Selector de tipo de movimiento */}
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => cambiarTipo('Entrada')}
              className="flex-1 text-sm py-2 rounded-lg font-medium transition-colors"
              style={{
                background: form.tipo === 'Entrada' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                border: form.tipo === 'Entrada' ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: form.tipo === 'Entrada' ? '#34d399' : '#9ca3af',
              }}>
              Entrada
            </button>
            <button type="button" onClick={() => cambiarTipo('Salida')}
              className="flex-1 text-sm py-2 rounded-lg font-medium transition-colors"
              style={{
                background: form.tipo === 'Salida' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                border: form.tipo === 'Salida' ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: form.tipo === 'Salida' ? '#f87171' : '#9ca3af',
              }}>
              Salida
            </button>
          </div>

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
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: '#9ca3af' }}>Seleccionar Producto *</label>
              <select
                name="id_producto"
                value={form.id_producto}
                onChange={(e) => { handleChange(e); setForm((prev) => ({ ...prev, origen: 'Manual' })) }}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <option value="">-- Seleccionar de la lista --</option>
                {productos.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.nombre} {p.codigo_barras ? `[${p.codigo_barras}]` : ''} (Stock: {p.stock?.cantidad ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: '#9ca3af' }}>
                Cantidad a {form.tipo === 'Entrada' ? 'sumar' : 'retirar'} *
              </label>
              <input
                type="number"
                min="1"
                max={form.tipo === 'Salida' ? stockActual : undefined}
                name="cantidad"
                placeholder="Ej: 10"
                value={form.cantidad}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {productoSeleccionado && (
              <div className="md:col-span-2 p-3 rounded-lg flex items-center justify-between text-xs"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-white font-medium">{productoSeleccionado.nombre}</span>
                  <span style={{ color: '#6b7280' }}>
                    Categoría: {productoSeleccionado.categoria?.nombre || '-'} | Cód: {productoSeleccionado.codigo_barras || 'Sin código'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="block" style={{ color: '#9ca3af' }}>Stock Actual</span>
                    <span className="text-sm font-semibold text-white">{stockActual}</span>
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
                      <span className="text-sm font-bold"
                        style={{ color: nuevoTotalPreview < 0 ? '#f87171' : nuevoTotalPreview <= productoSeleccionado.stock_minimo ? '#fb923c' : '#34d399' }}>
                        {nuevoTotalPreview}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="md:col-span-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                disabled={cargando}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: form.tipo === 'Entrada'
                    ? 'linear-gradient(135deg, #00c6ff, #39ff14)'
                    : 'linear-gradient(135deg,  #00c6ff, #39ff14)',
                  color: form.tipo === 'Entrada' ? '#0a0a0f' : '#0a0a0f',
                }}
              >
                {cargando ? 'Registrando...' : `Registrar ${form.tipo}`}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-lg font-medium text-white mb-4">Historial de Movimientos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ color: '#d1d5db' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                  <th className="py-2.5 px-3 font-medium">Fecha y Hora</th>
                  <th className="py-2.5 px-3 font-medium">Producto</th>
                  <th className="py-2.5 px-3 font-medium">Tipo</th>
                  <th className="py-2.5 px-3 font-medium">Origen</th>
                  <th className="py-2.5 px-3 font-medium">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-xs" style={{ color: '#6b7280' }}>
                      No hay movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id_movimiento} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-3 px-3" style={{ color: '#9ca3af' }}>{new Date(m.fecha_hora).toLocaleString()}</td>
                      <td className="py-3 px-3 font-medium text-white">{m.producto?.nombre || `Producto #${m.id_producto}`}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: m.tipo === 'Entrada' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: m.tipo === 'Entrada' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                            color: m.tipo === 'Entrada' ? '#34d399' : '#f87171',
                          }}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-3" style={{ color: '#9ca3af' }}>{m.origen}</td>
                      <td className="py-3 px-3 font-semibold text-white">
                        {m.tipo === 'Entrada' ? `+${m.cantidad}` : `-${m.cantidad}`}
                      </td>
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