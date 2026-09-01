import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
export default function Dashboard() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>

      {/* Navbar */}
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
            src="/src/assets/logo.png"
            alt="Stokkeo"
            className="h-16"
            />
          </div>
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: '#6b7280' }}>{usuario?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-all duration-200"
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

        {/* Placeholder módulos */}
<div className="grid grid-cols-3 gap-4">
  {[
    { nombre: 'Categorías', descripcion: 'Gestionar categorías', ruta: '/categorias' },
    { nombre: 'Productos', descripcion: 'Gestiar productos', ruta: '/productos' },
    { nombre: 'Stock', descripcion: 'Gestionar stock', ruta: '/stock' },
    { nombre: 'Movimientos', descripcion: 'Gestionar movimientos', ruta: '/movimientos' },
    { nombre: 'Venta rápida', descripcion: 'En construcción', ruta: '/venta-rapida' },
    { nombre: 'Dashboard', descripcion: 'En construcción', ruta: '/dashboard' },
  ].map(m => (
    <div key={m.nombre}
      onClick={() => navigate(m.ruta)}
      className="rounded-xl p-6 cursor-pointer transition-all duration-200 hover:scale-105"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="w-8 h-8 rounded-lg mb-3"
        style={{ background: 'linear-gradient(135deg, #00c6ff22, #39ff1422)', border: '1px solid rgba(57,255,20,0.2)' }} />
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