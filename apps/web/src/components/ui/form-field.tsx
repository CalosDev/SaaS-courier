export function FormField({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="ui-field" htmlFor={htmlFor}>
      <span className="ui-field__label">{label}</span>
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
      {children}
      {error ? <span className="ui-field__error">{error}</span> : null}
    </label>
  );
}
