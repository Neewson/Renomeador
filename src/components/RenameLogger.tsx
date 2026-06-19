import React, { useState } from 'react';
import { Terminal, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Copy, Download, Trash2 } from 'lucide-react';
import { LogEntry } from '../types';

interface RenameLoggerProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const RenameLogger: React.FC<RenameLoggerProps> = ({ logs, onClearLogs }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  const copyLogsToClipboard = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}${l.details ? ` \nDetalles: ${l.details}` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    alert('Logs copiados para a área de transferência!');
  };

  const downloadLogsAsText = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}${l.details ? ` \nDetalles: ${l.details}` : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `renomeador-logs-${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="rename-logger-root" className="border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 overflow-hidden shadow-sm transition-all duration-300">
      {/* Header */}
      <button
        type="button"
        id="toggle-logger-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-sm">Log de Atividades ({logs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {logs.some(l => l.type === 'error') && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 animate-pulse">
              Erros Detectados
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4" id="logger-panel">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-1">
              {(['all', 'success', 'warning', 'error'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  id={`filter-log-${t}`}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    filter === t
                      ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 scale-102 shadow-sm'
                      : 'bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t === 'all' && 'Todos'}
                  {t === 'success' && 'Sucessos'}
                  {t === 'warning' && 'Alertas'}
                  {t === 'error' && 'Erros'}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 justify-end">
              {logs.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={copyLogsToClipboard}
                    className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    title="Copiar Logs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadLogsAsText}
                    className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    title="Baixar Arquivo TXT"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClearLogs}
                    className="p-1.5 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 rounded-lg text-xs transition-colors flex items-center gap-1.5"
                    title="Limpar Logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Console Output */}
          <div className="font-mono text-xs text-zinc-400 bg-zinc-950 rounded-xl p-4 max-h-64 overflow-y-auto border border-zinc-800 shadow-inner [color-scheme:dark]">
            {filteredLogs.length === 0 ? (
              <div className="text-zinc-500 text-center py-6 italic">
                Nenhum log correspondente registrado.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="flex gap-2.5 items-start select-text border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-zinc-600 select-none shrink-0 font-light">{log.timestamp}</span>
                    
                    {log.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                    {log.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                    {log.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                    {log.type === 'info' && <Terminal className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}

                    <div className="flex-1 min-w-0">
                      <div className={`
                        ${log.type === 'success' && 'text-emerald-300'}
                        ${log.type === 'warning' && 'text-amber-300'}
                        ${log.type === 'error' && 'text-rose-300'}
                        ${log.type === 'info' && 'text-sky-200'}
                      `}>
                        {log.message}
                      </div>
                      {log.details && (
                        <pre className="mt-1 text-[11px] text-zinc-500 whitespace-pre-wrap font-light leading-relaxed">
                          {log.details}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
            <span>Legenda:</span>
            <span className="text-emerald-600 dark:text-emerald-400">● Sucesso</span>
            <span className="text-amber-500">● Alerta</span>
            <span className="text-rose-500">● Erro</span>
          </div>
        </div>
      )}
    </div>
  );
};
