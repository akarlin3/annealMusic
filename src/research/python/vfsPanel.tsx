import React, { useState, useEffect } from 'react';
import type { PyodideWorker } from './PyodideWorker';
import {
  HardDrive,
  RefreshCw,
  Download,
  Trash2,
  FileAudio,
} from 'lucide-react';

interface VFSFile {
  name: string;
  path: string;
  sizeBytes: number;
  mtime: number;
}

interface VFSPanelProps {
  worker: PyodideWorker | null;
  isWorkerReady: boolean;
  runTrigger: number; // Increment this whenever a script executes to trigger file lists refresh
}

export const VFSPanel: React.FC<VFSPanelProps> = ({
  worker,
  isWorkerReady,
  runTrigger,
}) => {
  const [files, setFiles] = useState<VFSFile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    if (!worker || !isWorkerReady) return;
    setLoading(true);
    try {
      const list = await worker.vfsList();
      setFiles(list);
    } catch (err) {
      console.error('Failed to list VFS files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isWorkerReady) {
      fetchFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkerReady, runTrigger]);

  const handleDownload = async (file: VFSFile) => {
    if (!worker) return;
    try {
      const bytes = await worker.vfsRead(file.path);
      if (bytes.length === 0) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = new Blob([bytes as any], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download VFS file:', err);
    }
  };

  const handleDelete = async (file: VFSFile) => {
    if (!worker) return;
    try {
      const success = await worker.vfsDelete(file.path);
      if (success) {
        fetchFiles();
      }
    } catch (err) {
      console.error('Failed to delete VFS file:', err);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-4 flex flex-col gap-3 shadow-lg select-none">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
          <HardDrive size={14} className="text-amber-500" />
          Virtual File System (MEMFS)
        </span>
        <button
          onClick={fetchFiles}
          disabled={loading || !isWorkerReady}
          className="text-stone-500 hover:text-stone-300 disabled:opacity-30 transition-colors"
          title="Refresh VFS files"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto scrollbar-thin">
        {!isWorkerReady ? (
          <span className="text-[9px] font-mono text-stone-600 italic">
            Environment offline...
          </span>
        ) : files.length === 0 ? (
          <span className="text-[9px] font-mono text-stone-600 italic">
            No files in virtual /tmp directory.
          </span>
        ) : (
          files.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between p-2 rounded bg-stone-950/40 border border-stone-900/50 hover:border-amber-500/10 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                <FileAudio
                  size={12}
                  className="text-amber-500/60 flex-shrink-0"
                />
                <div className="flex flex-col truncate">
                  <span
                    className="text-[10px] font-mono text-stone-300 truncate"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  <span className="text-[8px] font-mono text-stone-500">
                    {formatSize(file.sizeBytes)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleDownload(file)}
                  className="p-1 hover:bg-stone-900 rounded text-stone-400 hover:text-amber-500 transition-all"
                  title="Download to actual disk"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  className="p-1 hover:bg-stone-900 rounded text-stone-400 hover:text-red-400 transition-all"
                  title="Delete virtual file"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default VFSPanel;
