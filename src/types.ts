/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RenameableFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl: string | null;
  extension: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
}

export interface RenameProgress {
  total: number;
  current: number;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  currentFileName: string;
}

export interface AppSettings {
  filterByExtension: 'all' | 'images' | 'audio' | 'video' | 'pdf';
  keepExtension: boolean;
  prefix: string;
  suffix: string;
  darkMode: boolean;
}
