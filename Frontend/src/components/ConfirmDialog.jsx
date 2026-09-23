export default function ConfirmDialog({
  abierto, tipo = 'advertencia', titulo, mensaje,
  textoConfirmar = 'Aceptar', textoCancelar = 'Cancelar',
  onConfirmar, onCancelar,
}) {
  if (!abierto) return null

  const estilos = {
    ok:          { borde: 'rgba(16, 185, 129, 0.4)', color: '#34d399', icono: '✓', boton: '#10b981', textoBoton: '#ffffff' },
    advertencia: { borde: 'rgba(234, 179, 8, 0.45)', color: '#facc15', icono: '⚠️', boton: '#eab308', textoBoton: '#0a0a0f' },
    error:       { borde: 'rgba(239, 68, 68, 0.45)', color: '#f87171', icono: '✕', boton: '#ef4444', textoBoton: '#ffffff' },
  }
  const s = estilos[tipo] || estilos.advertencia

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
      <div className="w-full max-w-sm rounded-xl p-6 shadow-lg"
        style={{ background: '#121218', border: `1px solid ${s.borde}` }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: s.color }} className="text-lg">{s.icono}</span>
          <h3 className="text-white font-medium">{titulo}</h3>
        </div>
        <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>{mensaje}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancelar}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
            {textoCancelar}
          </button>
          <button onClick={onConfirmar}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: s.boton, color: s.textoBoton }}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}