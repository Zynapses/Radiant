'use client';

/**
 * File Attachments Component for Think Tank Consumer App
 * Drag-and-drop file upload with preview
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  File, 
  FileImage, 
  FileCode, 
  FileText, 
  Loader2,
  AlertCircle,
  Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileAttachment {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
  uploadedUrl?: string;
}

interface FileAttachmentsProps {
  onFilesChange: (files: FileAttachment[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  acceptedTypes?: string[];
  className?: string;
  disabled?: boolean;
}

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ACCEPTED_TYPES = [
  'image/*',
  'text/*',
  'application/pdf',
  'application/json',
  'application/javascript',
  'application/typescript',
];

export function FileAttachments({
  onFilesChange,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className,
  disabled = false,
}: FileAttachmentsProps) {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return FileImage;
    if (file.type.includes('javascript') || file.type.includes('typescript') || file.type.includes('json')) return FileCode;
    if (file.type.startsWith('text/') || file.type.includes('pdf')) return FileText;
    return File;
  };

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File too large (max ${Math.round(maxSizeBytes / 1024 / 1024)}MB)`;
    }
    
    const isAccepted = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'));
      }
      return file.type === type;
    });
    
    if (!isAccepted) {
      return 'File type not supported';
    }
    
    return null;
  }, [maxSizeBytes, acceptedTypes]);

  const createPreview = async (file: File): Promise<string | undefined> => {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    }
    return undefined;
  };

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const remainingSlots = maxFiles - files.length;
    const filesToAdd = fileArray.slice(0, remainingSlots);

    const newAttachments: FileAttachment[] = await Promise.all(
      filesToAdd.map(async (file) => {
        const error = validateFile(file);
        const preview = await createPreview(file);
        
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview,
          status: error ? 'error' : 'pending',
          progress: 0,
          error: error || undefined,
        } as FileAttachment;
      })
    );

    const updatedFiles = [...files, ...newAttachments];
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, maxFiles, onFilesChange, validateFile]);

  const removeFile = useCallback((id: string) => {
    const updatedFiles = files.filter(f => f.id !== id);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!disabled && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [disabled, addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  }, [addFiles]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setShowDropzone(!showDropzone)}
        disabled={disabled || files.length >= maxFiles}
        className={cn(
          'p-2 rounded-lg transition-all',
          'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          (disabled || files.length >= maxFiles) && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Attach files"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* File count badge */}
      {files.length > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
          {files.length}
        </span>
      )}

      {/* Dropzone Modal */}
      <AnimatePresence>
        {showDropzone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50"
          >
            {/* Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'p-6 border-2 border-dashed rounded-lg m-3 cursor-pointer transition-all',
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedTypes.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className={cn(
                  'w-8 h-8',
                  isDragging ? 'text-blue-500' : 'text-zinc-400'
                )} />
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {isDragging ? 'Drop files here' : 'Drag files or click to upload'}
                </p>
                <p className="text-xs text-zinc-500">
                  Max {maxFiles} files, {Math.round(maxSizeBytes / 1024 / 1024)}MB each
                </p>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="max-h-48 overflow-y-auto px-3 pb-3">
                <div className="space-y-2">
                  {files.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.file);
                    
                    return (
                      <motion.div
                        key={attachment.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded-lg',
                          attachment.status === 'error'
                            ? 'bg-red-50 dark:bg-red-950'
                            : 'bg-zinc-50 dark:bg-zinc-800'
                        )}
                      >
                        {/* Preview or Icon */}
                        {attachment.preview ? (
                          <img
                            src={attachment.preview}
                            alt={attachment.file.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                            <FileIcon className="w-5 h-5 text-zinc-500" />
                          </div>
                        )}

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-zinc-700 dark:text-zinc-300">
                            {attachment.file.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatFileSize(attachment.file.size)}
                          </p>
                          {attachment.error && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {attachment.error}
                            </p>
                          )}
                        </div>

                        {/* Status / Actions */}
                        {attachment.status === 'uploading' ? (
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(attachment.id);
                            }}
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            aria-label="Remove file"
                          >
                            <X className="w-4 h-4 text-zinc-500" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Close button */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setShowDropzone(false)}
                className="w-full py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FileAttachments;
