
import React, { useState, useEffect } from 'react';
import { FileInput, JobDescriptionMode, ScreeningResult, AiProvider, AI_MODELS, SavedJobDescription } from './types';
import FileUpload from './components/FileUpload';
import CandidateCard from './components/CandidateCard';
import ResultsView from './components/ResultsView';
import BatchSummary from './components/BatchSummary';
import TableView from './components/TableView';
import SharePointPicker from './components/SharePointPicker';
import ShortlistView from './components/ShortlistView';
import { screenResume } from './services/geminiService';

type ViewState = 'INPUT' | 'CARD' | 'DETAIL' | 'TABLE' | 'SHORTLIST';
type UploadSource = 'LOCAL' | 'SHAREPOINT';

const App: React.FC = () => {
  // Navigation State
  const [view, setView] = useState<ViewState>('INPUT');

  // Input State
  const [uploadSource, setUploadSource] = useState<UploadSource>('LOCAL');
  const [resumes, setResumes] = useState<FileInput[]>([]);
  const [jdMode, setJdMode] = useState<JobDescriptionMode>(JobDescriptionMode.TEXT);
  const [jdTitle, setJdTitle] = useState<string>('');
  const [jdText, setJdText] = useState<string>('');
  const [jdFile, setJdFile] = useState<FileInput>({ file: null, base64: null, mimeType: '' });
  
  // Saved JDs State
  const [savedJDs, setSavedJDs] = useState<SavedJobDescription[]>([]);
  const [selectedSavedJDId, setSelectedSavedJDId] = useState<string>("");
  
  // Shortlist State
  const [shortlist, setShortlist] = useState<ScreeningResult[]>([]);

  // Settings State
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS.gemini[0].id);

  // Process State
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("Initializing...");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);
  
  // Pagination State (Global)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;
  
  // Load Saved JDs on Mount
  useEffect(() => {
    const loaded = localStorage.getItem('resumeai_saved_jds');
    if (loaded) {
      try {
        setSavedJDs(JSON.parse(loaded));
      } catch (e) {
        console.error("Failed to parse saved JDs", e);
      }
    }
  }, []);

  // Handle provider change to reset model
  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    // Set default model for the new provider
    setSelectedModel(AI_MODELS[newProvider][0].id);
  };

  // Helper to check environment status based on provider
  const isSystemReady = () => {
      if (provider === 'gemini') return !!process.env.API_KEY;
      if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
      return false;
  };

  // Fake progress animation
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setProgress((prev) => {
          return prev < 95 ? prev + (Math.random() * 2) : prev;
        });
      }, 300);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSaveJD = () => {
    if (!jdText.trim()) {
      alert("Please enter Job Description text to save.");
      return;
    }
    if (!jdTitle.trim()) {
      alert("Please enter a Job Title (e.g. 'Senior React Developer') before saving.");
      return;
    }

    const newJD: SavedJobDescription = {
      id: Date.now().toString(),
      title: jdTitle.trim(),
      content: jdText,
      date: new Date().toLocaleDateString()
    };

    const updated = [newJD, ...savedJDs];
    setSavedJDs(updated);
    localStorage.setItem('resumeai_saved_jds', JSON.stringify(updated));
    setSelectedSavedJDId(newJD.id);
  };

  const handleSelectSavedJD = (id: string) => {
    setSelectedSavedJDId(id);
    if (!id) return;
    const jd = savedJDs.find(j => j.id === id);
    if (jd) {
      setJdText(jd.content);
      setJdTitle(jd.title);
      setJdMode(JobDescriptionMode.TEXT);
    }
  };

  const handleDeleteSavedJD = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm("Delete this saved Job Description?")) {
          const updated = savedJDs.filter(j => j.id !== id);
          setSavedJDs(updated);
          localStorage.setItem('resumeai_saved_jds', JSON.stringify(updated));
          if (selectedSavedJDId === id) {
              setSelectedSavedJDId("");
              setJdTitle("");
              setJdText("");
          }
      }
  };

  const handleScreening = async () => {
    if (resumes.length === 0) {
      setError("Please upload or import at least one resume.");
      return;
    }
    if (jdMode === JobDescriptionMode.TEXT && !jdText.trim()) {
      setError("Please enter the Job Description text.");
      return;
    }
    if (jdMode === JobDescriptionMode.FILE && !jdFile.file) {
      setError("Please upload a Job Description file.");
      return;
    }

    setLoading(true);
    setError(null);
    const newResults: ScreeningResult[] = [];
    const failedFiles: string[] = [];

    try {
      // Loop through all uploaded resumes
      for (let i = 0; i < resumes.length; i++) {
        const currentResume = resumes[i];
        const fileName = currentResume.file?.name || `Resume ${i+1}`;

        setLoadingStatus(`Processing ${i + 1} of ${resumes.length}: ${fileName}`);
        
        try {
            // Screening
            const analysis = await screenResume(
              currentResume, 
              jdText, 
              jdMode === JobDescriptionMode.FILE ? jdFile : null,
              selectedModel,
              provider
            );
            newResults.push(analysis);

        } catch (e) {
            console.error(e);
            failedFiles.push(`${fileName} (${(e as Error).message})`);
        }
      }
      
      setLoadingStatus("Finalizing reports...");
      
      if (newResults.length === 0 && failedFiles.length > 0) {
          throw new Error(`Failed to process all resumes. Issues:\n${failedFiles.join('\n')}`);
      }
      
      if (newResults.length === 0) {
         throw new Error("No results generated.");
      }

      setTimeout(() => {
        setResults(newResults);
        setCurrentPage(1); // Reset to first page
        setLoading(false);
        setView('CARD');
        if (failedFiles.length > 0) {
             alert(`Completed with issues.\nFailed to process:\n- ${failedFiles.join('\n- ')}`);
        }
      }, 500);

    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An unexpected error occurred during screening.");
    }
  };

  const handleReset = () => {
    setResults([]);
    setResumes([]);
    setSelectedResultIndex(null);
    setCurrentPage(1);
    setJdText('');
    setJdTitle('');
    setJdFile({ file: null, base64: null, mimeType: '' });
    setError(null);
    setProgress(0);
    setView('INPUT');
  };

  const handleRemoveResume = (index: number) => {
    setResumes(prev => prev.filter((_, i) => i !== index));
  };

  const handleReject = (index: number) => {
      if(confirm("Are you sure you want to reject this candidate?")) {
        // Remove from results list
        setResults(prev => prev.filter((_, i) => i !== index));
        // If we were viewing details, go back to card view
        if (view === 'DETAIL' && selectedResultIndex === index) {
            setView('CARD');
            setSelectedResultIndex(null);
        }
      }
  };

  const handleShortlist = (candidate: ScreeningResult) => {
      setShortlist(prev => {
          const exists = prev.some(c => c.candidateName === candidate.candidateName && c.email === candidate.email);
          if (exists) {
              alert(`${candidate.candidateName} is already shortlisted.`);
              return prev;
          }
          // Optional: Add visual feedback toast here
          alert(`${candidate.candidateName} added to shortlist!`);
          return [...prev, candidate];
      });
  };

  const handleRemoveFromShortlist = (candidate: ScreeningResult) => {
      if (confirm(`Remove ${candidate.candidateName} from shortlist?`)) {
          setShortlist(prev => prev.filter(c => c !== candidate));
      }
  };

  const selectedResult = selectedResultIndex !== null ? results[selectedResultIndex] : null;

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentResults = results.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(results.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Enhanced Navbar */}
      {view !== 'DETAIL' && (
        <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
                <div className="flex items-center">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl mr-3 shadow-lg shadow-indigo-200">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">ResumeAI</h1>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Screener</span>
                    </div>
                </div>
                
                <div className="flex items-center space-x-6">
                    {/* Shortlist Button */}
                    <button 
                        onClick={() => setView('SHORTLIST')}
                        className={`flex items-center text-sm font-semibold transition-colors ${view === 'SHORTLIST' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
                    >
                        Shortlist
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs transition-colors ${shortlist.length > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                            {shortlist.length}
                        </span>
                    </button>

                    {/* Environment Check */}
                    <div className={`flex items-center px-3 py-1 rounded-full text-xs font-medium border ${isSystemReady() ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                         <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isSystemReady() ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {isSystemReady() ? 'System Ready' : `${provider === 'gemini' ? 'API_KEY' : 'OPENAI_API_KEY'} Missing`}
                    </div>
                </div>
            </div>
            </div>
        </nav>
      )}

      {/* Loading Overlay */}
      {loading && (
         <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-fade-in">
             <div className="relative">
                 <div className="w-24 h-24 rounded-full border-4 border-indigo-100 animate-pulse"></div>
                 <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
             </div>
             <div className="mt-8 text-center max-w-sm">
                 <h3 className="text-2xl font-bold text-slate-800 mb-2">Analyzing Candidates</h3>
                 <p className="text-slate-500 text-sm mb-6">{loadingStatus}</p>
                 
                 <div className="w-64 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                     <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                 </div>
                 <p className="text-xs text-slate-400 mt-2 font-mono">{Math.round(progress)}% Complete</p>
             </div>
         </div>
      )}

      <main className={view === 'DETAIL' ? "h-screen overflow-hidden bg-slate-50" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16"}>
        
        {/* Error Message */}
        {error && view === 'INPUT' && (
          <div className="mb-8 max-w-3xl mx-auto bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-sm animate-slide-up flex items-start">
             <div className="flex-shrink-0 mt-0.5">
               <svg className="h-5 w-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
             </div>
             <div className="ml-3">
               <h3 className="text-sm font-bold text-rose-800">Processing Error</h3>
               <p className="text-sm text-rose-700 mt-1">{error}</p>
             </div>
             <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
             </button>
          </div>
        )}

        {/* VIEW: INPUT */}
        {view === 'INPUT' && (
          <div className="animate-slide-up">
            
            {/* Header / Hero */}
            <div className="text-center max-w-3xl mx-auto mb-12 pt-4">
              <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                Screen Resumes at Scale
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Upload resumes, define your job requirements, and let our AI rank candidates by relevance in seconds.
              </p>
            </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* Left Column: Resumes */}
              <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col h-full relative overflow-hidden group hover:border-indigo-100 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
                
                <div className="mb-6 flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 flex items-center">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 text-sm font-bold mr-3 ring-4 ring-white">1</span>
                        Candidate Resumes
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 ml-11">Upload PDFs, DOCX, or import from cloud.</p>
                  </div>
                  <div className="flex bg-slate-100 rounded-lg p-1">
                     <button onClick={() => setUploadSource('LOCAL')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${uploadSource === 'LOCAL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Local</button>
                     <button onClick={() => setUploadSource('SHAREPOINT')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${uploadSource === 'SHAREPOINT' ? 'bg-white text-[#0078d4] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>SharePoint</button>
                  </div>
                </div>
                
                <div className="flex-1">
                  {uploadSource === 'LOCAL' ? (
                    <FileUpload 
                        label="Drag & Drop Files" 
                        accept=".pdf,.txt,.md,.pptx,.ppt,.doc,.docx" 
                        multiple={true}
                        onFilesAdded={(newFiles) => setResumes(prev => [...prev, ...newFiles])}
                    />
                  ) : (
                    <SharePointPicker onFilesSelected={(newFiles) => setResumes(prev => [...prev, ...newFiles])} />
                  )}

                  {/* File List */}
                  {resumes.length > 0 && (
                      <div className="mt-6">
                          <div className="flex justify-between items-center mb-2 px-1">
                              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{resumes.length} Files Queued</span>
                              <button onClick={() => setResumes([])} className="text-xs text-rose-500 hover:underline">Clear All</button>
                          </div>
                          <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                              {resumes.map((file, idx) => (
                                  <div key={idx} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-white transition-colors group/item">
                                      <div className="flex items-center overflow-hidden">
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 ${file.source === 'sharepoint' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                              {file.source === 'sharepoint' ? (
                                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 3C6.44772 3 6 3.44772 6 4V8C6 8.55228 6.44772 9 7 9H11C11.5523 9 12 8.55228 12 8V4C12 3.44772 11.5523 3 11 3H7ZM12.5 13C12.5 12.4477 12.0523 12 11.5 12H4.5C3.94772 12 3.5 12.4477 3.5 13V20C3.5 20.5523 3.94772 21 4.5 21H11.5C12.0523 21 12.5 20.5523 12.5 20V13ZM15 4C14.4477 4 14 4.44772 14 5V11C14 11.5523 14.4477 12 15 12H20C20.5523 12 21 11.5523 21 11V5C21 4.44772 20.5523 4 20 4H15ZM15 14C14.4477 14 14 14.4477 14 15V19C14 19.5523 14.4477 20 15 20H19C19.5523 20 20 19.5523 20 19V15C20 14.4477 19.5523 14 19 14H15Z" /></svg>
                                              ) : (
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                              )}
                                          </div>
                                          <span className="text-sm text-slate-700 font-medium truncate">{file.file?.name}</span>
                                      </div>
                                      <button onClick={() => handleRemoveResume(idx)} className="text-slate-400 hover:text-rose-500 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
                </div>
              </div>

              {/* Right Column: Job Description */}
              <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col h-full relative overflow-hidden group hover:border-emerald-100 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                
                <div className="mb-6 flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 text-sm font-bold mr-3 ring-4 ring-white">2</span>
                            Job Description
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 ml-11">Define the role requirements.</p>
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      <button onClick={() => setJdMode(JobDescriptionMode.TEXT)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${jdMode === JobDescriptionMode.TEXT ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Text</button>
                      <button onClick={() => setJdMode(JobDescriptionMode.FILE)} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${jdMode === JobDescriptionMode.FILE ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>File</button>
                    </div>
                </div>

                <div className="flex-1">
                  {jdMode === JobDescriptionMode.TEXT ? (
                     <div className="space-y-4">
                        {/* Saved JD Controls */}
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Job Title</label>
                              <input 
                                  type="text"
                                  value={jdTitle}
                                  onChange={(e) => setJdTitle(e.target.value)}
                                  placeholder="e.g. Senior Frontend"
                                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Load Template</label>
                              <div className="flex gap-2">
                                <select 
                                    value={selectedSavedJDId} 
                                    onChange={(e) => handleSelectSavedJD(e.target.value)}
                                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                                >
                                    <option value="">Select...</option>
                                    {savedJDs.map(jd => (
                                        <option key={jd.id} value={jd.id}>{jd.title}</option>
                                    ))}
                                </select>
                                {selectedSavedJDId && (
                                   <button onClick={(e) => handleDeleteSavedJD(selectedSavedJDId, e)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-rose-50 text-rose-500 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                   </button>
                                )}
                              </div>
                           </div>
                        </div>

                        {/* Text Area */}
                        <div>
                             <div className="flex justify-between items-center mb-1.5 px-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</label>
                                <button onClick={handleSaveJD} className="text-xs text-emerald-600 font-bold hover:underline">Save as Template</button>
                             </div>
                             <textarea
                                value={jdText}
                                onChange={(e) => setJdText(e.target.value)}
                                placeholder="Paste the job requirements here..."
                                className="w-full h-48 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none text-sm bg-slate-50 focus:bg-white text-slate-900 placeholder-slate-400 outline-none transition-all shadow-inner"
                              />
                        </div>
                     </div>
                  ) : (
                    <div className="h-64 flex flex-col justify-center">
                       <FileUpload label="Upload JD Document" accept=".pdf,.txt,.md" fileInput={jdFile} onFileChange={setJdFile} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="max-w-4xl mx-auto mt-12 mb-16">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-6">
                 
                 {/* Configuration */}
                 <div className="flex-1 w-full grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">AI Provider</label>
                          <div className="relative">
                            <select
                                value={provider}
                                onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
                                className="block w-full pl-3 pr-8 py-2.5 text-sm border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none font-medium"
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="openai">OpenAI</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Model</label>
                          <div className="relative">
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="block w-full pl-3 pr-8 py-2.5 text-sm border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none font-medium"
                            >
                                {AI_MODELS[provider].map((model) => (
                                    <option key={model.id} value={model.id}>{model.name}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                          </div>
                      </div>
                 </div>

                 {/* CTA Button */}
                 <div className="w-full md:w-auto">
                    <button
                        onClick={handleScreening}
                        disabled={loading || resumes.length === 0 || (!jdText && !jdFile.file)}
                        className={`w-full md:w-auto px-8 py-3.5 rounded-xl text-lg font-bold text-white shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 hover:shadow-xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center ${loading ? 'bg-indigo-400' : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600'}`}
                    >
                        {loading ? (
                             <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                             <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        )}
                        Start Analysis
                    </button>
                 </div>
              </div>
            </div>

          </div>
        )}

        {/* VIEW: CARD (Results Dashboard + Grid) */}
        {view === 'CARD' && results.length > 0 && (
            <div className="max-w-7xl mx-auto pt-4 animate-fade-in">
                
                {/* 1. Overall Summary Screen / Dashboard */}
                <BatchSummary 
                    results={results} 
                    onViewDetail={(index) => {
                        setSelectedResultIndex(index);
                        setView('DETAIL');
                    }} 
                />

                {/* Separator */}
                <div className="border-t border-slate-200 my-10"></div>

                {/* 2. Individual Cards Grid with Pagination */}
                <div className="flex flex-col sm:flex-row justify-between items-end mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Individual Candidates</h2>
                        <p className="text-slate-500 mt-1">
                            Page {currentPage} of {totalPages} • Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, results.length)}
                        </p>
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={() => setView('TABLE')} className="text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            Data Table
                        </button>
                        <button onClick={handleReset} className="text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-slate-200 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            New Screen
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {currentResults.map((result, index) => {
                        const globalIndex = indexOfFirstItem + index;
                        return (
                            <div key={globalIndex} className="h-full">
                                <CandidateCard 
                                    result={result} 
                                    onViewDetail={() => {
                                        setSelectedResultIndex(globalIndex);
                                        setView('DETAIL');
                                    }}
                                    onReject={() => handleReject(globalIndex)}
                                    onShortlist={() => handleShortlist(result)}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-12 mb-8">
                    <nav className="flex items-center space-x-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                      <button 
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Prev
                      </button>
                      
                      <div className="flex space-x-1 px-2">
                        {[...Array(totalPages)].map((_, i) => (
                          <button
                            key={i}
                            onClick={() => paginate(i + 1)}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                              currentPage === i + 1 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>

                      <button 
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                )}
            </div>
        )}

        {/* VIEW: DETAIL */}
        {view === 'DETAIL' && selectedResult && (
            <div className="animate-fade-in">
                <ResultsView 
                    result={selectedResult} 
                    fileInput={resumes[selectedResultIndex || 0]} 
                    onReset={handleReset}
                    onBack={() => {
                        setView('CARD');
                    }}
                    onShortlist={() => handleShortlist(selectedResult)}
                />
            </div>
        )}

        {/* VIEW: TABLE */}
        {view === 'TABLE' && (
            <div className="animate-fade-in">
                <TableView 
                    results={results} 
                    onBack={() => setView('CARD')}
                />
            </div>
        )}

        {/* VIEW: SHORTLIST */}
        {view === 'SHORTLIST' && (
            <div className="animate-fade-in">
                <ShortlistView 
                    shortlist={shortlist} 
                    onRemove={handleRemoveFromShortlist}
                    onBack={() => setView('CARD')}
                />
            </div>
        )}
        
      </main>
    </div>
  );
};

export default App;
