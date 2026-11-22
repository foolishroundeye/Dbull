import React, { useState } from 'react';
import { Plus, Trash2, Eye, FileText } from 'lucide-react';
import { AppSettings, WordlistItem } from '../types.ts';

interface Props {
  wordlists: WordlistItem[];
  settings: AppSettings;
  onRefresh: () => Promise<void>;
}

export const WordlistManagerView: React.FC<Props> = ({
  wordlists,
  settings,
  onRefresh,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('Default');
  const [rawContent, setRawContent] = useState('');
  const [previewWl, setPreviewWl] = useState<WordlistItem | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/wordlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, rawContent }),
    });
    setName('');
    setRawContent('');
    setShowAdd(false);
    await onRefresh();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!name) setName(file.name);
    const text = await file.text();
    setRawContent(text);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/wordlists/${id}`, { method: 'DELETE' });
    if (previewWl?.id === id) setPreviewWl(null);
    await onRefresh();
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      <div className="flex items-center justify-between bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-[#bbb]">
          <FileText className="w-4 h-4 text-[#1e90ff]" />
          <span>
            Loaded Wordlists: <strong className="text-white">{wordlists.length}</strong>
          </span>
          <span className="text-[#666]">|</span>
          <span className="text-[#888]">
            Types configured in Environment.ini: {settings.wordlistTypes.length}
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e90ff] hover:bg-[#1a7ad9] text-xs font-semibold text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Wordlist
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        <div className="lg:col-span-7 bg-[#161616] border border-[#2d2d2d] rounded overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#111] text-[#888] border-b border-[#2d2d2d]">
              <tr>
                <th className="py-2 px-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium">Valid / Total</th>
                <th className="py-2 px-3 font-medium">Slices</th>
                <th className="py-2 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {wordlists.map((wl) => {
                const rule = settings.wordlistTypes.find((t) => t.name === wl.type);
                return (
                  <tr
                    key={wl.id}
                    onClick={() => setPreviewWl(wl)}
                    className={`hover:bg-[#1e1e1e] cursor-pointer ${
                      previewWl?.id === wl.id ? 'bg-[#1e90ff]/10' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-white">{wl.name}</td>
                    <td className="py-2 px-3 text-[#7fffd4]">{wl.type}</td>
                    <td className="py-2 px-3 font-mono text-[#adff2f]">
                      {wl.validLines} / {wl.totalLines}
                    </td>
                    <td className="py-2 px-3 font-mono text-[#aaa]">
                      {rule ? rule.slices.map((s) => `<${s}>`).join(', ') : '<USER>, <PASS>'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewWl(wl);
                          }}
                          className="p-1.5 text-[#aaa] hover:text-white"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(wl.id);
                          }}
                          className="p-1.5 text-[#aaa] hover:text-[#ff6347]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-5 bg-[#161616] border border-[#2d2d2d] rounded flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-[#2a2a2a] text-xs font-bold text-[#bbb]">
            {previewWl ? `Preview: ${previewWl.name}` : 'Select a Wordlist to Inspect'}
          </div>
          <div className="flex-1 overflow-auto p-3 font-mono text-xs space-y-1">
            {previewWl ? (
              previewWl.lines.slice(0, 100).map((line, idx) => (
                <div key={idx} className="flex items-center gap-3 text-[#ccc] border-b border-[#1e1e1e] pb-1">
                  <span className="text-[#555] w-6 text-right">{idx + 1}</span>
                  <span className="truncate">{line}</span>
                </div>
              ))
            ) : (
              <div className="text-[#666] font-sans py-10 text-center">
                Click any wordlist row to inspect validated lines and slice mappings.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleAdd}
            className="w-full max-w-md bg-[#1c1c1c] border border-[#3a3a3a] rounded p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-white">Add Wordlist</h3>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="test_combos.txt"
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Wordlist Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
              >
                {settings.wordlistTypes.map((wt) => (
                  <option key={wt.name} value={wt.name}>
                    {wt.name} ({wt.slices.join(wt.separator || ':')})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">
                Upload .txt or Paste Lines
              </label>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="block w-full text-xs text-[#aaa] mb-2"
              />
              <textarea
                required
                rows={7}
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                placeholder={'demo:demo123\nalice@example.com:Pass123!'}
                className="w-full mono-editor bg-[#111] border border-[#333] rounded p-2.5 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 rounded bg-[#2c2c2c] text-xs text-[#ccc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#1e90ff] text-xs font-bold text-white"
              >
                Save Wordlist
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
