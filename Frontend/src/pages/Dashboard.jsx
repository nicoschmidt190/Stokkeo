import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-lg">Stokkeo</h1>
        <div className="flex items-center gap-4">
          <span className="text-zinc-400 text-sm">{usuario?.email}</span>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="text-sm"
          >
            Cerrar sesión
          </Button>
        </div>
      </nav>
      <main className="p-8">
        <h2 className="text-white text-xl font-semibold">
          Bienvenido, {usuario?.nombre}
        </h2>
        <p className="text-zinc-400 mt-2">El dashboard está en construcción.</p>
      </main>
    </div>
  )
}