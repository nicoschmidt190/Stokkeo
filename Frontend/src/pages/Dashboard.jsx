
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function Dashboard() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [tileHover, setTileHover] = useState(null)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>

      {/* Navbar — encabezado más chico */}
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Stokkeo" className="h-12" />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#6b7280' }}>{usuario?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      {/* Contenido */}
      <main className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white">
            Bienvenido, {usuario?.nombre} 👋
          </h2>
          <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>
            Panel de control de Stokkeo
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { nombre: 'Categorías', descripcion: 'Gestionar categorías', ruta: '/categorias' },
            { nombre: 'Productos', descripcion: 'Gestionar productos', ruta: '/productos' },
            { nombre: 'Stock', descripcion: 'Gestionar stock', ruta: '/stock' },
            { nombre: 'Movimientos', descripcion: 'Gestionar movimientos', ruta: '/movimientos' },
            { nombre: 'Venta rápida', descripcion: 'Salida rápida de stock', ruta: '/venta-rapida' },
            ].map((m, idx) => (
              <div key={m.nombre}
                onClick={() => navigate(m.ruta)}
                onMouseEnter={() => setTileHover(idx)}
                onMouseLeave={() => setTileHover(null)}
                className="rounded-xl p-6 cursor-pointer transition-all duration-200 hover:scale-105"
                style={{
                  background: tileHover === idx ? 'rgba(0, 198, 255, 0.08)' : 'rgba(255,255,255,0.04)',
                  border: tileHover === idx ? '1px solid #00c6ff' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: tileHover === idx ? '0 0 15px rgba(0, 198, 255, 0.15)' : 'none',
                  }}>
              {/* Ícono celeste sólido — es un tile de navegación, no una acción */}
              <div className="w-8 h-8 rounded-lg mb-3"
                style={{ background: 'rgba(0,198,255,0.15)', border: '1px solid rgba(0,198,255,0.35)' }} />
              <h3 className="text-white font-medium">{m.nombre}</h3>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                {m.descripcion}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}