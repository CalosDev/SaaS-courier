export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return <div className="ui-state">{label}</div>;
}
