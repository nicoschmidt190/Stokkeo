import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

      if (res.status === 401) {
        setError('Usuario o contraseña incorrectos')
        return
      }

      if (!res.ok) {
        setError('Sin conexión. Verificá tu conexión e intentá de nuevo')
        return
      }

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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Stokkeo</h1>
          <p className="text-zinc-400 mt-2">Ingresá a tu cuenta</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 text-sm">Email</label>
                <Input
                  type="email"
                  name="email"
                  placeholder="tucorreo@email.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 text-sm">Contraseña</label>
                <Input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                />
              </div>

              {error && (
                <div className="bg-red-950 border border-red-800 text-red-400 text-sm px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={cargando}
                className="bg-green-700 hover:bg-green-600 text-white mt-2"
              >
                {cargando ? 'Ingresando...' : 'Ingresar'}
              </Button>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}