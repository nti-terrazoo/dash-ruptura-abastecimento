import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  align?: "left" | "right";
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Mostra o "#" de ranking na primeira coluna (1, 2, 3, ...). */
  showRank?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  onRowClick,
  emptyMessage = "Sem dados para esta seleção.",
  showRank = false,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <table className={styles.tbl}>
      <thead>
        <tr>
          {showRank && <th style={{ width: 28 }}>#</th>}
          {columns.map((col) => (
            <th key={col.key} className={col.align === "right" ? styles.alignRight : undefined}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={keyExtractor(row, index)}
            className={onRowClick ? styles.clickable : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {showRank && <td className={styles.rank}>{String(index + 1).padStart(2, "0")}</td>}
            {columns.map((col) => (
              <td key={col.key} className={col.align === "right" ? styles.alignRight : undefined}>
                {col.render(row, index)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
