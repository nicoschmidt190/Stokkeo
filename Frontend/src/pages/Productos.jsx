import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

const UNIDADES_MEDIDA = [
  { valor: 'unidad', label: 'Unidades (u)', esDecimal: false },
  { valor: 'kg', label: 'Kilogramos (kg)', esDecimal: true },
  { valor: 'litros', label: 'Litros (L)', esDecimal: true },
  { valor: 'gramos', label: 'Gramos (g)', esDecimal: false },
  { valor: 'caja', label: 'Cajas (cj)', esDecimal: false },
  { valor: 'pack', label: 'Packs (pk)', esDecimal: false },
]

const ETIQUETAS_UNIDAD = {
  unidad: 'u',
  kg: 'kg',
  litros: 'L',
  gramos: 'gr',
  caja: 'cj',
  pack: 'pk',
}

export default function Productos() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [editando, setEditando] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [cargandoDatos, setCargandoDatos] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [orden, setOrden] = useState({ columna: 'nombre', direccion: 'asc' })

  const [form, setForm] = useState({
    nombre: '',
    precioCosto: '',
    stock_actual: '',
    stock_minimo: '',
    unidad_medida: 'unidad',
    codigo_barras: '',
    id_categoria: '',
  })
  const [precioVisible, setPrecioVisible] = useState('')
  const [stockActualVisible, setStockActualVisible] = useState('')
  const [stockMinimoVisible, setStockMinimoVisible] = useState('')

  const [erroresCampos, setErroresCampos] = useState({})
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarDatos = async () => {
    setCargandoDatos(true)
    try {
      const [resProd, resCat] = await Promise.all([
        fetch(`${API_URL}/productos`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch(`${API_URL}/categorias`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ])
      if (resProd.ok) {
        const dataProd = await resProd.json()
        if (Array.isArray(dataProd)) setProductos(dataProd)
      }
      if (resCat.ok) {
        const dataCat = await resCat.json()
        if (Array.isArray(dataCat)) setCategorias(dataCat)
      }
    } catch (err) {
      console.error('Error al cargar datos:', err)
    } finally {
      setCargandoDatos(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const admiteDecimales = (unidad) => {
    const config = UNIDADES_MEDIDA.find((u) => u.valor === unidad)
    return config ? config.esDecimal : false
  }

  const formatearStockValor = (num, unidad) => {
    if (num === '' || num === null || num === undefined || isNaN(num)) return ''
    const tieneDecimal = admiteDecimales(unidad)
    return Number(num).toLocaleString('es-AR', {
      minimumFractionDigits: tieneDecimal ? 2 : 0,
      maximumFractionDigits: tieneDecimal ? 2 : 0,
    })
  }

  const handleChangePrecioEnVivo = (e) => {
    const soloNumeros = e.target.value.replace(/\D/g, '')
    if (!soloNumeros) {
      setForm((prev) => ({ ...prev, precioCosto: '' }))
      setPrecioVisible('')
      return
    }
    const valorDecimal = (parseInt(soloNumeros, 10) / 100).toFixed(2)
    setForm((prev) => ({ ...prev, precioCosto: valorDecimal }))
    setPrecioVisible(
      Number(valorDecimal).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
    if (erroresCampos.precioCosto) setErroresCampos((prev) => ({ ...prev, precioCosto: false }))
  }

  const handleChangeStockEnVivo = (e, campo, setVisible) => {
    const soloNumeros = e.target.value.replace(/\D/g, '')
    const esDecimal = admiteDecimales(form.unidad_medida)

    if (!soloNumeros) {
      setForm((prev) => ({ ...prev, [campo]: '' }))
      setVisible('')
      return
    }

    if (esDecimal) {
      const valorDecimal = (parseInt(soloNumeros, 10) / 100).toFixed(2)
      setForm((prev) => ({ ...prev, [campo]: valorDecimal }))
      setVisible(
        Number(valorDecimal).toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      )
    } else {
      const valorEntero = parseInt(soloNumeros, 10).toString()
      setForm((prev) => ({ ...prev, [campo]: valorEntero }))
      setVisible(Number(valorEntero).toLocaleString('es-AR'))
    }

    if (erroresCampos[campo]) setErroresCampos((prev) => ({ ...prev, [campo]: false }))
  }

  const handleCambioUnidad = (e) => {
    const nuevaUnidad = e.target.value
    setForm((prev) => ({ ...prev, unidad_medida: nuevaUnidad }))
    if (form.stock_actual !== '') {
      setStockActualVisible(formatearStockValor(form.stock_actual, nuevaUnidad))
    }
    if (form.stock_minimo !== '') {
      setStockMinimoVisible(formatearStockValor(form.stock_minimo, nuevaUnidad))
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    setError('')

    if (erroresCampos[name]) setErroresCampos((prev) => ({ ...prev, [name]: false }))

    if (name === 'codigo_barras' && value.trim()) {
      const codigoNormalizado = value.trim().toLowerCase()
      const duplicado = productos.find(
        (p) =>
          p.codigo_barras &&
          p.codigo_barras.trim().toLowerCase() === codigoNormalizado &&
          (!editando || p.id_producto !== editando.id_producto)
      )
      if (duplicado) setError(`El código ya está asignado al producto "${duplicado.nombre}"`)
    }
  }

  const handleGenerarCodigoInterno = () => {
    let codigoNuevo = ''
    let existe = true
    while (existe) {
      const aleatorio = Math.floor(10000000 + Math.random() * 90000000)
      codigoNuevo = `STK-${aleatorio}`
      existe = productos.some((p) => p.codigo_barras === codigoNuevo)
    }
    setForm((prev) => ({ ...prev, codigo_barras: codigoNuevo }))
    setError('')
  }

  const handleAbrirNuevo = () => {
    setEditando(null)
    setForm({
      nombre: '',
      precioCosto: '',
      stock_actual: '0',
      stock_minimo: '',
      unidad_medida: 'unidad',
      codigo_barras: '',
      id_categoria: '',
    })
    setPrecioVisible('')
    setStockActualVisible('0')
    setStockMinimoVisible('')
    setErroresCampos({})
    setError('')
    setMostrarFormulario(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEditar = (p) => {
    setEditando(p)
    const precioNumerico = Number(p.precioCosto || 0)
    const stockActualNum = p.stock?.cantidad ?? 0
    const stockMinNum = p.stock_minimo || 0
    const unidad = p.unidad_medida || 'unidad'

    setForm({
      nombre: p.nombre,
      precioCosto: precioNumerico.toFixed(2),
      stock_actual: stockActualNum,
      stock_minimo: stockMinNum,
      unidad_medida: unidad,
      codigo_barras: p.codigo_barras || '',
      id_categoria: p.id_categoria,
    })

    setPrecioVisible(precioNumerico.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    setStockActualVisible(formatearStockValor(stockActualNum, unidad))
    setStockMinimoVisible(formatearStockValor(stockMinNum, unidad))

    setErroresCampos({})
    setError('')
    setMensajeExito('')
    setMostrarFormulario(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelar = () => {
    setEditando(null)
    setForm({
      nombre: '',
      precioCosto: '',
      stock_actual: '',
      stock_minimo: '',
      unidad_medida: 'unidad',
      codigo_barras: '',
      id_categoria: '',
    })
    setPrecioVisible('')
    setStockActualVisible('')
    setStockMinimoVisible('')
    setErroresCampos({})
    setError('')
    setMostrarFormulario(false)
  }

  const handleEliminar = async (producto) => {
    const idProd = producto.id_producto
    const nombreProd = producto.nombre || 'Producto'

    if (!window.confirm(`¿Estás seguro de que querés eliminar "${nombreProd}"? Se eliminarán también sus stocks y movimientos.`)) {
      return
    }

    try {
      const res = await fetch(`${API_URL}/productos/${idProd}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!res.ok) {
        let detalleError = 'Ocurrió un error al eliminar el producto'
        try {
          const data = await res.json()
          if (data?.detail) detalleError = data.detail
        } catch {}
        setError(detalleError)
        return
      }

      setProductos((prev) => prev.filter((p) => p.id_producto !== idProd))
      setError('')
      setMensajeExito(`"${nombreProd}" eliminado correctamente`)
      setTimeout(() => setMensajeExito(''), 4000)
    } catch {
      setError('Sin conexión al intentar eliminar el producto.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errores = {}
    if (!form.nombre.trim()) errores.nombre = true
    if (!form.precioCosto || isNaN(parseFloat(form.precioCosto))) errores.precioCosto = true
    if (form.stock_minimo === '' || isNaN(parseFloat(form.stock_minimo))) errores.stock_minimo = true
    if (!form.id_categoria) errores.id_categoria = true
    if (!editando && (form.stock_actual === '' || isNaN(parseFloat(form.stock_actual)))) {
      errores.stock_actual = true
    }

    if (Object.keys(errores).length > 0) {
      setErroresCampos(errores)
      setError('Completá los campos obligatorios marcados en rojo (*)')
      return
    }

    setCargando(true)
    setError('')
    setMensajeExito('')

    try {
      const url = editando ? `${API_URL}/productos/${editando.id_producto}` : `${API_URL}/productos`
      const method = editando ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          precioCosto: parseFloat(form.precioCosto),
          stock_actual: !editando ? parseFloat(form.stock_actual) : undefined,
          stock_minimo: parseFloat(form.stock_minimo),
          unidad_medida: form.unidad_medida,
          codigo_barras: form.codigo_barras.trim() || null,
          id_categoria: parseInt(form.id_categoria),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || 'Ocurrió un error al guardar el producto')
        return
      }

      if (editando) {
        setProductos((prev) => prev.map((p) => p.id_producto === data.id_producto ? data : p))
        setMensajeExito(`"${data.nombre}" actualizado correctamente`)
      } else {
        setProductos((prev) => [...prev, data])
        setMensajeExito(`"${data.nombre}" guardado con ${form.stock_actual || 0} ${ETIQUETAS_UNIDAD[form.unidad_medida]} de stock`)
      }

      setTimeout(() => setMensajeExito(''), 4000)
      handleCancelar()
    } catch {
      setError('Sin conexión. Verificá tu conexión e intentá de nuevo')
    } finally {
      setCargando(false)
    }
  }

  const productosProcesados = productos
    .filter((p) => {
      const textoLimpio = busqueda.trim().toLowerCase()
      const cumpleBusqueda = textoLimpio.length >= 3 ? p.nombre.toLowerCase().includes(textoLimpio) : true
      const cumpleCategoria = categoriaFiltro ? p.id_categoria === parseInt(categoriaFiltro) : true
      return cumpleBusqueda && cumpleCategoria
    })
    .sort((a, b) => {
      let valorA = a[orden.columna]
      let valorB = b[orden.columna]

      if (orden.columna === 'categoria') {
        valorA = a.categoria?.nombre || ''
        valorB = b.categoria?.nombre || ''
      }

      if (orden.columna === 'precioCosto' || orden.columna === 'stock_minimo') {
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
      {/* Navbar — encabezado más chico */}
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
        {cargandoDatos && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(2px)' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(0,198,255,0.3)', borderTopColor: '#00c6ff' }} />
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Productos</h2>
          {!mostrarFormulario && (
            <button onClick={handleAbrirNuevo} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'linear-gradient(135deg, #00c6ff, #39ff14)', color: '#0a0a0f' }}>
              + Agregar producto
            </button>
          )}
        </div>

        {mensajeExito && (
          <div className="mb-6 text-xs px-4 py-3 rounded-lg flex items-center justify-between"
            style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
            <span>✓ {mensajeExito}</span>
            <button onClick={() => setMensajeExito('')} className="text-xs hover:opacity-75 ml-2 text-emerald-400">✕</button>
          </div>
        )}

        {mostrarFormulario && (
          <div className="rounded-xl p-6 mb-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">{editando ? `Editando: ${editando.nombre}` : 'Nuevo Producto'}</h3>
              <button onClick={handleCancelar} className="text-xs text-gray-400 hover:text-white">✕ Cerrar</button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: erroresCampos.nombre ? '#f87171' : '#9ca3af' }}>Nombre *</label>
                <input name="nombre" placeholder="Ej: Yerba Mate 1kg" value={form.nombre} onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: erroresCampos.nombre ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)' }} />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: erroresCampos.id_categoria ? '#f87171' : '#9ca3af' }}>Categoría *</label>
                <select name="id_categoria" value={form.id_categoria} onChange={handleChange}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none transition-all"
                  style={{ background: '#121218', border: erroresCampos.id_categoria ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="">Seleccionar categoría</option>
                  {categorias.map((cat) => (
                    <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: '#9ca3af' }}>Unidad de Medida *</label>
                <select name="unidad_medida" value={form.unidad_medida} onChange={handleCambioUnidad}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                  style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {UNIDADES_MEDIDA.map((u) => (
                    <option key={u.valor} value={u.valor}>{u.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: erroresCampos.precioCosto ? '#f87171' : '#9ca3af' }}>Precio Costo *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-emerald-400 font-bold">$</span>
                  <input type="text" inputMode="numeric" placeholder="0,00" value={precioVisible} onChange={handleChangePrecioEnVivo}
                    className="w-full pl-7 pr-3 py-2 rounded-lg text-sm text-white focus:outline-none transition-all font-mono"
                    style={{ background: 'rgba(255,255,255,0.05)', border: erroresCampos.precioCosto ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)' }} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: erroresCampos.stock_actual ? '#f87171' : '#9ca3af' }}>
                  {editando ? 'Stock Actual (Informativo)' : 'Stock Inicial *'}
                </label>
                <div className="relative">
                  <input type="text" inputMode="numeric" disabled={Boolean(editando)}
                    placeholder={admiteDecimales(form.unidad_medida) ? '0,00' : '0'}
                    value={stockActualVisible}
                    onChange={(e) => handleChangeStockEnVivo(e, 'stock_actual', setStockActualVisible)}
                    className="w-full pl-3 pr-14 py-2 rounded-lg text-sm text-white focus:outline-none transition-all font-mono disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.05)', border: erroresCampos.stock_actual ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)' }} />
                  <span className="absolute right-3 top-2.5 text-xs text-cyan-400 font-semibold pointer-events-none select-none">
                    {ETIQUETAS_UNIDAD[form.unidad_medida] || form.unidad_medida}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: erroresCampos.stock_minimo ? '#f87171' : '#9ca3af' }}>Stock Mínimo *</label>
                <div className="relative">
                  <input type="text" inputMode="numeric"
                    placeholder={admiteDecimales(form.unidad_medida) ? '0,00' : '0'}
                    value={stockMinimoVisible}
                    onChange={(e) => handleChangeStockEnVivo(e, 'stock_minimo', setStockMinimoVisible)}
                    className="w-full pl-3 pr-14 py-2 rounded-lg text-sm text-white focus:outline-none transition-all font-mono"
                    style={{ background: 'rgba(255,255,255,0.05)', border: erroresCampos.stock_minimo ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)' }} />
                  <span className="absolute right-3 top-2.5 text-xs text-cyan-400 font-semibold pointer-events-none select-none">
                    {ETIQUETAS_UNIDAD[form.unidad_medida] || form.unidad_medida}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-xs" style={{ color: '#9ca3af' }}>Código de Barras</label>
                  <button type="button" onClick={handleGenerarCodigoInterno}
                    className="text-xs px-2.5 py-1 rounded-md text-cyan-400 hover:text-cyan-300 transition-all font-medium"
                    style={{ background: 'rgba(0, 198, 255, 0.1)', border: '1px solid rgba(0, 198, 255, 0.3)' }}>
                    ⚡ Generar código interno
                  </button>
                </div>
                <input name="codigo_barras" placeholder="Escaneá con lector HID, escribilo o generá uno..."
                  value={form.codigo_barras} onChange={handleChange}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>

              {error && (
                <div className="md:col-span-2 text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171' }}>
                  {error}
                </div>
              )}

              <div className="md:col-span-2 mt-2 flex gap-3">
                {/* Botón sólido verde: confirmar/guardar */}
                <button type="submit" disabled={cargando} className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #00c6ff, #39ff14)', color: '#0a0a0f' }}>
                  {cargando && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: 'rgba(10,10,15,0.3)', borderTopColor: '#0a0a0f' }} />
                  )}
                  {cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar Producto'}
                </button>
                <button type="button" onClick={handleCancelar} className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-medium text-white">Listado de Productos</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="Buscar por nombre (mín. 3 letras)..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', width: '240px' }} />

              <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)' }}>
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
                    Nombre {renderIconoOrden('nombre')}
                  </th>
                  <th onClick={() => handleCambiarOrden('categoria')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Categoría {renderIconoOrden('categoria')}
                  </th>
                  <th onClick={() => handleCambiarOrden('precioCosto')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Precio Costo {renderIconoOrden('precioCosto')}
                  </th>
                  <th onClick={() => handleCambiarOrden('stock_minimo')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Stock Mínimo {renderIconoOrden('stock_minimo')}
                  </th>
                  <th onClick={() => handleCambiarOrden('unidad_medida')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Medida {renderIconoOrden('unidad_medida')}
                  </th>
                  <th onClick={() => handleCambiarOrden('codigo_barras')} className="py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none">
                    Cód. Barras {renderIconoOrden('codigo_barras')}
                  </th>
                  <th className="py-2.5 px-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosProcesados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-xs" style={{ color: '#6b7280' }}>
                      {productos.length === 0 ? 'No hay productos registrados.' : 'No se encontraron productos que coincidan.'}
                    </td>
                  </tr>
                ) : (
                  productosProcesados.map((p, i) => {
                    const esDec = admiteDecimales(p.unidad_medida)
                    const stockMinFormateado = Number(p.stock_minimo || 0).toLocaleString('es-AR', {
                      minimumFractionDigits: esDec ? 2 : 0,
                      maximumFractionDigits: esDec ? 2 : 0,
                    })

                    return (
                      <tr key={p.id_producto} className="transition-colors"
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                        }}>
                        <td className="py-3 px-3 font-medium text-white">{p.nombre}</td>
                        <td className="py-3 px-3">{p.categoria?.nombre || '-'}</td>
                        <td className="py-3 px-3 font-mono">
                          ${Number(p.precioCosto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 font-mono text-white">
                          {stockMinFormateado}
                        </td>
                        <td className="py-3 px-3 text-xs capitalize" style={{ color: '#9ca3af' }}>
                          {p.unidad_medida || 'unidad'}
                        </td>
                        <td className="py-3 px-3" style={{ color: '#6b7280' }}>
                          {p.codigo_barras || '-'}
                        </td>
                        <td className="py-3 px-3 flex gap-2">
                          {/* Editar: celeste — es navegación hacia el formulario */}
                          <button onClick={() => handleEditar(p)} className="text-xs px-3 py-1 rounded-lg"
                            style={{ background: 'rgba(0,198,255,0.1)', border: '1px solid rgba(0,198,255,0.3)', color: '#00c6ff' }}>
                            Editar
                          </button>
                          <button onClick={() => handleEliminar(p)} className="text-xs px-3 py-1 rounded-lg"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}