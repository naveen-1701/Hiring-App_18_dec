
import React, { useState, useEffect } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError, BrowserAuthError } from '@azure/msal-browser';
import { FileInput } from '../types';

interface SharePointPickerProps {
  onFilesSelected: (files: FileInput[]) => void;
}

// Graph API Response Types
interface GraphDriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  size?: number;
  lastModifiedDateTime: string;
  '@microsoft.graph.downloadUrl'?: string;
}

// Configuration for MSAL
const SCOPES = ['User.Read', 'Files.Read', 'Files.Read.All', 'Sites.Read.All'];

const SharePointPicker: React.FC<SharePointPickerProps> = ({ onFilesSelected }) => {
  // Config State
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem('msal_client_id') || '');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  // Auth & Graph State
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string>('');
  
  // Navigation State
  const [currentPath, setCurrentPath] = useState<{id: string, name: string}[]>([]); // Stack of folders
  const [items, setItems] = useState<GraphDriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // --- 1. Initialization ---

  const initializeMsal = async () => {
    if (!clientId) {
      setError("Client ID is required.");
      return;
    }
    
    try {
      const pca = new PublicClientApplication({
        auth: {
          clientId: clientId,
          authority: "https://login.microsoftonline.com/common",
          redirectUri: window.location.origin, // Dynamic redirect to current origin
        },
        cache: {
          cacheLocation: "sessionStorage",
          storeAuthStateInCookie: false,
        }
      });

      await pca.initialize();
      setMsalInstance(pca);
      localStorage.setItem('msal_client_id', clientId);
      setIsConfigured(true);
      setError(null);
      
      // Check if user is already signed in
      const accounts = pca.getAllAccounts();
      if (accounts.length > 0) {
          setUserName(accounts[0].name || 'User');
          setIsAuthenticated(true);
          fetchFolderChildren('root'); // Auto-load root
      }

    } catch (e: any) {
      setError(`Failed to initialize MSAL: ${e.message}`);
    }
  };

  // --- 2. Authentication ---

  const handleLogin = async () => {
    if (!msalInstance) return;
    setLoading(true);
    setError(null);

    try {
      const loginResponse = await msalInstance.loginPopup({
        scopes: SCOPES,
        prompt: "select_account"
      });

      setUserName(loginResponse.account?.name || 'User');
      setIsAuthenticated(true);
      
      // Fetch Root folder immediately after login
      await fetchFolderChildren('root');

    } catch (e: any) {
      console.error(e);
      if (e instanceof BrowserAuthError && e.errorCode === 'popup_window_error') {
          setError("Popup blocked. Please allow popups for this site to sign in.");
      } else {
          setError(`Login failed: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
      if (!msalInstance) return;
      try {
          // Use logoutPopup to avoid full page redirect if possible, or simple state reset
          await msalInstance.logoutPopup();
          setIsAuthenticated(false);
          setUserName('');
          setItems([]);
          setCurrentPath([]);
      } catch (e) {
          // Fallback if popup fails
          setIsAuthenticated(false);
          setUserName('');
      }
  };

  const getValidToken = async (): Promise<string | null> => {
    if (!msalInstance) return null;
    const account = msalInstance.getAllAccounts()[0];
    if (!account) return null;

    try {
      const response = await msalInstance.acquireTokenSilent({
        account: account,
        scopes: SCOPES
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Fallback to interaction when silent call fails
        const response = await msalInstance.acquireTokenPopup({ scopes: SCOPES });
        return response.accessToken;
      }
      return null;
    }
  };

  // --- 3. Graph API Interactions ---

  const fetchFolderChildren = async (folderId: string = 'root', folderName: string = 'Home') => {
    setLoading(true);
    setLoadingMsg("Loading files...");
    setError(null);
    
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Could not acquire access token");

      // Use /me/drive/root for personal/business OneDrive root
      // Use /me/drive/items/{id} for specific folders
      const endpoint = folderId === 'root' 
        ? 'https://graph.microsoft.com/v1.0/me/drive/root/children'
        : `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Graph API Error: ${response.statusText} (${response.status})`);

      const data = await response.json();
      setItems(data.value || []);
      
      // Update breadcrumbs
      if (folderId === 'root') {
        setCurrentPath([{ id: 'root', name: 'Home' }]);
      } else {
        const existingIndex = currentPath.findIndex(p => p.id === folderId);
        if (existingIndex === -1) {
             setCurrentPath(prev => [...prev, { id: folderId, name: folderName }]);
        }
      }
      
      // Clear selection on navigation
      setSelectedItems(new Set());

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleDownloadFiles = async () => {
    if (selectedItems.size === 0) return;
    setLoading(true);
    setLoadingMsg(`Downloading ${selectedItems.size} file(s)...`);

    try {
      const token = await getValidToken();
      const filesToDownload = items.filter(i => selectedItems.has(i.id) && i.file);
      const convertedFiles: FileInput[] = [];

      for (const item of filesToDownload) {
        // We use the /content endpoint to get the binary stream
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/content`, {
           headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
           console.error(`Failed to download ${item.name}`);
           continue;
        }

        const blob = await response.blob();
        
        // Convert Blob to Base64
        const base64 = await new Promise<string>((resolve) => {
           const reader = new FileReader();
           reader.onloadend = () => {
               const res = reader.result as string;
               resolve(res.split(',')[1]);
           };
           reader.readAsDataURL(blob);
        });

        const fileObj = new File([blob], item.name, { type: item.file?.mimeType || 'application/octet-stream' });
        
        convertedFiles.push({
            file: fileObj,
            base64: base64,
            mimeType: fileObj.type,
            source: 'sharepoint'
        });
      }

      onFilesSelected(convertedFiles);
      alert(`Successfully imported ${convertedFiles.length} files.`);
      setSelectedItems(new Set());

    } catch (e: any) {
       setError(`Download failed: ${e.message}`);
    } finally {
       setLoading(false);
       setLoadingMsg("");
    }
  };

  // --- 4. Navigation Helpers ---

  const handleFolderClick = (item: GraphDriveItem) => {
     fetchFolderChildren(item.id, item.name);
  };

  const handleBreadcrumbClick = (index: number) => {
     const target = currentPath[index];
     const newPath = currentPath.slice(0, index + 1);
     setCurrentPath(newPath);
     // Re-fetch that folder
     fetchFolderChildren(target.id, target.name);
  };

  const toggleSelection = (itemId: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) newSet.delete(itemId);
    else newSet.add(itemId);
    setSelectedItems(newSet);
  };
  
  const handleSelectAll = () => {
      if (selectedItems.size === items.filter(i => i.file).length) {
          setSelectedItems(new Set());
      } else {
          const newSet = new Set<string>();
          items.forEach(item => { if (item.file) newSet.add(item.id); });
          setSelectedItems(newSet);
      }
  };

  // --- 5. Renders ---

  // VIEW 1: Configuration
  if (!isConfigured) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center h-auto min-h-[300px]">
         <div className="bg-blue-50 p-3 rounded-full mb-4 text-blue-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
         </div>
         <h3 className="text-lg font-bold text-slate-900 mb-2">Connect Microsoft Graph</h3>
         <p className="text-slate-500 text-sm mb-6 max-w-sm">
           Enter your Azure <strong>Client ID</strong> to enable file access.
         </p>
         <div className="w-full max-w-xs space-y-3">
            <div className="text-left">
                <label className="text-xs font-bold text-slate-700 uppercase">Application (Client) ID</label>
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g., a1b2c3d4-..."
                  className="w-full mt-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>
            <button 
              onClick={initializeMsal}
              className="w-full bg-[#0078d4] text-white py-2 rounded-md text-sm font-semibold hover:bg-[#106ebe] transition-colors shadow-sm"
            >
              Connect
            </button>
         </div>
         <div className="mt-4 pt-4 border-t border-slate-100 text-center w-full">
            <a 
              href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" 
              target="_blank" 
              rel="noreferrer"
              className="text-xs text-[#0078d4] hover:underline flex items-center justify-center"
            >
              Get Client ID from Azure Portal
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
            </a>
         </div>
      </div>
    );
  }

  // VIEW 2: Login Screen
  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center h-[300px]">
        <div className="bg-[#f3f4f6] p-4 rounded-full mb-4">
           <svg className="w-10 h-10 text-[#0078d4]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Sign in to Microsoft</h3>
        <p className="text-slate-500 text-sm mb-6 max-w-xs">Access files from OneDrive and SharePoint.</p>
        
        {error && <div className="text-rose-600 text-xs mb-4 bg-rose-50 p-2 rounded max-w-xs text-left">{error}</div>}

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="flex items-center justify-center bg-[#2F2F2F] hover:bg-[#1a1a1a] text-white px-6 py-2.5 rounded-md font-semibold transition-colors shadow-sm w-full max-w-xs"
        >
          {loading ? "Connecting..." : "Sign in with Microsoft"}
        </button>
        <button onClick={() => setIsConfigured(false)} className="text-xs text-slate-400 mt-4 hover:underline">Settings</button>
      </div>
    );
  }

  // VIEW 3: File Browser
  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-[450px]">
       
       {/* Header with Breadcrumbs & User Profile */}
       <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
          <div className="flex items-center space-x-1 text-sm text-slate-600 overflow-x-auto whitespace-nowrap scrollbar-hide mr-4">
              {currentPath.map((folder, index) => (
                <React.Fragment key={folder.id}>
                  {index > 0 && <span className="text-slate-400">/</span>}
                  <button 
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`hover:bg-slate-200 px-2 py-1 rounded transition-colors font-medium ${index === currentPath.length - 1 ? 'text-slate-900' : 'text-[#0078d4]'}`}
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              ))}
          </div>
          <div className="flex items-center space-x-3">
             <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-700">{userName}</span>
                <button onClick={handleLogout} className="text-[10px] text-slate-400 hover:text-rose-500 hover:underline">Sign Out</button>
             </div>
             <div className="h-8 w-8 rounded-full bg-[#0078d4] text-white flex items-center justify-center text-sm font-bold shadow-sm" title={userName}>
                {userName.charAt(0)}
             </div>
          </div>
       </div>

       {/* Toolbar */}
       <div className="px-4 py-2 border-b border-slate-100 bg-white flex justify-between items-center text-xs">
          <button onClick={handleSelectAll} className="text-slate-600 hover:text-[#0078d4] font-medium flex items-center">
             <div className={`w-3 h-3 border rounded mr-2 flex items-center justify-center ${selectedItems.size > 0 && selectedItems.size === items.filter(i => i.file).length ? 'bg-[#0078d4] border-[#0078d4]' : 'border-slate-300'}`}>
                {selectedItems.size > 0 && selectedItems.size === items.filter(i => i.file).length && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>}
             </div>
             Select All
          </button>
          <span className="text-slate-400">{items.length} items</span>
       </div>

       {/* File List */}
       <div className="flex-1 overflow-y-auto relative">
          {loading && (
             <div className="absolute inset-0 bg-white/80 z-10 flex flex-col items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-[#0078d4] mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-slate-500 font-medium">{loadingMsg || "Loading..."}</p>
             </div>
          )}

          {error && (
             <div className="p-4 text-center mt-10">
                <p className="text-rose-600 text-sm mb-3 font-medium">{error}</p>
                <button 
                    onClick={() => fetchFolderChildren(currentPath[currentPath.length-1].id, currentPath[currentPath.length-1].name)} 
                    className="text-[#0078d4] hover:underline text-sm border border-[#0078d4] px-4 py-1.5 rounded"
                >
                    Retry
                </button>
             </div>
          )}

          {!loading && !error && items.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <svg className="w-12 h-12 mb-2 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                <p className="text-sm">This folder is empty</p>
             </div>
          )}

          <table className="min-w-full">
            <tbody className="divide-y divide-slate-50">
               {items.map((item) => {
                  const isSelected = selectedItems.has(item.id);
                  const isFolder = !!item.folder;
                  return (
                    <tr 
                       key={item.id} 
                       className={`group transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                       onClick={() => isFolder ? handleFolderClick(item) : toggleSelection(item.id)}
                    >
                       <td className="px-4 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                          {!isFolder && (
                            <input 
                               type="checkbox" 
                               checked={isSelected}
                               onChange={() => toggleSelection(item.id)}
                               className="rounded border-gray-300 text-[#0078d4] focus:ring-[#0078d4] cursor-pointer w-4 h-4"
                            />
                          )}
                       </td>
                       <td className="px-2 py-3">
                          <div className="flex items-center">
                             {isFolder ? (
                                <svg className="w-6 h-6 mr-3 text-[#FBC02D] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
                             ) : item.name.endsWith('.pdf') ? (
                                <svg className="w-6 h-6 mr-3 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
                             ) : (
                                <svg className="w-6 h-6 mr-3 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
                             )}
                             <div>
                                 <p className={`text-sm truncate max-w-[180px] sm:max-w-xs ${isFolder ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>{item.name}</p>
                                 <p className="text-[10px] text-slate-400">
                                    {new Date(item.lastModifiedDateTime).toLocaleDateString()}
                                 </p>
                             </div>
                          </div>
                       </td>
                    </tr>
                  );
               })}
            </tbody>
          </table>
       </div>

       {/* Footer */}
       <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-500 hidden sm:block">
             {selectedItems.size > 0 ? `${selectedItems.size} file(s) selected` : 'Select files to import'}
          </div>
          <button
             onClick={handleDownloadFiles}
             disabled={selectedItems.size === 0 || loading}
             className="w-full sm:w-auto bg-[#0078d4] hover:bg-[#106ebe] text-white text-sm font-semibold px-6 py-2 rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
             {loading ? 'Downloading...' : 'Import Selected'}
          </button>
       </div>
    </div>
  );
};

export default SharePointPicker;
