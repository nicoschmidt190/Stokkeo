export default function Alerta({ tipo = 'info', mensaje, onCerrar, accion }) {
  if (!mensaje) return null

  const estilos = {
    ok:          { bg: '#0f2e22', borde: 'rgba(16, 185, 129, 0.4)', color: '#34d399', icono: '✓' },
    advertencia: { bg: '#3a3410', borde: 'rgba(234, 179, 8, 0.45)', color: '#facc15', icono: '⚠️' },
    error:       { bg: '#3a1414', borde: 'rgba(239, 68, 68, 0.45)', color: '#f87171', icono: '✕' },
    info:        { bg: '#1a1a22', borde: 'rgba(255,255,255,0.2)', color: '#d1d5db', icono: 'ℹ️' },
  }
  const s = estilos[tipo] || estilos.info

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <div className="p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-lg"
        style={{ background: s.bg, border: `1px solid ${s.borde}`, color: s.color }}>
        <span>{s.icono} {mensaje}</span>
        <div className="flex items-center gap-3 ml-4">
          {accion && (
            <button onClick={accion.onClick}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: 'rgba(0,198,255,0.15)', border: '1px solid rgba(0,198,255,0.4)', color: '#00c6ff' }}>
              {accion.label}
            </button>
          )}
          <button onClick={onCerrar} className="text-xs hover:opacity-75 font-semibold">Cerrar</button>
        </div>
      </div>
    </div>
  )
}