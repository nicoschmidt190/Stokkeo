import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const nombre = localStorage.getItem('nombre')
    const email = localStorage.getItem('email')
    if (token) {
      setUsuario({ token, nombre, email })
    }
    setCargando(false)
  }, [])

  const login = (token, nombre, email) => {
    localStorage.setItem('token', token)
    localStorage.setItem('nombre', nombre)
    localStorage.setItem('email', email)
    setUsuario({ token, nombre, email })
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('nombre')
    localStorage.removeItem('email')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}