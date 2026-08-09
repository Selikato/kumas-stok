'use client'

import Button from '@/components/ui/Button'
import ModalFrame from '@/components/ui/ModalFrame'

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: React.ReactNode
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  return (
    <ModalFrame
      open={open}
      title={title}
      subtitle={description}
      onClose={onCancel}
      loading={loading}
      maxWidth="sm"
      footer={
        <div className="flex gap-2.5 justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'İşleniyor…' : confirmLabel}
          </Button>
        </div>
      }
    >
      {danger && (
        <div className="w-10 h-10 rounded-lg bg-danger-soft flex items-center justify-center">
          <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
      )}
      {children}
    </ModalFrame>
  )
}
