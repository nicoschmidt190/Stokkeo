import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

function BadgeEstado({ estado }) {
  const estilos = {
    ok: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', texto: 'OK' },
    bajo: { background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#fb923c', texto: 'Stock bajo' },
    sin_stock: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', texto: 'Sin stock' },
  }
  const s = estilos[estado] || estilos.ok

  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ background: s.background, border: s.border, color: s.color }}>
      {s.texto}
    </span>
  )
}

export default function Stock() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [stock, setStock] = useState([])
  const [error, setError] = useState('')

  const token = localStorage.getItem('token')
  const API_URL = import.meta.env.VITE_API_URL

  const cargarStock = async () => {
    try {
      const res = await fetch(`${API_URL}/stock`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setStock(await res.json())
      else setError('No se pudo cargar el stock')
    } catch {
      setError('Sin conexión al cargar el stock')
    }
  }

  useEffect(() => { cargarStock() }, [])

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
        <h2 className="text-2xl font-semibold text-white mb-6">Stock</h2>

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            {error}
          </div>
        )}

        <div className="rounded-xl p-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-lg font-medium text-white mb-6">Listado de Stock</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ color: '#d1d5db' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                  <th className="py-2.5 px-3 font-medium">Producto</th>
                  <th className="py-2.5 px-3 font-medium">Categoría</th>
                  <th className="py-2.5 px-3 font-medium">Cantidad</th>
                  <th className="py-2.5 px-3 font-medium">Mínimo</th>
                  <th className="py-2.5 px-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-xs" style={{ color: '#6b7280' }}>
                      No hay productos con stock registrado.
                    </td>
                  </tr>
                ) : (
                  stock.map((s) => (
                    <tr key={s.id_producto} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-3 px-3 font-medium text-white">{s.nombre}</td>
                      <td className="py-3 px-3">{s.categoria?.nombre || '-'}</td>
                      <td className="py-3 px-3">{s.cantidad}</td>
                      <td className="py-3 px-3">{s.stock_minimo}</td>
                      <td className="py-3 px-3"><BadgeEstado estado={s.estado} /></td>
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