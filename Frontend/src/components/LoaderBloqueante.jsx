// Loader bloqueante compartido (Productos, Stock, Movimientos, Comparación).
//
// Por qué son DOS elementos y no uno: antes el spinner estaba centrado
// dentro de un overlay que cubre TODO el listado (30 filas). Con la lista
// larga, el centro del overlay quedaba muy abajo, fuera de la pantalla, y
// se veía la pantalla bloqueada pero sin la ruedita. Ahora el overlay
// sigue tapando el listado (bloquea los clicks) y el spinner va en
// `fixed`, siempre en el centro de lo que el usuario está viendo.
//
// El spinner NO puede ir adentro del overlay: `backdrop-filter` hace que
// un hijo `fixed` se posicione respecto del overlay y no de la pantalla.
//
// Se usa dentro de un contenedor con `position: relative` (el <main>).
export default function LoaderBloqueante({ visible }) {
  if (!visible) return null

  return (
    <>
      <div
        className="absolute inset-0 z-10"
        style={{ background: 'rgba(10,10,15,0.6)', backdropFilter: 'blur(2px)' }}
      />
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          marginTop: '-16px',
          marginLeft: '-16px',
          zIndex: 20,
          borderColor: 'rgba(0,198,255,0.3)',
          borderTopColor: '#00c6ff',
        }}
      />
    </>
  )
}