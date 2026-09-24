import { useState, useEffect } from 'react'

// Devuelve `value` recién después de que pasen `delay` ms sin que cambie.
// Así "coca cola" no dispara 9 requests (uno por letra) sino 1, apenas
// el usuario deja de tipear. Clave con wifi inestable: menos requests
// disparados a lo loco, menos chance de que alguno se cuelgue o pise a otro.
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}