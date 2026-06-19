import React, { useState } from 'react';
import { GripVertical, FileImage, FileAudio, FileVideo, FileText, File, Trash2, ArrowRight } from 'lucide-react';
import { RenameableFile } from '../types';

interface FileItemRowProps {
  index: number;
  fileItem: RenameableFile;
  newName: string;
  draggedIndex: number | null;
  setDraggedIndex: (index: number | null) => void;
  onReorder: (dragIndex: number, hoverIndex: number) => void;
  onRemove: (id: string) => void;
  isSelected?: boolean;
  onClick?: () => void;
}

export const FileItemRow: React.FC<FileItemRowProps> = ({
  index,
  fileItem,
  newName,
  draggedIndex,
  setDraggedIndex,
  onReorder,
  onRemove,
  isSelected,
  onClick,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image or basic ghost string
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (draggedIndex === null || draggedIndex === index) return;
    onReorder(draggedIndex, index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setIsDragOver(false);
  };

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const ext = fileItem.extension.toLowerCase();
  const isImage = fileItem.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
  const isAudio = fileItem.type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'].includes(ext);
  const isVideo = fileItem.type.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', '3gp'].includes(ext);
  const isPdf = fileItem.type === 'application/pdf' || ext === 'pdf';
  const isText = fileItem.type.startsWith('text/') || ['txt', 'csv', 'json', 'md', 'html', 'css', 'js', 'ts', 'xml', 'log'].includes(ext);

  // Dynamic file format icons
  const getFileIcon = () => {
    if (isImage) return <FileImage className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />;
    if (isAudio) return <FileAudio className="w-5 h-5 text-amber-500 dark:text-amber-400" />;
    if (isVideo) return <FileVideo className="w-5 h-5 text-rose-500 dark:text-rose-400" />;
    if (isPdf) return <FileText className="w-5 h-5 text-emerald-500 dark:text-emerald-400 font-bold" />;
    if (isText) return <FileText className="w-5 h-5 text-sky-500 dark:text-sky-400" />;
    return <File className="w-5 h-5 text-zinc-500" />;
  };

  return (
    <div
      id={`file-item-${fileItem.id}`}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className={`group relative flex flex-col md:flex-row md:items-center justify-between p-3.5 mb-2.5 rounded-xl border transition-all duration-200 select-none cursor-pointer
        ${draggedIndex === index 
          ? 'opacity-40 border-dashed border-sky-400 bg-sky-50 dark:bg-sky-950/20' 
          : isDragOver
            ? 'border-sky-500 scale-[1.02] shadow-md bg-sky-50/50 dark:bg-sky-950/10'
            : isSelected
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'
        }
      `}
    >
      {/* File Identifier and Handle */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Drag handle */}
        <button
          type="button"
          id={`drag-handle-${fileItem.id}`}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-grab active:cursor-grabbing hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
          title="Arraste para reordenar"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Index badge */}
        <span className="flex items-center justify-center w-6 h-6 text-xs font-mono font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          {index + 1}
        </span>

        {/* Thumbnail Preview or Icon */}
        <div 
          className="relative group/thumb cursor-zoom-in"
          onMouseEnter={() => isImage && setIsPreviewExpanded(true)}
          onMouseLeave={() => setIsPreviewExpanded(false)}
        >
          {isImage && fileItem.previewUrl ? (
            <img
              src={fileItem.previewUrl}
              alt={fileItem.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 shadow-inner"
            />
          ) : (
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-indigo-500 dark:text-indigo-400">
              {getFileIcon()}
            </div>
          )}

          {/* Hover Overlay Zoom Card */}
          {isPreviewExpanded && isImage && fileItem.previewUrl && (
            <div className="absolute z-50 left-12 top-0 p-1.5 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl w-48 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
              <img
                src={fileItem.previewUrl}
                alt={fileItem.name}
                referrerPolicy="no-referrer"
                className="w-full h-auto aspect-square object-cover rounded-md"
              />
              <div className="mt-1 text-[10px] text-center text-zinc-500 font-mono truncate">{fileItem.name}</div>
            </div>
          )}
        </div>

        {/* Name details */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="font-medium text-xs text-zinc-800 dark:text-zinc-200 truncate" title={fileItem.name}>
            {fileItem.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span>{formatBytes(fileItem.size)}</span>
            <span>•</span>
            <span className="uppercase text-zinc-400">{fileItem.extension || 'sem ext'}</span>
          </div>
        </div>
      </div>

      {/* Connection & Target Mapping */}
      <div className="flex items-center gap-2 mt-2 md:mt-0 pl-8 md:pl-0 flex-1 min-w-0 justify-between md:justify-start">
        <ArrowRight className="w-4 h-4 text-zinc-300 dark:text-zinc-700 hidden md:block shrink-0" />
        
        <div className="flex-1 min-w-0 font-mono text-xs">
          {newName ? (
            <div className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1.5 rounded border border-emerald-100 dark:border-emerald-900/30 overflow-x-auto whitespace-nowrap scrollbar-thin" title={newName}>
              {newName}
            </div>
          ) : (
            <div className="text-zinc-400 dark:text-zinc-500 italic px-2 py-1.5 bg-zinc-50 dark:bg-zinc-900/40 rounded border border-zinc-100 dark:border-zinc-800/50 overflow-x-auto whitespace-nowrap scrollbar-thin">
              Sem novo nome atribuído
            </div>
          )}
        </div>

        {/* Delete Row button */}
        <button
          type="button"
          id={`remove-btn-${fileItem.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(fileItem.id);
          }}
          className="p-1.5 ml-2 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
          title="Remover arquivo"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
