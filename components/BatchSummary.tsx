
import React, { useState } from 'react';
import { ScreeningResult } from '../types';

interface BatchSummaryProps {
  results: ScreeningResult[];
  onViewDetail: (index: number) => void;
}

const BatchSummary: React.FC<BatchSummaryProps> = ({ results, onViewDetail }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calculations
  const total = results.length;
  const avgScore = total > 0 ? Math.round(results.reduce((acc, curr) => acc + curr.overallMatchScore, 0) / total) : 0;
  
  // Sort by score descending for ranking
  const sortedResults = [...results].map((r, i) => ({ ...r, originalIndex: i })).sort((a, b) => b.overallMatchScore - a.overallMatchScore);
  const bestMatch = sortedResults[0];

  // Pagination for Table
  const totalPages = Math.ceil(sortedResults.length / itemsPerPage);
  const paginatedResults = sortedResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Distribution stats
  const distribution = {
    strong: results.filter(r => r.recommendation === 'Strong Match').length,
    potential: results.filter(r => r.recommendation === 'Potential Match').length,
    weak: results.filter(r => r.recommendation === 'Weak Match').length,
    noMatch: results.filter(r => r.recommendation === 'Not a Match').length,
  };

  const getBadgeColor = (rec: string) => {
    switch(rec) {
      case 'Strong Match': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Potential Match': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Weak Match': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-rose-100 text-rose-800 border-rose-200';
    }
  };

  return (
    <div className="space-y-6 mb-12 animate-fade-in-down">
      
      {/* Header */}
      <div className="flex items-center space-x-2">
        <div className="bg-indigo-100 p-2 rounded-lg">
             <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
        </div>
        <div>
            <h2 className="text-xl font-bold text-slate-900">Batch Analysis Summary</h2>
            <p className="text-sm text-slate-500">Overview of the current candidate pool</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Candidates */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Candidates</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{total}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Match Score</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{avgScore}%</p>
          </div>
          <div className={`p-3 rounded-full ${avgScore >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          </div>
        </div>

        {/* Top Pick */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Candidate</p>
            {bestMatch ? (
                <>
                    <p className="text-xl font-bold text-slate-900 mt-2 truncate" title={bestMatch.candidateName}>{bestMatch.candidateName}</p>
                    <p className="text-sm text-emerald-600 font-bold mt-1">{bestMatch.overallMatchScore}% Match</p>
                </>
            ) : (
                <p className="text-slate-400 mt-2 text-sm italic">No data available</p>
            )}
          </div>
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 flex-shrink-0 group-hover:scale-110 transition-transform">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
           <h3 className="font-bold text-slate-800">Candidate Ranking</h3>
           <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">Sorted by Match Score</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rank</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role & Exp.</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Recommendation</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Match Score</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedResults.map((result, idx) => {
                const rank = (currentPage - 1) * itemsPerPage + idx + 1;
                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-bold">#{rank}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 mr-3 border border-slate-200">
                              {result.candidateName.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{result.candidateName}</div>
                            <div className="text-xs text-slate-500 flex items-center mt-0.5">
                                <svg className="w-3 h-3 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                {result.candidateLocation}
                            </div>
                          </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-700">{result.currentRole}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{result.candidateExperience}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-4 font-bold rounded-md border ${getBadgeColor(result.recommendation)}`}>
                        {result.recommendation}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-bold text-slate-900 w-8 text-right mr-3">{result.overallMatchScore}%</span>
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-500 ${result.overallMatchScore >= 80 ? 'bg-emerald-500' : result.overallMatchScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${result.overallMatchScore}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => onViewDetail(result.originalIndex)}
                        className="text-indigo-600 hover:text-indigo-900 font-bold hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Table Pagination Controls */}
        {totalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between border-t border-slate-200 bg-slate-50">
                <div className="text-xs text-slate-500 font-medium">
                    Showing <span className="font-bold text-slate-700">{Math.min((currentPage - 1) * itemsPerPage + 1, total)}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, total)}</span> of <span className="font-bold text-slate-700">{total}</span> candidates
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                    >
                        Previous
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        )}
      </div>

    </div>
  );
};

export default BatchSummary;
