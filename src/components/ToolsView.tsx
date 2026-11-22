import React, { useState } from 'react';
import { Wrench, Play } from 'lucide-react';

export const ToolsView: React.FC = () => {
  const [activeTool, setActiveTool] = useState<'parser' | 'list'>('parser');

  // Parser Tester state
  const [parseMode, setParseMode] = useState<'LR' | 'JSON' | 'CSS' | 'REGEX'>('JSON');
  const [sampleInput, setSampleInput] = useState(
    '{\n  "user": "demo",\n  "subscription": {\n    "plan": "Enterprise Pro",\n    "points": 4200\n  }\n}'
  );
  const [leftDelim, setLeftDelim] = useState('"plan": "');
  const [rightDelim, setRightDelim] = useState('"');
  const [jsonField, setJsonField] = useState('subscription.plan');
  const [cssSelector, setCssSelector] = useState('.profile-name');
  const [cssAttribute, setCssAttribute] = useState('innerText');
  const [regexPattern, setRegexPattern] = useState('"plan":\\s*"([^"]+)"');
  const [regexOutput, setRegexOutput] = useState('[1]');
  const [recursive, setRecursive] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);

  // Combo / List Tool state
  const [listInput, setListInput] = useState('demo:demo123\ndemo:demo123\nalice@example.com:Pass123!\ninvalid_line\nbob:secret99');
  const [listOutput, setListOutput] = useState('');

  async function runParseTest() {
    const res = await fetch('/api/tools/parse-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: sampleInput,
        mode: parseMode,
        leftDelim,
        rightDelim,
        jsonField,
        cssSelector,
        cssAttribute,
        regexPattern,
        regexOutput,
        recursive,
      }),
    });
    const data = await res.json();
    setMatches(data.matches || []);
  }

  function transformList(action: 'dedupe' | 'shuffle' | 'filterColon' | 'sort') {
    const lines = listInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let out = [...lines];
    if (action === 'dedupe') out = Array.from(new Set(lines));
    else if (action === 'shuffle') out.sort(() => Math.random() - 0.5);
    else if (action === 'filterColon') out = lines.filter((l) => l.includes(':'));
    else if (action === 'sort') out.sort();
    setListOutput(out.join('\n'));
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      <div className="flex items-center gap-2 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <Wrench className="w-4 h-4 text-[#1e90ff]" />
        <button
          onClick={() => setActiveTool('parser')}
          className={`px-3 py-1 rounded text-xs font-semibold ${
            activeTool === 'parser'
              ? 'bg-[#1e90ff] text-white'
              : 'bg-[#222] text-[#aaa] hover:text-white'
          }`}
        >
          LR / JSON / CSS / Regex Tester
        </button>
        <button
          onClick={() => setActiveTool('list')}
          className={`px-3 py-1 rounded text-xs font-semibold ${
            activeTool === 'list'
              ? 'bg-[#1e90ff] text-white'
              : 'bg-[#222] text-[#aaa] hover:text-white'
          }`}
        >
          List & Combo Processor
        </button>
      </div>

      {activeTool === 'parser' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          <div className="lg:col-span-7 bg-[#161616] border border-[#2d2d2d] rounded p-3 flex flex-col gap-2 min-h-0">
            <label className="text-xs font-bold text-[#bbb]">Source Input</label>
            <textarea
              value={sampleInput}
              onChange={(e) => setSampleInput(e.target.value)}
              className="flex-1 mono-editor bg-[#111] border border-[#333] rounded p-2.5 text-xs text-white resize-none"
            />
          </div>

          <div className="lg:col-span-5 bg-[#161616] border border-[#2d2d2d] rounded p-3 flex flex-col gap-3 text-xs overflow-auto">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-[#888] mb-1">Parser Mode</label>
                <select
                  value={parseMode}
                  onChange={(e) => setParseMode(e.target.value as typeof parseMode)}
                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-white"
                >
                  <option value="LR">LR (Left / Right)</option>
                  <option value="JSON">JSON Path</option>
                  <option value="CSS">CSS Selector</option>
                  <option value="REGEX">REGEX</option>
                </select>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(e) => setRecursive(e.target.checked)}
                    className="accent-[#1e90ff]"
                  />
                  <span>Recursive</span>
                </label>
              </div>
            </div>

            {parseMode === 'LR' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Left Delimiter</label>
                  <input
                    value={leftDelim}
                    onChange={(e) => setLeftDelim(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Right Delimiter</label>
                  <input
                    value={rightDelim}
                    onChange={(e) => setRightDelim(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                  />
                </div>
              </div>
            )}

            {parseMode === 'JSON' && (
              <div>
                <label className="block text-[11px] text-[#888] mb-1">JSON Field</label>
                <input
                  value={jsonField}
                  onChange={(e) => setJsonField(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 font-mono text-white"
                />
              </div>
            )}

            {parseMode === 'CSS' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">CSS Selector</label>
                  <input
                    value={cssSelector}
                    onChange={(e) => setCssSelector(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Attribute</label>
                  <input
                    value={cssAttribute}
                    onChange={(e) => setCssAttribute(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                  />
                </div>
              </div>
            )}

            {parseMode === 'REGEX' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Regex Pattern</label>
                  <input
                    value={regexPattern}
                    onChange={(e) => setRegexPattern(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Output</label>
                  <input
                    value={regexOutput}
                    onChange={(e) => setRegexOutput(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                  />
                </div>
              </div>
            )}

            <button
              onClick={runParseTest}
              className="flex items-center justify-center gap-1.5 py-2 rounded bg-[#2d6a1e] hover:bg-[#378224] text-white font-bold"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Test Parse
            </button>

            <div className="flex-1 bg-[#111] border border-[#2a2a2a] rounded p-2.5 space-y-1 font-mono overflow-auto">
              <div className="text-[11px] text-[#888] mb-1">
                Matches ({matches.length}):
              </div>
              {matches.length === 0 ? (
                <div className="text-[#555]">No matches yet.</div>
              ) : (
                matches.map((m, i) => (
                  <div key={i} className="text-[#adff2f] border-b border-[#1e1e1e] pb-1">
                    [{i}] {m}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
          <div className="bg-[#161616] border border-[#2d2d2d] rounded p-3 flex flex-col gap-2 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#bbb]">Input Lines</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => transformList('dedupe')}
                  className="px-2 py-1 rounded bg-[#262626] hover:bg-[#333] text-[11px] text-white"
                >
                  Dedupe
                </button>
                <button
                  onClick={() => transformList('filterColon')}
                  className="px-2 py-1 rounded bg-[#262626] hover:bg-[#333] text-[11px] text-white"
                >
                  Keep User:Pass
                </button>
                <button
                  onClick={() => transformList('sort')}
                  className="px-2 py-1 rounded bg-[#262626] hover:bg-[#333] text-[11px] text-white"
                >
                  Sort
                </button>
                <button
                  onClick={() => transformList('shuffle')}
                  className="px-2 py-1 rounded bg-[#262626] hover:bg-[#333] text-[11px] text-white"
                >
                  Shuffle
                </button>
              </div>
            </div>
            <textarea
              value={listInput}
              onChange={(e) => setListInput(e.target.value)}
              className="flex-1 mono-editor bg-[#111] border border-[#333] rounded p-2.5 text-xs text-white resize-none"
            />
          </div>

          <div className="bg-[#161616] border border-[#2d2d2d] rounded p-3 flex flex-col gap-2 min-h-0">
            <span className="text-xs font-bold text-[#bbb]">Processed Output</span>
            <textarea
              readOnly
              value={listOutput}
              className="flex-1 mono-editor bg-[#111] border border-[#333] rounded p-2.5 text-xs text-[#adff2f] resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
