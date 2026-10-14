// Encabezado de columna ordenable, compartido por Productos, Stock,
// Movimientos y Comparación de precios.
//
// Antes cada pantalla armaba el <th> a mano con la flecha como texto
// suelto al lado del título. Con columnas angostas la flecha se caía a la
// línea de abajo ("Fecha y Hora" / "↓") y desalineaba toda la fila de
// títulos.
//
// Acá la flecha va SIEMPRE pegada a la última palabra del título (juntas
// no se pueden separar), y la flecha ocupa siempre el mismo ancho para que
// el encabezado no "salte" al cambiar entre ⇅, ↑ y ↓. Si la columna es muy
// angosta, el título se parte entre palabras ("Stock" / "Mínimo ⇅"), pero
// la flecha nunca queda sola en una línea.
export default function ThOrdenable({ columna, orden, onCambiarOrden, children, className = '', style }) {
  const activa = orden.columna === columna
  const asc = orden.direccion === 'asc'

  const texto = typeof children === 'string' ? children : ''
  const palabras = texto.split(' ')
  const ultima = texto ? palabras.pop() : null
  const inicio = texto ? palabras.join(' ') : null

  const flecha = (
    <span
      className={`inline-block w-3 ml-1 text-center ${activa ? 'text-cyan-400 text-xs font-bold' : 'text-gray-600 text-[10px]'}`}
    >
      {activa ? (asc ? '↑' : '↓') : '⇅'}
    </span>
  )

  return (
    <th
      onClick={() => onCambiarOrden(columna)}
      aria-sort={activa ? (asc ? 'ascending' : 'descending') : 'none'}
      className={`py-2.5 px-3 font-medium cursor-pointer hover:text-white select-none ${className}`}
      style={style}
    >
      <span>
        {inicio ? `${inicio} ` : null}
        <span className="whitespace-nowrap">
          {texto ? ultima : children}
          {flecha}
        </span>
      </span>
    </th>
  )
}