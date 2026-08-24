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
    const [error, setError] = useState('')
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    }

    const cargarCategorias = async () => {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/categorias`, { headers })
        const data = await res.json()
        setCategorias(data)
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
    cargarCategorias()
  } catch {
    setError('Error de conexión')
  }
}
    const handleLogout = () => { logout(); navigate('/login') }

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
            style={{ color: '#9ca3af' }}>Dashboard</button>
          <button onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold text-white mb-6">Categorías</h2>

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
              className="flex-1 rounded-lg px-4 py-2 text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button onClick={handleSubmit} disabled={cargando}
              className="px-5 py-2 rounded-lg font-medium text-sm"
              style={{ background: 'linear-gradient(135deg, #00c6ff, #39ff14)', color: '#0a0a0f' }}>
              {cargando ? '...' : editando ? 'Guardar' : 'Agregar'}
            </button>
            {editando && (
              <button onClick={handleCancelar}
                className="px-4 py-2 rounded-lg text-sm"
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
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                    Editar
                  </button>
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