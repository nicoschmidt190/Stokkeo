import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Alerta from '../components/Alerta'
import ConfirmDialog from '../components/ConfirmDialog'
import logo from '../assets/logo.png'

export default function Categorias() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  const [categorias, setCategorias] = useState([])
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [cargandoLista, setCargandoLista] = useState(true)

  const [notificacion, setNotificacion] = useState(null)
  const mostrarAlerta = (tipo, mensaje) => setNotificacion({ tipo, mensaje })

  useEffect(() => {
    if (!notificacion) return
    const t = setTimeout(() => setNotificacion(null), 4000)
    return () => clearTimeout(t)
  }, [notificacion])

  const [confirmEliminar, setConfirmEliminar] = useState(null)

  // Conflicto: la categoría tiene productos
  const [conflicto, setConflicto] = useState(null) // { categoria, cantidadProductos }
  const [categoriaDestino, setCategoriaDestino] = useState('')
  const [procesandoAccion, setProcesandoAccion] = useState(null) // null, 'reasignar', 'cascada'

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
      mostrarAlerta('error', 'Error al cargar las categorías')
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => { cargarCategorias() }, [])

  const handleSubmit = async () => {
    if (!nombre) { mostrarAlerta('advertencia', 'El nombre de la categoría no puede estar vacío'); return }
    setCargando(true)
    try {
      const url = editando
        ? `${import.meta.env.VITE_API_URL}/categorias/${editando.id_categoria}`
        : `${import.meta.env.VITE_API_URL}/categorias/`
      const method = editando ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers, body: JSON.stringify({ nombre }) })
      const data = await res.json()
      if (!res.ok) { mostrarAlerta('error', data.detail); return }

      mostrarAlerta('ok', editando ? `"${data.nombre}" actualizada correctamente` : `"${data.nombre}" creada correctamente`)

      setNombre('')
      setEditando(null)
      cargarCategorias()
    } catch {
      mostrarAlerta('error', 'Error de conexión')
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
  }

  const handleEliminar = (cat) => setConfirmEliminar(cat)

  // Motor único de borrado
  const ejecutarEliminacion = async (cat, accion = null, nuevaCategoriaId = null) => {
    if (!cat) return
    setProcesandoAccion(accion || 'inicial')
    try {
      const params = new URLSearchParams()
      if (accion) params.set('accion', accion)
      if (nuevaCategoriaId) params.set('nueva_categoria_id', nuevaCategoriaId)
      const qs = params.toString() ? `?${params.toString()}` : ''

      const url = `${import.meta.env.VITE_API_URL}/categorias/${cat.id_categoria}${qs}`
      const res = await fetch(url, { method: 'DELETE', headers })
      const data = await res.json()

      // 1. Manejo del Conflicto de Productos (Respuesta 409 esperada)
      if (res.status === 409) {
        setConflicto({
          categoria: cat,
          cantidadProductos: data.detail?.cantidad_productos ?? 0
        })
        return
      }

      // 2. Errores reales
      if (!res.ok) {
        const detalle = typeof data.detail === 'string' ? data.detail : 'Ocurrió un error al eliminar la categoría'
        mostrarAlerta('error', detalle)
        return
      }

      // 3. Éxito
      mostrarAlerta(
        'ok',
        accion
          ? `"${cat.nombre}" eliminada — productos ${accion === 'cascada' ? 'eliminados junto con ella' : 'reasignados correctamente'}`
          : `"${cat.nombre}" eliminada correctamente`
      )

      setConflicto(null)
      setCategoriaDestino('')
      cargarCategorias()

    } catch {
      mostrarAlerta('error', 'Error de conexión')
    } finally {
      setProcesandoAccion(null)
    }
  }

  const intentarEliminar = () => {
    const cat = confirmEliminar
    if (!cat) return
    setConfirmEliminar(null)
    ejecutarEliminacion(cat, null, null)
  }

  const confirmarReasignar = () => {
    if (!categoriaDestino) { 
      mostrarAlerta('advertencia', 'Elegí a qué categoría reasignar los productos')
      return 
    }
    if (!conflicto?.categoria) return
    ejecutarEliminacion(conflicto.categoria, 'reasignar', categoriaDestino)
  }

  const confirmarCascada = () => {
    if (!conflicto?.categoria) return
    ejecutarEliminacion(conflicto.categoria, 'cascada', null)
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      <Alerta tipo={notificacion?.tipo} mensaje={notificacion?.mensaje} onCerrar={() => setNotificacion(null)} />

      {/* Confirmación normal de borrado */}
      <ConfirmDialog
        abierto={!!confirmEliminar}
        tipo="error"
        titulo="Eliminar categoría"
        mensaje={confirmEliminar ? `¿Estás seguro que querés eliminar "${confirmEliminar.nombre}"? Esta acción no se puede deshacer.` : ''}
        textoConfirmar="Eliminar"
        onConfirmar={intentarEliminar}
        onCancelar={() => setConfirmEliminar(null)}
      />

      {/* Modal de conflicto */}
      {conflicto && conflicto.categoria && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
          <div className="w-full max-w-md rounded-xl p-6 shadow-lg"
            style={{ background: '#121218', border: '1px solid rgba(234,179,8,0.45)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#facc15' }} className="text-lg">⚠️</span>
              <h3 className="text-white font-medium">No se puede eliminar todavía</h3>
            </div>
            <p className="text-sm mb-5" style={{ color: '#9ca3af' }}>
              "{conflicto.categoria.nombre}" tiene {conflicto.cantidadProductos} producto(s) asociado(s). Elegí qué hacer con ellos:
            </p>

            <div className="mb-4">
              <label className="text-xs mb-1 block" style={{ color: '#9ca3af' }}>Reasignar productos a:</label>
              <div className="flex gap-2">
                <select value={categoriaDestino} onChange={(e) => setCategoriaDestino(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-white focus:outline-none"
                  style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="">Seleccionar categoría</option>
                  {categorias
                    .filter((c) => c.id_categoria !== conflicto.categoria.id_categoria)
                    .map((c) => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                    ))}
                </select>
                <button 
                  onClick={confirmarReasignar} 
                  disabled={!!procesandoAccion}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'linear-gradient(135deg, #00c6ff, #39ff14)', color: '#0a0a0f' }}>
                  {procesandoAccion === 'reasignar' ? 'Reasignando...' : 'Reasignar'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-xs" style={{ color: '#6b7280' }}>o</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <button 
              onClick={confirmarCascada} 
              disabled={!!procesandoAccion}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium mb-3 transition-all"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
              {procesandoAccion === 'cascada' ? 'Eliminando...' : `Eliminar categoría y sus ${conflicto.cantidadProductos} producto(s)`}
            </button>

            <button onClick={() => { setConflicto(null); setCategoriaDestino('') }} disabled={!!procesandoAccion}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
              Cancelar
            </button>
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
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1 rounded-lg px-4 py-2 text-white text-sm focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
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
        </div>

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