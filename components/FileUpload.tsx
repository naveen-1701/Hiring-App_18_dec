
import React, { useCallback, useRef, useState } from 'react';
import { FileInput } from '../types';

interface FileUploadProps {
  label: string;
  accept: string;
  // Single mode
  fileInput?: FileInput;
  onFileChange?: (fileInput: FileInput) => void;
  // Multiple mode
  multiple?: boolean;
  onFilesAdded?: (files: FileInput[]) => void;
  
  icon?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  accept, 
  fileInput, 
  onFileChange, 
  multiple = false,
  onFilesAdded,
  icon 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File): Promise<FileInput> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Content = base64String.split(',')[1];
        resolve({
          file: file,
          base64: base64Content,
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (multiple && onFilesAdded) {
      const filePromises = Array.from(files).map(processFile);
      const processedFiles = await Promise.all(filePromises);
      onFilesAdded(processedFiles);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else if (onFileChange) {
      const file = files[0];
      const processedFile = await processFile(file);
      onFileChange(processedFile);
    }
  }, [multiple, onFilesAdded, onFileChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (multiple && onFilesAdded) {
      const filePromises = Array.from(files).map(processFile);
      const processedFiles = await Promise.all(filePromises);
      onFilesAdded(processedFiles);
    } else if (onFileChange) {
      const file = files[0];
      const processedFile = await processFile(file);
      onFileChange(processedFile);
    }
  };

  const handleClear = useCallback(() => {
    if (onFileChange) {
      onFileChange({ file: null, base64: null, mimeType: '' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onFileChange]);

  const showSelectedState = !multiple && fileInput?.file;

  return (
    <div className="w-full">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">{label}</label>
      
      {!showSelectedState ? (
        <div 
          className={`
            relative group cursor-pointer transition-all duration-300 ease-in-out
            border-2 border-dashed rounded-xl bg-white
            flex flex-col items-center justify-center
            px-6 py-8
            ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-2 text-center pointer-events-none">
            {icon || (
              <div className={`mx-auto h-12 w-12 transition-colors duration-300 ${isDragging ? 'text-indigo-500' : 'text-slate-300 group-hover:text-indigo-400'}`}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            )}
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-indigo-600 group-hover:text-indigo-500">Click to upload</span>
              <span className="mx-1">or drag and drop</span>
            </div>
            <p className="text-xs text-slate-400">PDF, DOCX, TXT (Max 10MB)</p>
          </div>
          <input 
            type="file" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept={accept} 
            multiple={multiple}
            onChange={handleFileChange}
            ref={fileInputRef}
          />
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between p-4 border border-indigo-200 bg-indigo-50/60 rounded-xl shadow-sm transition-all animate-fade-in">
          <div className="flex items-center space-x-4 overflow-hidden">
            <div className="bg-white p-2 rounded-lg text-indigo-500 shadow-sm border border-indigo-100">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{fileInput?.file?.name}</p>
              <p className="text-xs text-slate-500">{(fileInput?.file?.size ? fileInput.file.size / 1024 : 0).toFixed(0)} KB</p>
            </div>
          </div>
          <button 
            onClick={handleClear}
            className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-100 transition-colors"
            title="Remove file"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
