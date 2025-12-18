import React from 'react';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  resumeText: string;
}

const ResumeModal: React.FC<ResumeModalProps> = ({ isOpen, onClose, candidateName, resumeText }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
             <h3 className="text-lg font-bold text-slate-800">Resume Preview</h3>
             <p className="text-sm text-slate-500">{candidateName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white">
          <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 leading-relaxed max-w-none">
            {resumeText || "No text content extracted from this resume."}
          </pre>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeModal;