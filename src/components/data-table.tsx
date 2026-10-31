export function DataTable({
  columns,
  rows,
  empty = "No records found.",
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  return (
    <div className="panel data-table-scroll">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} scope="col" className="px-4 py-3 whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-border border-t">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="text-muted-foreground px-4 py-8 text-center">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
