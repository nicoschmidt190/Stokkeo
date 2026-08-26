import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Productos() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [editando, setEditando] = useState(null)
  
  // Estados para filtros
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    precioCosto: '',
    stock_minimo: '',
    codigo_barras: '',
    id_categoria: '',
  })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarDatos = async () => {
    try {
      const [resProd, resCat] = await Promise.all([
        fetch(`${API_URL}/productos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/categorias`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (resProd.ok) setProductos(await resProd.json())
      if (resCat.ok) setCategorias(await resCat.json())
    } catch (err) {
      console.error('Error al cargar datos:', err)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  // --- LÓGICA DE FILTRADO COMBINADO ---
  const productosFiltrados = productos.filter((p) => {
    const textoLimpio = busqueda.trim().toLowerCase()

    // 1. Condición de búsqueda: solo filtra si tiene 3 o más caracteres
    const cumpleBusqueda = textoLimpio.length >= 3
      ? p.nombre.toLowerCase().includes(textoLimpio)
      : true

    // 2. Condición de categoría: si hay una categoría seleccionada en el filtro
    const cumpleCategoria = categoriaFiltro
      ? p.id_categoria === parseInt(categoriaFiltro)
      : true

    return cumpleBusqueda && cumpleCategoria
  })

  const handleLogout = () => { logout(); navigate('/login') }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleEditar = (p) => {
    setEditando(p)
    setForm({
      nombre: p.nombre,
      precioCosto: p.precioCosto,
      stock_minimo: p.stock_minimo,
      codigo_barras: p.codigo_barras || '',
      id_categoria: p.id_categoria,
    })
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelar = () => {
    setEditando(null)
    setForm({ nombre: '', precioCosto: '', stock_minimo: '', codigo_barras: '', id_categoria: '' })
    setError('')
  }

  const handleEliminar = async (id_producto) => {
    const confirmar = window.confirm('¿Estás seguro de que querés eliminar este producto? Se eliminarán también sus precios competidores y stock.')
    
    if (!confirmar) return

    try {
      const res = await fetch(`${API_URL}/productos/${id_producto}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'Ocurrió un error al eliminar el producto')
        return
      }

      setProductos((prev) => prev.filter((p) => p.id_producto !== id_producto))
      setError('')
    } catch {
      setError('Sin conexión al intentar eliminar el producto.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.nombre.trim() || !form.precioCosto || !form.stock_minimo || !form.id_categoria) {
      setError('Todos los campos marcados con (*) son obligatorios')
      return
    }

    if (Number(form.precioCosto) < 0 || Number(form.stock_minimo) < 0) {
      setError('El precio y el stock mínimo deben ser mayores o iguales a 0')
      return
    }

    setCargando(true)
    setError('')

    try {
      const url = editando
        ? `${API_URL}/productos/${editando.id_producto}`
        : `${API_URL}/productos`
      const method = editando ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          precioCosto: parseFloat(form.precioCosto),
          stock_minimo: parseInt(form.stock_minimo),
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
      } else {
        setProductos((prev) => [...prev, data])
      }

      setEditando(null)
      setForm({ nombre: '', precioCosto: '', stock_minimo: '', codigo_barras: '', id_categoria: '' })

    } catch {
      setError('Sin conexión. Verificá tu conexión e intentá de nuevo')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src={logo} alt="Stokkeo" className="h-16" />
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

      <main className="p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-white mb-6">Productos</h2>

        {/* Formulario */}
        <div className="rounded-xl p-6 mb-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-lg font-medium text-white mb-4">
            {editando ? `Editando: ${editando.nombre}` : 'Nuevo Producto'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: '#9ca3af' }}>Nombre *</label>
              <input name="nombre" placeholder="Ej: Yerba Mate 1kg"
                value={form.nombre} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: '#9ca3af' }}>Categoría *</label>
              <select name="id_categoria" value={form.id_categoria} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: '#121218', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="">Seleccionar categoría</option>
                {categorias.map((cat) => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: '#9ca3af' }}>Precio Costo ($) *</label>
              <input type="number" step="0.01" min="0" name="precioCosto" placeholder="0.00"
                value={form.precioCosto} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: '#9ca3af' }}>Stock Mínimo *</label>
              <input type="number" min="0" name="stock_minimo" placeholder="Ej: 5"
                value={form.stock_minimo} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs" style={{ color: '#9ca3af' }}>Código de Barras (Opcional)</label>
              <input name="codigo_barras" placeholder="7791234567890"
                value={form.codigo_barras} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>

            {error && (
              <div className="md:col-span-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <div className="md:col-span-2 mt-2 flex gap-3">
              <button type="submit" disabled={cargando}
                className="px-5 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, #00c6ff, #39ff14)', color: '#0a0a0f' }}>
                {cargando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar Producto'}
              </button>
              {editando && (
                <button type="button" onClick={handleCancelar}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Listado con Filtros */}
        <div className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-medium text-white">Listado de Productos</h3>
            
            {/* BARRA DE BÚSQUEDA Y FILTRO */}
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
                  <option key={cat.id_categoria} value={cat.id_categoria}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ color: '#d1d5db' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                  <th className="py-2.5 px-3 font-medium">Nombre</th>
                  <th className="py-2.5 px-3 font-medium">Categoría</th>
                  <th className="py-2.5 px-3 font-medium">Precio Costo</th>
                  <th className="py-2.5 px-3 font-medium">Stock Mínimo</th>
                  <th className="py-2.5 px-3 font-medium">Cód. Barras</th>
                  <th className="py-2.5 px-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-xs" style={{ color: '#6b7280' }}>
                      {productos.length === 0
                        ? 'No hay productos registrados.'
                        : 'No se encontraron productos que coincidan con la búsqueda.'}
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((p) => (
                    <tr key={p.id_producto}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-3 px-3 font-medium text-white">{p.nombre}</td>
                      <td className="py-3 px-3">{p.categoria?.nombre || '-'}</td>
                      <td className="py-3 px-3">${Number(p.precioCosto).toFixed(2)}</td>
                      <td className="py-3 px-3">{p.stock_minimo}</td>
                      <td className="py-3 px-3" style={{ color: '#6b7280' }}>{p.codigo_barras || '-'}</td>
                      <td className="py-3 px-3 flex gap-2">
                        <button onClick={() => handleEditar(p)}
                          className="text-xs px-3 py-1 rounded-lg"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                          Editar
                        </button>
                        <button onClick={() => handleEliminar(p.id_producto)}
                          className="text-xs px-3 py-1 rounded-lg transition-colors"
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                          Eliminar
                        </button>
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
