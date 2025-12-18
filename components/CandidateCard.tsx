
import React from 'react';
import { ScreeningResult } from '../types';

interface CandidateCardProps {
  result: ScreeningResult;
  onViewDetail: () => void;
  onReject: () => void;
  onShortlist: () => void;
}

const CandidateCard: React.FC<CandidateCardProps> = ({ result, onViewDetail, onReject, onShortlist }) => {
  const isNotMatch = result.recommendation === "Not a Match";

  // Determine colors based on score
  const getScoreColor = (score: number) => {
    if (isNotMatch) return 'text-rose-600';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };
  
  const getRingColor = (score: number) => {
     if (isNotMatch) return 'stroke-rose-500';
     if (score >= 80) return 'stroke-emerald-500';
     if (score >= 50) return 'stroke-amber-500';
     return 'stroke-rose-500';
  }
  
  // Calculations for SVG Circular Progress
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (result.overallMatchScore / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full relative animate-slide-up">
      {/* Top Status Bar Indicator */}
      <div className={`h-1.5 w-full ${isNotMatch ? 'bg-rose-500' : result.overallMatchScore >= 80 ? 'bg-emerald-500' : result.overallMatchScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
      
      <div className="p-6 flex-grow flex flex-col">
        {/* Header Section: Avatar, Name, Score */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-start space-x-4 overflow-hidden">
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 font-bold text-lg border border-slate-200 flex-shrink-0 shadow-sm">
              {result.candidateName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="text-lg font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors truncate" title={result.candidateName}>
                {result.candidateName}
              </h2>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide truncate mt-1" title={result.currentRole}>
                {result.currentRole || "Candidate"}
              </p>
            </div>
          </div>
          
          {/* Refreshing Circular Score Indicator */}
          <div className="relative flex items-center justify-center flex-shrink-0 ml-2">
            <svg width="56" height="56" className="transform -rotate-90">
               {/* Background Circle */}
               <circle
                 cx="28" cy="28" r={radius}
                 stroke="currentColor" strokeWidth="4" fill="transparent"
                 className="text-slate-100"
               />
               {/* Progress Circle */}
               <circle
                 cx="28" cy="28" r={radius}
                 stroke="currentColor" strokeWidth="4" fill="transparent"
                 strokeDasharray={circumference}
                 strokeDashoffset={offset}
                 strokeLinecap="round"
                 className={`${getRingColor(result.overallMatchScore)} transition-all duration-1000 ease-out`}
               />
            </svg>
            <div className="absolute flex flex-col items-center justify-center inset-0">
               <span className={`text-sm font-extrabold ${getScoreColor(result.overallMatchScore)}`}>
                 {result.overallMatchScore}
               </span>
            </div>
          </div>
        </div>

        {/* Explicit Not Match Badge */}
        {isNotMatch && (
            <div className="mb-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Not a Match
                </span>
            </div>
        )}

        {/* Key Info Pills */}
        <div className="flex items-center text-xs text-slate-600 mb-5 space-x-2">
             <div className="flex items-center bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 max-w-[60%] shadow-sm">
                <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span className="truncate">{result.candidateLocation}</span>
             </div>
             <div className="flex items-center bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                <svg className="w-3.5 h-3.5 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <span className="truncate">{result.candidateExperience}</span>
             </div>
        </div>

        {/* Skills Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Top Skills</p>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[4.5rem] overflow-hidden">
            {result.skillsAnalysis
                .sort((a,b) => b.score - a.score)
                .slice(0, 5)
                .map((skill, idx) => (
                  <span key={idx} className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-medium border transition-colors ${skill.score >= 70 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-600 border-slate-200'}`}>
                    {skill.skill}
                  </span>
            ))}
          </div>
        </div>

        {/* Summary Quote */}
        <div className="mt-auto pt-4 border-t border-slate-50">
          <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 italic">
            "{result.candidateSummary}"
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-between">
        <button 
            onClick={onViewDetail}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold uppercase tracking-wide flex items-center transition-colors group-hover:underline decoration-indigo-300 underline-offset-2"
        >
            View Full Analysis
        </button>
        <div className="flex space-x-1">
           <button 
            onClick={onReject}
            className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors" 
            title="Reject Candidate"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
           </button>
           <div className="w-px h-6 bg-slate-200 mx-1 self-center"></div>
           <button 
            onClick={onShortlist}
            className="p-2 rounded-lg transition-colors text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
            title="Shortlist Candidate"
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
           </button>
        </div>
      </div>
    </div>
  );
};

export default CandidateCard;
