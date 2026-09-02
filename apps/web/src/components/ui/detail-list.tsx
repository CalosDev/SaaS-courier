export type DetailListEntry = {
  label: string;
  value: React.ReactNode;
};

export function DetailList({ entries }: { entries: DetailListEntry[] }) {
  return (
    <ul className="detail-list">
      {entries.map((entry) => (
        <li key={entry.label}>
          <span>{entry.label}</span>
          <strong>{entry.value}</strong>
        </li>
      ))}
    </ul>
  );
}
