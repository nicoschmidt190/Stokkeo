import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Categorias from './pages/Categorias'

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return null
  return usuario ? children : <Navigate to="/login" />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<RutaProtegida><Dashboard /></RutaProtegida>} />
      <Route path="/categorias" element={<RutaProtegida><Categorias /></RutaProtegida>} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}