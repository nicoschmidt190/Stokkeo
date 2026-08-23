import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import logo from '../assets/logo.png'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Completá todos los campos para continuar')
      return
    }
    setCargando(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      if (res.status === 401) { setError('Usuario o contraseña incorrectos'); return }
      if (!res.ok) { setError('Sin conexión. Verificá tu conexión e intentá de nuevo'); return }
      const data = await res.json()
      login(data.access_token, data.nombre, form.email)
      navigate('/dashboard')
    } catch {
      setError('Sin conexión. Verificá tu conexión e intentá de nuevo')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0f0a 100%)' }}>

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00c6ff 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #39ff14 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Logo y título */}
        <div className="text-center mb-10">
          <img 
              src="/src/assets/logo.png" 
              alt="Stokkeo" 
              className="h-22 mx-auto mb-2"
          />
          <p className="text-sm mt-2" style={{ color: '#6b7280' }}>Gestión de stock inteligente</p>
        </div>

        {/* Card del formulario */}
        <div className="rounded-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>

          <h2 className="text-white text-xl font-semibold mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" style={{ color: '#9ca3af' }}>Email</label>
              <Input
                type="email"
                name="email"
                placeholder="tucorreo@email.com"
                value={form.email}
                onChange={handleChange}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '10px 14px',
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" style={{ color: '#9ca3af' }}>Contraseña</label>
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '10px 14px',
                }}
              />
            </div>

            {error && (
              <div className="text-sm px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || !form.email || !form.password}
              className="w-full py-3 rounded-xl font-semibold text-white mt-1 transition-all duration-200"
              style={{
                background: (!form.email || !form.password || cargando)
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #00c6ff, #39ff14)',
                cursor: (!form.email || !form.password || cargando) ? 'not-allowed' : 'pointer',
                color: (!form.email || !form.password || cargando) ? '#6b7280' : '#0a0a0f',
              }}>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}