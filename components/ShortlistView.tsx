
import React, { useMemo } from 'react';
import { ScreeningResult } from '../types';

interface ShortlistViewProps {
  shortlist: ScreeningResult[];
  onRemove: (candidate: ScreeningResult) => void;
  onBack: () => void;
}

const ShortlistView: React.FC<ShortlistViewProps> = ({ shortlist, onRemove, onBack }) => {
  // Calculations for Summary
  const total = shortlist.length;
  const avgScore = total > 0 
    ? Math.round(shortlist.reduce((acc, curr) => acc + curr.overallMatchScore, 0) / total) 
    : 0;
  
  // Aggregate Top Skills using useMemo for performance
  const topSkills = useMemo(() => {
    // Ensure technicalSkills exists (safety check)
    const allSkills = shortlist.flatMap(c => c.technicalSkills || []);
    
    const skillCounts = allSkills.reduce((acc, skill) => {
      if (!skill) return acc; // Skip empty strings
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(skillCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([skill]) => skill);
  }, [shortlist]);

  // Derive unique roles
  const rolesDistribution = useMemo(() => {
    const roles = shortlist.map(c => c.currentRole).filter(Boolean);
    const uniqueRoles = Array.from(new Set(roles));
    return {
        top: uniqueRoles.slice(0, 2),
        count: uniqueRoles.length
    };
  }, [shortlist]);

  const handleExportCSV = () => {
    // Define headers
    const headers = ["Candidate Name", "Role", "Score", "Experience", "Email", "Phone", "Recommendation"];
    
    // Create CSV rows
    const csvContent = [
      headers.join(","), // Header row
      ...shortlist.map(c => {
        // Handle fields that might contain commas
        const name = `"${(c.candidateName || '').replace(/"/g, '""')}"`;
        const role = `"${(c.currentRole || '').replace(/"/g, '""')}"`;
        const exp = `"${(c.candidateExperience || '').replace(/"/g, '""')}"`;
        const email = `"${c.email || ''}"`;
        const phone = `"${c.phone || ''}"`;
        const recommendation = `"${c.recommendation || ''}"`;
        
        return [name, role, c.overallMatchScore, exp, email, phone, recommendation].join(",");
      })
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Shortlist_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareEmail = () => {
      const subject = "Shortlisted Candidates Report";
      const body = shortlist.map(c => 
          `Candidate: ${c.candidateName}\nRole: ${c.currentRole}\nMatch Score: ${c.overallMatchScore}%\nRecommendation: ${c.recommendation}\nEmail: ${c.email || 'N/A'}\n`
      ).join("\n--------------------------------\n");
      
      const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("Here is the summary of shortlisted candidates:\n\n" + body)}`;
      window.location.href = mailtoLink;
  };

  return (
    <div className="max-w-7xl mx-auto pt-8 pb-16 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4 w-full md:w-auto">
            <button onClick={onBack} className="p-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Shortlisted Candidates</h2>
                <div className="flex items-center space-x-2 mt-1">
                    <p className="text-slate-500 text-sm">Review and manage your top picks</p>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                        {total}
                    </span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button 
                onClick={handleShareEmail}
                className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                Share Report
            </button>
            <button 
                onClick={handleExportCSV}
                className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95"
            >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export Excel
            </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Total & Avg Score */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
             <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Match Score</p>
                <div className="flex items-baseline mt-2">
                    <span className="text-3xl font-bold text-slate-900">{avgScore}</span>
                    <span className="text-sm text-slate-400 ml-1">/100</span>
                </div>
             </div>
             <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
             </div>
        </div>

        {/* Card 2: Roles Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Roles Distribution</p>
             <div className="flex flex-col space-y-2">
                 {rolesDistribution.top.map((role, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-slate-700 font-medium truncate max-w-[180px]">{role}</span>
                        <span className="text-slate-400">{shortlist.filter(c => c.currentRole === role).length}</span>
                    </div>
                 ))}
                 {rolesDistribution.count > 2 && (
                    <div className="text-xs text-slate-400 italic mt-1">+ {rolesDistribution.count - 2} more roles</div>
                 )}
                 {rolesDistribution.count === 0 && (
                     <span className="text-slate-400 text-sm italic">No data available</span>
                 )}
             </div>
        </div>

        {/* Card 3: Top Skills */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Top Skills in Pool</p>
             <div className="flex flex-wrap gap-2">
                {topSkills.map((skill, idx) => (
                    <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-100">
                        {skill}
                    </span>
                ))}
                {topSkills.length === 0 && <span className="text-slate-400 text-sm italic">No skills analyzed yet</span>}
             </div>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Current Role</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Experience</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {shortlist.length === 0 ? (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center">
                            <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            <p className="text-lg font-medium text-slate-900">No candidates shortlisted yet</p>
                            <p className="text-sm">Go back to the screening results to add candidates.</p>
                        </div>
                    </td>
                </tr>
              ) : (
                shortlist.map((candidate, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200 mr-3">
                            {candidate.candidateName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{candidate.candidateName}</div>
                            <div className="text-xs text-slate-500">{candidate.candidateLocation}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700 font-medium">{candidate.currentRole}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${candidate.overallMatchScore >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {candidate.overallMatchScore}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {candidate.candidateExperience}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col text-sm text-slate-600">
                             {candidate.email && <a href={`mailto:${candidate.email}`} className="hover:text-indigo-600 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>{candidate.email}</a>}
                             {candidate.phone && <span className="flex items-center gap-1 mt-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>{candidate.phone}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                            onClick={() => onRemove(candidate)} 
                            className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                            Remove
                        </button>
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ShortlistView;
