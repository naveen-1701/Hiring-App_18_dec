
import React from 'react';
import { ScreeningResult } from '../types';

interface TableViewProps {
  results: ScreeningResult[];
  onBack: () => void;
}

const TableView: React.FC<TableViewProps> = ({ results, onBack }) => {

  const handleExportCSV = () => {
    // Define headers
    const headers = ["Candidate Name", "Total Experience", "Email", "Contact Number"];
    
    // Create CSV rows
    const csvContent = [
      headers.join(","), // Header row
      ...results.map(r => {
        // Wrap fields in quotes to handle commas within fields
        const name = r.candidateName ? `"${r.candidateName.replace(/"/g, '""')}"` : '""';
        const exp = r.candidateExperience ? `"${r.candidateExperience.replace(/"/g, '""')}"` : '""';
        const email = r.email ? `"${r.email.replace(/"/g, '""')}"` : '""';
        const phone = r.phone ? `"${r.phone.replace(/"/g, '""')}"` : '""';
        
        return [name, exp, email, phone].join(",");
      })
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Candidate_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto pt-8 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
         <div className="flex items-center space-x-4">
            <button onClick={onBack} className="p-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Extracted Candidate Data</h2>
                <p className="text-slate-500 text-sm">Review extracted contact details and experience</p>
            </div>
         </div>
         <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-5 py-2.5 bg-emerald-600 border border-transparent rounded-xl text-sm font-semibold text-white hover:bg-emerald-700 shadow-md transition-all transform hover:-translate-y-0.5"
         >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Export to CSV
         </button>
       </div>

       {/* Table */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate Name</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Experience</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email ID</th>
                   <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Number</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {results.length === 0 ? (
                     <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-slate-500 italic">No candidates found.</td>
                     </tr>
                ) : (
                    results.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-slate-900">{r.candidateName}</div>
                            {r.currentRole && <div className="text-xs text-slate-500 max-w-[200px] truncate">{r.currentRole}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                            {r.candidateExperience}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                            {r.email ? (
                                <a href={`mailto:${r.email}`} className="text-indigo-600 hover:underline">{r.email}</a>
                            ) : (
                                <span className="text-slate-400 italic">N/A</span>
                            )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                             {r.phone || <span className="text-slate-400 italic">N/A</span>}
                        </td>
                    </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
             <span>Showing {results.length} records</span>
             {results.length > 0 && <span className="text-slate-400 italic">Click "Export to CSV" to download detailed data</span>}
          </div>
       </div>
    </div>
  );
};

export default TableView;
