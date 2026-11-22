import React, { useState } from 'react';
import { Plus, Copy, Trash2, Code2, Download, Upload, Search } from 'lucide-react';
import { ConfigItem } from '../types.ts';

interface Props {
  configs: ConfigItem[];
  onRefresh: () => Promise<void>;
  onOpenInStacker: (cfg: ConfigItem) => void;
}

export const ConfigsView: React.FC<Props> = ({
  configs,
  onRefresh,
  onOpenInStacker,
}) => {
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Custom');
  const [showImport, setShowImport] = useState(false);
  const [importName, setImportName] = useState('Imported Config');
  const [importScript, setImportScript] = useState('');

  const filtered = configs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      c.author.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName || 'New Config',
        category: newCategory,
        loliScript: `## ${newName || 'New Config'}\nREQUEST GET "https://httpbin.org/get"\n\nKEYCHECK\n  KEYCHAIN Success OR\n    KEY "200" EqualTo "<RESPONSECODE>"`,
      }),
    });
    const created = await res.json();
    setShowNew(false);
    setNewName('');
    await onRefresh();
    if (created?.id) onOpenInStacker(created);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: importName || 'Imported Config',
        category: 'Imported',
        loliScript: importScript,
      }),
    });
    const created = await res.json();
    setShowImport(false);
    setImportScript('');
    await onRefresh();
    if (created?.id) onOpenInStacker(created);
  }

  async function handleDuplicate(cfg: ConfigItem) {
    await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...cfg,
        id: undefined,
        name: `${cfg.name} (Copy)`,
      }),
    });
    await onRefresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/configs/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  function handleExportLoli(cfg: ConfigItem) {
    const blob = new Blob([cfg.loliScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cfg.name.replace(/\s+/g, '_')}.loli`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#777] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search configs by name, author, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#1e90ff]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#262626] hover:bg-[#333] border border-[#3a3a3a] text-xs text-[#ddd]"
          >
            <Upload className="w-3.5 h-3.5" />
            Import LoliScript
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e90ff] hover:bg-[#1a7ad9] text-xs font-semibold text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            New Config
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#161616] border border-[#2d2d2d] rounded overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-[#111] text-[#888] border-b border-[#2d2d2d]">
            <tr>
              <th className="py-2.5 px-3 font-medium">Name</th>
              <th className="py-2.5 px-3 font-medium">Author</th>
              <th className="py-2.5 px-3 font-medium">Category</th>
              <th className="py-2.5 px-3 font-medium">Blocks</th>
              <th className="py-2.5 px-3 font-medium">Wordlist</th>
              <th className="py-2.5 px-3 font-medium">Bots</th>
              <th className="py-2.5 px-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {filtered.map((cfg) => (
              <tr
                key={cfg.id}
                onDoubleClick={() => onOpenInStacker(cfg)}
                className="hover:bg-[#1e1e1e] cursor-pointer"
              >
                <td className="py-2 px-3 font-semibold text-white">{cfg.name}</td>
                <td className="py-2 px-3 text-[#aaa]">{cfg.author}</td>
                <td className="py-2 px-3">
                  <span className="px-2 py-0.5 rounded bg-[#262626] border border-[#3a3a3a] text-[11px] text-[#7fffd4]">
                    {cfg.category}
                  </span>
                </td>
                <td className="py-2 px-3 font-mono text-[#aaa]">{cfg.blocks.length}</td>
                <td className="py-2 px-3 text-[#aaa]">{cfg.allowedWordlist1}</td>
                <td className="py-2 px-3 font-mono text-[#aaa]">{cfg.suggestedBots}</td>
                <td className="py-2 px-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onOpenInStacker(cfg)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1e90ff]/20 hover:bg-[#1e90ff]/35 text-[#1e90ff] border border-[#1e90ff]/40 text-[11px] font-semibold"
                    >
                      <Code2 className="w-3 h-3" />
                      Stacker
                    </button>
                    <button
                      onClick={() => handleExportLoli(cfg)}
                      title="Export .loli"
                      className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#aaa] hover:text-white"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(cfg)}
                      title="Duplicate"
                      className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#aaa] hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cfg.id)}
                      title="Delete"
                      className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#aaa] hover:text-[#ff6347]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm bg-[#1c1c1c] border border-[#3a3a3a] rounded p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-white">Create New Config</h3>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Config Name</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. API Health Check"
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Category</label>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="px-3 py-1.5 rounded bg-[#2c2c2c] text-xs text-[#ccc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#1e90ff] text-xs font-bold text-white"
              >
                Create & Open
              </button>
            </div>
          </form>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleImport}
            className="w-full max-w-lg bg-[#1c1c1c] border border-[#3a3a3a] rounded p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-white">Import LoliScript</h3>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Config Name</label>
              <input
                required
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">LoliScript Source</label>
              <textarea
                required
                rows={10}
                value={importScript}
                onChange={(e) => setImportScript(e.target.value)}
                placeholder={'REQUEST GET "https://httpbin.org/get"\nKEYCHECK\n  KEYCHAIN Success OR\n    KEY "200" EqualTo "<RESPONSECODE>"'}
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
