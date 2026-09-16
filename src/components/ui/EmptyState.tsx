interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-night-700 bg-night-900/40 px-6 py-16 text-center">
      {icon && <div className="text-night-500">{icon}</div>}
      <h3 className="font-display text-xl text-night-200">{title}</h3>
      {description && (
        <p className="max-w-md text-sm leading-relaxed text-night-400">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}