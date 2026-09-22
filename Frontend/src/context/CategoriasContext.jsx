import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'

const CategoriasContext = createContext(null)

// Las categorías casi no cambian, pero Productos, Stock, Movimientos y
// VentaRapida las pedían cada una por su cuenta al entrar. Con wifi
// lento/inestable, cada round-trip extra pesa: este contexto las trae
// una sola vez por sesión y las comparte entre todos los módulos.
export function CategoriasProvider({ children }) {
  const { usuario } = useAuth()
  const [categorias, setCategorias] = useState([])
  const [cargandoCategorias, setCargandoCategorias] = useState(false)
  const yaCargadas = useRef(false)

  const API_URL = import.meta.env.VITE_API_URL

  // forzar=true se usa después de crear/editar/borrar una categoría,
  // para refrescar el cache en vez de esperar a la próxima sesión.
  const cargarCategorias = useCallback(async (forzar = false) => {
    if (yaCargadas.current && !forzar) return
    setCargandoCategorias(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_URL}/categorias`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setCategorias(data)
          yaCargadas.current = true
        }
      }
    } catch (err) {
      console.error('Error al cargar categorías:', err)
    } finally {
      setCargandoCategorias(false)
    }
  }, [API_URL])

  return (
    <CategoriasContext.Provider
      value={{ categorias, cargandoCategorias, cargarCategorias }}
    >
      {children}
    </CategoriasContext.Provider>
  )
}

// useCategorias(): devuelve { categorias, cargandoCategorias, cargarCategorias }
// Llamar cargarCategorias() en un useEffect de montaje es seguro: si ya
// están cargadas, no dispara ningún fetch.
export function useCategorias() {
  return useContext(CategoriasContext)
}