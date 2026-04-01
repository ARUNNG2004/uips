import React from 'react';
import { Database } from 'lucide-react';

const Table = ({ columns, data = [], loading = false, emptyMessage = "NO RECORDS FOUND" }) => {
  return (
    <div className="w-full overflow-x-auto rounded-lg">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#0f1629]">
          <tr>
             {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className="px-6 py-4 text-xs font-mono font-bold tracking-widest text-[#64748b] uppercase sticky top-0 border-b border-[#1e2d4a]"
                >
                  {col.header || col.label}
                </th>
             ))}
          </tr>
        </thead>
        <tbody className="bg-[#151d35] divide-y divide-[#1e2d4a]">
           {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                 <tr key={`sk-${i}`}>
                    {columns.map((_, j) => (
                       <td key={`skc-${j}`} className="px-6 py-4">
                          <div className="h-4 bg-[#1e2d4a] rounded w-3/4 animate-pulse"></div>
                       </td>
                    ))}
                 </tr>
              ))
           ) : data.length === 0 ? (
              <tr>
                 <td colSpan={columns.length} className="px-6 py-12 text-center text-[#64748b] italic">
                    <div className="flex flex-col items-center justify-center opacity-50">
                       <Database className="w-12 h-12 mb-3" strokeWidth={1} />
                       <span className="font-mono tracking-widest text-sm">{emptyMessage}</span>
                    </div>
                 </td>
              </tr>
           ) : (
              data.map((row, i) => (
                 <tr 
                   key={row.id || i}
                   className="hover:bg-[#1e2d4a]/30 transition-colors odd:bg-transparent even:bg-[#0f1629]/30"
                 >
                    {columns.map((col, j) => (
                       <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-[#f1f5f9]">
                          {col.render ? col.render(row) : row[col.accessor || col.key]}
                       </td>
                    ))}
                 </tr>
              ))
           )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
