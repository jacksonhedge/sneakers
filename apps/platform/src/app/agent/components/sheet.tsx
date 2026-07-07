'use client'
export function Sheet({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <>
      <div className="sheet-veil" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="sheet__grab" />
        {children}
      </div>
    </>
  )
}
