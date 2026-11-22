import React, { useState } from 'react';
import { Upload, Play, Trash2, Download, ShieldCheck } from 'lucide-react';
import { AppSettings, ProxyItem } from '../types.ts';

interface Props {
  proxies: ProxyItem[];
  settings: AppSettings;
  onRefresh: () => Promise<void>;
}

export const ProxyManagerView: React.FC<Props> = ({
  proxies,
  settings,
  onRefresh,
}) => {
  const [showImport, setShowImport] = useState(false);
  const [rawText, setRawText] = useState('');
  const [proxyType, setProxyType] = useState<'HTTP' | 'SOCKS4' | 'SOCKS5'>('HTTP');
  const [checking, setChecking] = useState(false);

  const workingCount = proxies.filter((p) => p.status === 'WORKING').length;
  const badCount = proxies.filter((p) => p.status === 'BAD').length;
  const untestedCount = proxies.filter((p) => p.status === 'UNTESTED').length;

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/proxies/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, type: proxyType }),
    });
    setRawText('');
    setShowImport(false);
    await onRefresh();
  }

  async function handleCheckAll() {
    setChecking(true);
    try {
      await fetch('/api/proxies/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await onRefresh();
    } finally {
      setChecking(false);
    }
  }

  async function handleClearBad() {
    await fetch('/api/proxies/clear-bad', { method: 'DELETE' });
    await onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/proxies/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  function handleExportWorking() {
    const list = proxies
      .filter((p) => p.status === 'WORKING')
      .map((p) =>
        p.username ? `${p.host}:${p.port}:${p.username}:${p.password}` : `${p.host}:${p.port}`
      )
      .join('\n');
    const blob = new Blob([list], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'working_proxies.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <div className="flex items-center gap-4 text-xs">
          <span>
            Total: <strong className="font-mono text-white">{proxies.length}</strong>
          </span>
          <span style={{ color: settings.ob.Themes.ForegroundGood }}>
            Working: <strong className="font-mono">{workingCount}</strong>
          </span>
          <span style={{ color: settings.ob.Themes.ForegroundBad }}>
            Bad: <strong className="font-mono">{badCount}</strong>
          </span>
          <span className="text-[#888]">
            Untested: <strong className="font-mono">{untestedCount}</strong>
          </span>
          <span className="hidden md:inline text-[11px] text-[#777] border-l border-[#333] pl-3">
            Target: {settings.proxyManager.ActiveProxySiteUrl}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#262626] hover:bg-[#333] border border-[#3a3a3a] text-xs text-white"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
          <button
            onClick={handleCheckAll}
            disabled={checking || proxies.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2d6a1e] hover:bg-[#378224] disabled:opacity-50 text-xs font-semibold text-white"
          >
            <Play className="w-3.5 h-3.5" />
            {checking ? 'Checking...' : 'Check Proxies'}
          </button>
          <button
            onClick={handleClearBad}
            disabled={badCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#8b261d] hover:bg-[#a82f24] disabled:opacity-40 text-xs text-white"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Bad
          </button>
          <button
            onClick={handleExportWorking}
            disabled={workingCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e90ff] hover:bg-[#1a7ad9] disabled:opacity-40 text-xs text-white"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#161616] border border-[#2d2d2d] rounded overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-[#111] text-[#888] border-b border-[#2d2d2d]">
            <tr>
              <th className="py-2 px-3 font-medium">Host</th>
              <th className="py-2 px-3 font-medium">Port</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium">Ping</th>
              <th className="py-2 px-3 font-medium">Region</th>
              <th className="py-2 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222] font-mono">
            {proxies.map((p) => {
              const statusColor =
                p.status === 'WORKING'
                  ? settings.ob.Themes.ForegroundGood
                  : p.status === 'BAD'
                  ? settings.ob.Themes.ForegroundBad
                  : '#888';
              return (
                <tr key={p.id} className="hover:bg-[#1e1e1e]">
                  <td className="py-2 px-3 text-white">{p.host}</td>
                  <td className="py-2 px-3 text-[#bbb]">{p.port}</td>
                  <td className="py-2 px-3 text-[#7fffd4]">{p.type}</td>
                  <td className="py-2 px-3 font-bold" style={{ color: statusColor }}>
                    {p.status}
                  </td>
                  <td className="py-2 px-3 text-[#aaa]">
                    {p.pingMs !== null ? `${p.pingMs} ms` : '—'}
                  </td>
                  <td className="py-2 px-3 text-[#888]">{p.country}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 text-[#777] hover:text-[#ff6347]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleImport}
            className="w-full max-w-md bg-[#1c1c1c] border border-[#3a3a3a] rounded p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ShieldCheck className="w-4 h-4 text-[#1e90ff]" />
              Import Proxies
            </div>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Proxy Type</label>
              <select
                value={proxyType}
                onChange={(e) => setProxyType(e.target.value as ProxyItem['type'])}
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="HTTP">HTTP</option>
                <option value="SOCKS4">SOCKS4</option>
                <option value="SOCKS5">SOCKS5</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">
                Proxy List (host:port or host:port:user:pass)
              </label>
              <textarea
                required
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={'127.0.0.1:3000\n192.168.1.50:8080'}
                className="w-full mono-editor bg-[#111] border border-[#333] rounded p-2.5 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="px-3 py-1.5 rounded bg-[#2c2c2c] text-xs text-[#ccc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#1e90ff] text-xs font-bold text-white"
              >
                Import
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
