'use client';

/**
 * File Attachment Component
 * 
 * Handles file selection and upload for chat messages.
 * Supports images, documents, and code files.
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Upload, File, Image, FileText, Code, 
  Trash2, Check, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FileAttachmentProps {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (files: AttachedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  previewUrl?: string;
  status: 'pending' | 'uploading' | 'ready' | 'error';
  error?: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  image: Image,
  document: FileText,
  code: Code,
  default: File,
};

const getFileCategory = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('python')) return 'code';
  return 'default';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileAttachment({
  isOpen,
  onClose,
  onAttach,
  maxFiles = 5,
  maxSizeMB = 10,
  allowedTypes = ['image/*', 'application/pdf', 'text/*', 'application/json'],
}: FileAttachmentProps) {
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    
    const newFiles: AttachedFile[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    Array.from(fileList).forEach((file) => {
      if (files.length + newFiles.length >= maxFiles) return;
      
      const attachedFile: AttachedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        status: 'pending',
      };
      
      if (file.size > maxSizeBytes) {
        attachedFile.status = 'error';
        attachedFile.error = `File exceeds ${maxSizeMB}MB limit`;
      } else if (file.type.startsWith('image/')) {
        attachedFile.previewUrl = URL.createObjectURL(file);
        attachedFile.status = 'ready';
      } else {
        attachedFile.status = 'ready';
      }
      
      newFiles.push(attachedFile);
    });
    
    setFiles((prev) => [...prev, ...newFiles]);
  }, [files.length, maxFiles, maxSizeMB]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleSubmit = () => {
    const readyFiles = files.filter((f) => f.status === 'ready');
    if (readyFiles.length > 0) {
      onAttach(readyFiles);
      setFiles([]);
      onClose();
    }
  };

  const handleClose = () => {
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-[#0d0d14] border border-white/[0.08] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Upload className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Attach Files</h2>
                <p className="text-xs text-slate-500">Upload files to include in your message</p>
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={handleClose}>
              <X className="h-5 w-5 text-slate-400" />
            </Button>
          </div>

          {/* Drop Zone */}
          <div className="p-4">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                isDragging
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-white/[0.1] hover:border-white/[0.2] bg-white/[0.02]'
              )}
            >
              <Upload className={cn(
                'h-10 w-10 mx-auto mb-3',
                isDragging ? 'text-violet-400' : 'text-slate-500'
              )} />
              <p className="text-sm text-white mb-1">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-slate-500">
                Max {maxFiles} files, {maxSizeMB}MB each
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedTypes.join(',')}
              onChange={(e) => processFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="px-4 pb-4 space-y-2 max-h-48 overflow-y-auto">
              {files.map((file) => {
                const category = getFileCategory(file.type);
                const Icon = FILE_ICONS[category] || FILE_ICONS.default;
                
                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      file.status === 'error'
                        ? 'border-red-500/30 bg-red-500/10'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    )}
                  >
                    {file.previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={file.previewUrl} 
                        alt={file.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-white/[0.05] flex items-center justify-center">
                        <Icon className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{file.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                        {file.status === 'ready' && (
                          <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                            Ready
                          </Badge>
                        )}
                        {file.status === 'error' && (
                          <span className="text-xs text-red-400">{file.error}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {file.status === 'ready' && (
                        <Check className="h-4 w-4 text-green-400" />
                      )}
                      {file.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeFile(file.id)}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-white/[0.06] bg-white/[0.02]">
            <p className="text-xs text-slate-500">
              {files.length} / {maxFiles} files
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={files.filter((f) => f.status === 'ready').length === 0}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Attach Files
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
