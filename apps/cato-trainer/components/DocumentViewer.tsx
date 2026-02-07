'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Upload,
  Loader2,
  Tag,
  Hash,
  Calendar,
  HardDrive,
  Link2,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { useCatoTrainerStore } from '@/lib/cato-trainer-store';
import {
  fetchDocuments,
  fetchDocument,
  uploadDocument,
  deleteDocument,
  fetchSmartLinks,
  type Document,
} from '@/lib/api';
import { cn, formatFileSize, formatRelativeTime, truncate } from '@/lib/utils';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function DocumentViewer() {
  const {
    activeLibrary,
    documents,
    setDocuments,
    selectedDocument,
    setSelectedDocument,
    selectedDocumentChunks,
    setSelectedDocumentChunks,
    smartLinks,
    setSmartLinks,
    selectedDocumentIds,
    toggleDocumentSelection,
    clearDocumentSelection,
  } = useCatoTrainerStore();

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['documents', activeLibrary?.id],
    queryFn: () => fetchDocuments(activeLibrary!.id),
    enabled: !!activeLibrary,
    select: (data) => {
      setDocuments(data.documents);
      return data.documents;
    },
  });

  useQuery({
    queryKey: ['document-detail', selectedDocument?.id],
    queryFn: () => fetchDocument(selectedDocument!.id),
    enabled: !!selectedDocument,
    select: (data) => {
      setSelectedDocumentChunks(data.chunks);
      return data;
    },
  });

  useQuery({
    queryKey: ['smart-links', selectedDocument?.id],
    queryFn: () => fetchSmartLinks(selectedDocument!.id),
    enabled: !!selectedDocument,
    select: (data) => {
      setSmartLinks(data.links);
      return data.links;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDocument(activeLibrary!.id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => deleteDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setSelectedDocument(null);
    },
  });

  const handleFileUpload = (files: FileList | null) => {
    if (!files || !activeLibrary) return;
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
  };

  if (!activeLibrary) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <FileText className="w-16 h-16 text-white/[0.03] mb-4" />
        <h3 className="text-lg font-medium text-white/20">Select a Library</h3>
        <p className="text-sm text-white/10 mt-1">Choose a library first to browse its documents</p>
      </div>
    );
  }

  // Document detail view
  if (selectedDocument) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => setSelectedDocument(null)}
          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          <ChevronRight className="w-3 h-3 rotate-180" /> Back to documents
        </button>

        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-cato-400" />
              <div>
                <h2 className="text-lg font-bold text-white">{selectedDocument.title || selectedDocument.filename}</h2>
                <p className="text-xs text-white/25">{selectedDocument.filename}</p>
              </div>
            </div>
            <button
              onClick={() => deleteMutation.mutate(selectedDocument.id)}
              disabled={deleteMutation.isPending}
              className="p-2 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-[11px] text-white/25 mb-4">
            <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {formatFileSize(selectedDocument.size_bytes)}</span>
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {selectedDocument.chunk_count} chunks</span>
            {selectedDocument.page_count && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {selectedDocument.page_count} pages</span>}
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatRelativeTime(selectedDocument.uploaded_at)}</span>
          </div>

          {/* Tags */}
          {selectedDocument.auto_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedDocument.auto_tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-cato-500/10 text-[10px] text-cato-300 border border-cato-500/20">
                  <Tag className="w-2.5 h-2.5 inline mr-1" />{tag}
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          {selectedDocument.summary && (
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <p className="text-[10px] uppercase tracking-wider text-white/15 mb-2">AI Summary</p>
              <p className="text-sm text-white/50 leading-relaxed">{selectedDocument.summary}</p>
            </div>
          )}
        </div>

        {/* Chunks */}
        {selectedDocumentChunks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Document Chunks ({selectedDocumentChunks.length})</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {selectedDocumentChunks.map((chunk) => (
                <div key={chunk.id} className="glass-panel rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-[10px] text-white/15">
                    <span>Chunk #{chunk.chunk_index + 1}</span>
                    {chunk.page_number && <span>· Page {chunk.page_number}</span>}
                    {chunk.section_title && <span>· § {chunk.section_title}</span>}
                    <span className="ml-auto">{chunk.token_count} tokens</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart Links */}
        {smartLinks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-cato-400" /> Smart Links ({smartLinks.length})
            </h3>
            <div className="space-y-2">
              {smartLinks.map((link) => (
                <div key={link.id} className="glass-panel rounded-lg p-3 flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/25 capitalize">{link.relationship}</span>
                  <span className="text-xs text-white/40 flex-1">{link.shared_concepts.join(', ')}</span>
                  <span className="text-[10px] text-cato-400">{Math.round(link.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Document list view
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Documents</h2>
          <p className="text-xs text-white/30">{activeLibrary.name} · {documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDocumentIds.length > 0 && (
            <button onClick={clearDocumentSelection} className="px-3 py-1.5 text-xs text-white/30 hover:text-white/50 transition-colors">
              Clear ({selectedDocumentIds.length})
            </button>
          )}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cato-600 hover:bg-cato-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFileUpload(e.dataTransfer.files); }}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragOver ? 'border-cato-500/40 bg-cato-500/5' : 'border-white/[0.04]'
        )}
      >
        <Upload className={cn('w-8 h-8 mx-auto mb-2', isDragOver ? 'text-cato-400' : 'text-white/10')} />
        <p className="text-sm text-white/20">Drop files here to upload</p>
        <p className="text-[10px] text-white/10 mt-1">PDF, DOCX, TXT, MD, CSV, HTML</p>
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-cato-500 animate-spin" />
        </div>
      ) : documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((doc) => {
            const isSelected = selectedDocumentIds.includes(doc.id);
            return (
              <div key={doc.id} className="glass-panel rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors card-reveal">
                <button onClick={() => toggleDocumentSelection(doc.id)} className="flex-shrink-0">
                  {isSelected ? <CheckSquare className="w-4 h-4 text-cato-400" /> : <Square className="w-4 h-4 text-white/10" />}
                </button>
                <button onClick={() => setSelectedDocument(doc)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <FileText className="w-5 h-5 text-white/15 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 truncate">{doc.title || doc.filename}</p>
                    <div className="flex items-center gap-3 text-[10px] text-white/15 mt-0.5">
                      <span>{formatFileSize(doc.size_bytes)}</span>
                      <span>{doc.chunk_count} chunks</span>
                      <span>{formatRelativeTime(doc.uploaded_at)}</span>
                    </div>
                  </div>
                  {doc.auto_tags.length > 0 && (
                    <div className="flex gap-1 flex-shrink-0">
                      {doc.auto_tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.03] text-white/20">{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-white/[0.03] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/20">No Documents</h3>
          <p className="text-sm text-white/10 mt-1">Upload files to start building your knowledge base</p>
        </div>
      )}
    </div>
  );
}
