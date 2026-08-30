export default function PullToRefreshIndicator({
  pulling,
  refreshing,
}: {
  pulling: boolean
  refreshing: boolean
}) {
  if (!pulling && !refreshing) return null
  return (
    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-plum py-2">
      <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
      {refreshing ? 'Actualizando…' : 'Suelta para actualizar'}
    </div>
  )
}
