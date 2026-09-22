import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Categorias() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  const [categorias, setCategorias] = useState([])
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [error, setError] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  const cargarCategorias = async () => {
    setCargandoLista(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/categorias`, { headers })
      const data = await res.json()
      setCategorias(data)
    } catch {
      setError('Error al cargar las categorías')
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => { cargarCategorias() }, [])

  const handleSubmit = async () => {
    setError('')
    if (!nombre) { setError('El nombre de la categoría no puede estar vacío'); return }
    setCargando(true)
    try {
      const url = editando
        ? `${import.meta.env.VITE_API_URL}/categorias/${editando.id_categoria}`
        : `${import.meta.env.VITE_API_URL}/categorias/`
      const method = editando ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers, body: JSON.stringify({ nombre }) })
      const data = await res.json()
      if (!res.ok) { setError(data.detail); return }

      setMensajeExito(editando ? `"${data.nombre}" actualizada correctamente` : `"${data.nombre}" creada correctamente`)
      setTimeout(() => setMensajeExito(''), 4000)

      setNombre('')
      setEditando(null)
      cargarCategorias()
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  const handleEditar = (cat) => {
    setEditando(cat)
    setNombre(cat.nombre)
    setError('')
  }

  const handleCancelar = () => {
    setEditando(null)
    setNombre('')
    setError('')
  }

  const handleEliminar = async (cat) => {
    const confirmar = window.confirm(`¿Estás seguro que querés eliminar "${cat.nombre}"? Esta acción no se puede deshacer.`)
    if (!confirmar) return
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/categorias/${cat.id_categoria}`, {
        method: 'DELETE',
        headers
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail); return }

      setMensajeExito(`"${cat.nombre}" eliminada correctamente`)
      setTimeout(() => setMensajeExito(''), 4000)

      cargarCategorias()
    } catch {
      setError('Error de conexión')
    }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <img src={logo} alt="Stokkeo" className="h-12" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ color: '#9ca3af' }}>Dashboard</button>
          <button onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-2xl mx-auto relative">
        {cargandoLista && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(2px)' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'rgba(0,198,255,0.3)', borderTopColor: '#00c6ff' }} />
          </div>
        )}

        <h2 className="text-xl font-semibold text-white mb-4">Categorías</h2>

        {mensajeExito && (
          <div className="mb-4 text-xs px-4 py-3 rounded-lg flex items-center justify-between"
            style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
            <span>✓ {mensajeExito}</span>
            <button onClick={() => setMensajeExito('')} className="text-xs hover:opacity-75 ml-2 text-emerald-400">✕</button>
          </div>
        )}

        {/* Formulario */}
        <div className="rounded-xl p-6 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-white font-medium mb-4">
            {editando ? `Editando: ${editando.nombre}` : 'Nueva categoría'}
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Nombre de la categoría"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1 rounded-lg px-4 py-2 text-white text-sm focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            {/* Botón sólido verde: confirmar/guardar */}
            <button onClick={handleSubmit} disabled={cargando}
              className="px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #00c6ff, #39ff14)', color: '#0a0a0f' }}>
              {cargando && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'rgba(10,10,15,0.3)', borderTopColor: '#0a0a0f' }} />
              )}
              {cargando ? '...' : editando ? 'Guardar' : 'Agregar'}
            </button>
            {editando && (
              <button onClick={handleCancelar}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                Cancelar
              </button>
            )}
          </div>
          {error && (
            <p className="text-sm mt-3" style={{ color: '#f87171' }}>{error}</p>
          )}
        </div>

        {/* Listado */}
        <div className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {categorias.length === 0 ? (
            <div className="p-8 text-center" style={{ color: '#6b7280' }}>
              No hay categorías creadas todavía
            </div>
          ) : (
            categorias.map((cat, i) => (
              <div key={cat.id_categoria}
                className="flex items-center justify-between px-5 py-4"
                style={{
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                  borderBottom: i < categorias.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                <span className="text-white text-sm">{cat.nombre}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleEditar(cat)}
                    className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'rgba(0,198,255,0.1)', border: '1px solid rgba(0,198,255,0.3)', color: '#00c6ff' }}>
                    Editar
                  </button>
                  {/* Botón sólido rojo: eliminar */}
                  <button onClick={() => handleEliminar(cat)}
                    className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}