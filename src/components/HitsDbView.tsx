import React, { useState } from 'react';
import { Download, Trash2, Search } from 'lucide-react';
import { AppSettings, HitItem } from '../types.ts';

interface Props {
  hits: HitItem[];
  settings: AppSettings;
  onRefresh: () => Promise<void>;
}

export const HitsDbView: React.FC<Props> = ({ hits, settings, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [exportFormat, setExportFormat] = useState(
    settings.exportFormats[1] || '<DATA>:<PROXY>:<CAPTURE>'
  );

  const filtered = hits.filter((h) => {
    if (typeFilter !== 'ALL') {
      if (typeFilter === 'SUCCESS' && h.type !== 'SUCCESS') return false;
      if (typeFilter === 'CUSTOM' && h.type !== 'CUSTOM') return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const capStr = JSON.stringify(h.captures).toLowerCase();
      return (
        h.data.toLowerCase().includes(q) ||
        h.configName.toLowerCase().includes(q) ||
        capStr.includes(q)
      );
    }
    return true;
  });

  async function handleDelete(id: string) {
    await fetch(`/api/hits/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  async function handleClearAll() {
    await fetch('/api/hits', { method: 'DELETE' });
    await onRefresh();
  }

  function handleExport() {
    const lines = filtered.map((h) => {
      const cap = Object.entries(h.captures)
        .map(([k, v]) => `${k} = ${v}`)
        .join(' | ');
      return exportFormat
        .replace('<DATA>', h.data)
        .replace('<PROXY>', h.proxy)
        .replace('<CAPTURE>', cap);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PrivateBullet_Hits_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#777] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hits or captures..."
              className="bg-[#111] border border-[#333] rounded pl-8 pr-3 py-1.5 text-xs text-white w-56"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
          >
            <option value="ALL">All Types ({hits.length})</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="CUSTOM">CUSTOM</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs font-mono text-[#ccc]"
          >
            {settings.exportFormats.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e90ff] hover:bg-[#1a7ad9] disabled:opacity-40 text-xs font-semibold text-white"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={handleClearAll}
            disabled={hits.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#8b261d] hover:bg-[#a82f24] disabled:opacity-40 text-xs text-white"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#161616] border border-[#2d2d2d] rounded overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-[#111] text-[#888] border-b border-[#2d2d2d]">
            <tr>
              <th className="py-2 px-3 font-medium">Data</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">Config</th>
              <th className="py-2 px-3 font-medium">Wordlist</th>
              <th className="py-2 px-3 font-medium">Proxy</th>
              <th className="py-2 px-3 font-medium">Captured Data</th>
              <th className="py-2 px-3 font-medium">Date</th>
              <th className="py-2 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-[#666]">
                  No hits stored yet. Run a config in Runner to populate Hits DB.
                </td>
              </tr>
            ) : (
              filtered.map((h) => {
                const color =
                  h.type === 'SUCCESS'
                    ? settings.ob.Themes.ForegroundGood
                    : settings.ob.Themes.ForegroundCustom;
                return (
                  <tr key={h.id} className="hover:bg-[#1e1e1e]">
                    <td className="py-2 px-3 font-mono font-semibold text-white">
                      {h.data}
                    </td>
                    <td className="py-2 px-3 font-bold" style={{ color }}>
                      {h.customStatus || h.type}
                    </td>
                    <td className="py-2 px-3 text-[#ccc]">{h.configName}</td>
                    <td className="py-2 px-3 text-[#888]">{h.wordlistName}</td>
                    <td className="py-2 px-3 font-mono text-[#888]">{h.proxy}</td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(h.captures).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-1.5 py-0.5 rounded bg-[#111] border border-[#333] text-[11px] font-mono text-[#7fffd4]"
                          >
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-[#777] whitespace-nowrap">
                      {new Date(h.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDelete(h.id)}
                        className="p-1 text-[#777] hover:text-[#ff6347]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
