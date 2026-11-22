import React, { useEffect, useState } from 'react';
import {
  Play,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Power,
  Code2,
  Layers,
  BookOpen,
  X,
} from 'lucide-react';
import {
  AppSettings,
  BlockType,
  ConfigItem,
  DebuggerResult,
  KeychainEntry,
  KeyCondition,
  StackBlock,
} from '../types.ts';
import { LoliScriptHighlight } from './LoliScriptHighlight.tsx';

interface Props {
  config: ConfigItem | null;
  settings: AppSettings;
  onConfigUpdated: () => Promise<void>;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const BLOCK_BADGE_COLORS: Record<string, string> = {
  REQUEST: '#32cd32',
  KEYCHECK: '#1e90ff',
  PARSE: '#ffd700',
  FUNCTION: '#adff2f',
  UTILITY: '#f5deb3',
  SET: '#ffa500',
  DELETE: '#ff6347',
  PRINT: '#dda0dd',
};

const SYNTAX_DOCS = [
  {
    cmd: 'REQUEST',
    syntax: 'REQUEST METHOD "URL" [AutoRedirect=TRUE/FALSE]\n  CONTENT "body"\n  CONTENTTYPE "application/json"\n  HEADER "Name: Value"\n  COOKIE "key: value"',
  },
  {
    cmd: 'KEYCHECK',
    syntax: 'KEYCHECK [BanOn4XX=TRUE]\n  KEYCHAIN Success|Fail|Retry|Ban|Custom ["NAME"] OR|AND\n    KEY "match" Contains|DoesNotContain|EqualTo|NotEqualTo|MatchesRegex ["<SOURCE>"]',
  },
  {
    cmd: 'PARSE',
    syntax: 'PARSE "<SOURCE>" LR "left" "right" [Recursive=TRUE] -> VAR|CAP "NAME"\nPARSE "<SOURCE>" JSON "field.path" -> VAR|CAP "NAME"\nPARSE "<SOURCE>" CSS ".selector" "innerText" 0 -> VAR|CAP "NAME"\nPARSE "<SOURCE>" REGEX "pattern" "[1]" -> VAR|CAP "NAME"',
  },
  {
    cmd: 'FUNCTION',
    syntax: 'FUNCTION Hash "SHA256" "<PASS>" -> VAR "HASHED"\nFUNCTION Base64Encode "<USER>:<PASS>" -> VAR "B64"\nFUNCTION RandomString "?u?u?d?d?l?l" -> VAR "RAND"\nFUNCTION Replace "old" "new" "<INPUT>" -> VAR "CLEAN"',
  },
  {
    cmd: 'UTILITY / SET / PRINT',
    syntax: 'SET VAR|CAP "NAME" "VALUE"\nDELETE VAR "NAME"\nPRINT "Debug: <USER>"\nUTILITY VARIABLE "<DATA>" Split ":" "0" -> VAR "FIRST"',
  },
];

export const StackerView: React.FC<Props> = ({
  config,
  settings,
  onConfigUpdated,
}) => {
  const [mode, setMode] = useState<'blocks' | 'script'>(
    settings.ob.General.DisplayLoliScriptOnLoad ? 'script' : 'blocks'
  );
  const [name, setName] = useState('');
  const [blocks, setBlocks] = useState<StackBlock[]>([]);
  const [scriptText, setScriptText] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);

  // Debugger state
  const [testData, setTestData] = useState('demo:demo123');
  const [testWordlistType, setTestWordlistType] = useState('Default');
  const [testProxy, setTestProxy] = useState('');
  const [running, setRunning] = useState(false);
  const [dbgResult, setDbgResult] = useState<DebuggerResult | null>(null);
  const [dbgTab, setDbgTab] = useState<'log' | 'vars' | 'response'>('log');
  const [respSubTab, setRespSubTab] = useState<'body' | 'headers' | 'html'>('body');

  useEffect(() => {
    if (!config) return;
    setName(config.name);
    setBlocks(config.blocks || []);
    setScriptText(config.loliScript || '');
    setSelectedBlockId(config.blocks?.[0]?.id || '');
    setTestWordlistType(config.allowedWordlist1 || 'Default');
  }, [config?.id]);

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[#888]">
        Select a config from the Configs tab to open it in Stacker.
      </div>
    );
  }

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  async function saveConfig(syncFrom: 'blocks' | 'script', overrideBlocks?: StackBlock[], overrideScript?: string) {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/configs/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          blocks: overrideBlocks ?? blocks,
          loliScript: overrideScript ?? scriptText,
          syncFrom,
        }),
      });
      const updated: ConfigItem = await res.json();
      setBlocks(updated.blocks);
      setScriptText(updated.loliScript);
      if (!updated.blocks.some((b) => b.id === selectedBlockId)) {
        setSelectedBlockId(updated.blocks[0]?.id || '');
      }
      setSaveNotice('Saved');
      setTimeout(() => setSaveNotice(''), 1800);
      await onConfigUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function switchMode(nextMode: 'blocks' | 'script') {
    if (nextMode === mode) return;
    // Sync current edits to server so both views stay aligned
    await saveConfig(mode === 'blocks' ? 'blocks' : 'script');
    setMode(nextMode);
  }

  function addBlock(type: BlockType) {
    const newBlock: StackBlock = {
      id: uid(),
      type,
      label: `${type} Block`,
    };
    if (type === 'REQUEST') {
      newBlock.method = 'GET';
      newBlock.url = '/api/sandbox/profile?user=<USER>';
      newBlock.headers = {};
      newBlock.cookies = {};
      newBlock.autoRedirect = true;
      newBlock.readResponseSource = true;
    } else if (type === 'KEYCHECK') {
      newBlock.banOn4XX = false;
      newBlock.banOnToCheck = true;
      newBlock.keychains = [
        {
          id: uid(),
          type: 'Success',
          mode: 'OR',
          keys: [{ id: uid(), target: '<SOURCE>', condition: 'Contains', value: 'ok' }],
        },
      ];
    } else if (type === 'PARSE') {
      newBlock.parseTarget = '<SOURCE>';
      newBlock.parseType = 'LR';
      newBlock.leftDelim = '';
      newBlock.rightDelim = '';
      newBlock.isCapture = true;
      newBlock.varName = 'PARSED_VAL';
    } else if (type === 'FUNCTION') {
      newBlock.functionName = 'Hash';
      newBlock.functionArg1 = 'SHA256';
      newBlock.functionInput = '<PASS>';
      newBlock.varName = 'HASHED';
      newBlock.isCapture = false;
    } else if (type === 'UTILITY') {
      newBlock.utilityGroup = 'VARIABLE';
      newBlock.utilityTarget = '<DATA>';
      newBlock.utilityAction = 'Split';
      newBlock.utilityParam1 = ':';
      newBlock.utilityParam2 = '0';
      newBlock.varName = 'SPLIT_OUT';
    } else if (type === 'SET') {
      newBlock.varName = 'MY_VAR';
      newBlock.setValue = 'hello';
    } else if (type === 'DELETE') {
      newBlock.varName = 'MY_VAR';
    } else if (type === 'PRINT') {
      newBlock.printText = 'Testing <USER>';
    }
    const next = [...blocks, newBlock];
    setBlocks(next);
    setSelectedBlockId(newBlock.id);
  }

  function updateBlock(id: string, patch: Partial<StackBlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setBlocks(copy);
  }

  function deleteBlock(id: string) {
    const next = blocks.filter((b) => b.id !== id);
    setBlocks(next);
    if (selectedBlockId === id) {
      setSelectedBlockId(next[0]?.id || '');
    }
  }

  async function runDebugger() {
    setRunning(true);
    try {
      const payload =
        mode === 'blocks'
          ? {
              blocks,
              inputData: testData,
              wordlistType: testWordlistType,
              proxy: testProxy || undefined,
            }
          : {
              loliScript: scriptText,
              inputData: testData,
              wordlistType: testWordlistType,
              proxy: testProxy || undefined,
            };

      const res = await fetch('/api/debugger/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: DebuggerResult = await res.json();
      setDbgResult(data);
    } finally {
      setRunning(false);
    }
  }

  function statusBadgeColor(status: DebuggerResult['status']): string {
    if (status === 'SUCCESS') return settings.ob.Themes.ForegroundGood;
    if (status === 'FAIL') return settings.ob.Themes.ForegroundBad;
    if (status === 'CUSTOM') return settings.ob.Themes.ForegroundCustom;
    if (status === 'RETRY') return settings.ob.Themes.ForegroundRetry;
    if (status === 'BAN') return '#ff4500';
    return settings.ob.Themes.ForegroundToCheck;
  }

  return (
    <div className="h-full flex flex-col gap-2.5 p-3 overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#111] border border-[#333] rounded px-2.5 py-1 text-xs font-bold text-white w-56"
          />
          <button
            onClick={() => saveConfig(mode)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#1e90ff] hover:bg-[#1a7ad9] text-xs font-semibold text-white"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : saveNotice || 'Save'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-[#333] bg-[#111]">
            <button
              onClick={() => switchMode('blocks')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium ${
                mode === 'blocks' ? 'bg-[#1e90ff] text-white' : 'text-[#aaa] hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Stack
            </button>
            <button
              onClick={() => switchMode('script')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium ${
                mode === 'script' ? 'bg-[#1e90ff] text-white' : 'text-[#aaa] hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              LoliScript
            </button>
          </div>

          <button
            onClick={() => setShowSyntaxHelp(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#262626] hover:bg-[#333] border border-[#3a3a3a] text-xs text-[#ddd]"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#ffd700]" />
            Syntax Helper
          </button>
        </div>
      </div>

      {/* Main Split: Editor (left) + Debugger (right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Left: Visual Stacker or LoliScript Editor */}
        <div className="lg:col-span-7 flex flex-col gap-2.5 min-h-0">
          {mode === 'blocks' ? (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2.5 min-h-0">
              {/* Block List */}
              <div className="md:col-span-5 bg-[#161616] border border-[#2d2d2d] rounded flex flex-col min-h-0">
                <div className="px-2.5 py-2 border-b border-[#2a2a2a] flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#999]">
                    Blocks ({blocks.length})
                  </span>
                  <div className="relative group">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addBlock(e.target.value as BlockType);
                        }
                      }}
                      className="bg-[#1e90ff] text-white text-[11px] font-semibold rounded px-2 py-1 cursor-pointer"
                    >
                      <option value="">+ Add Block</option>
                      <option value="REQUEST">REQUEST</option>
                      <option value="KEYCHECK">KEYCHECK</option>
                      <option value="PARSE">PARSE</option>
                      <option value="FUNCTION">FUNCTION</option>
                      <option value="UTILITY">UTILITY</option>
                      <option value="SET">SET</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PRINT">PRINT</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {blocks.map((b, idx) => {
                    const isSel = b.id === selectedBlockId;
                    const color = BLOCK_BADGE_COLORS[b.type] || '#ccc';
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBlockId(b.id)}
                        className={`p-2 rounded border cursor-pointer transition-colors ${
                          isSel
                            ? 'bg-[#1e90ff]/15 border-[#1e90ff]'
                            : 'bg-[#111] border-[#2a2a2a] hover:border-[#444]'
                        } ${b.disabled ? 'opacity-45' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#111] shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {b.type}
                            </span>
                            <span className="text-xs text-[#e5e5e5] truncate">
                              {b.label}
                            </span>
                          </div>

                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => updateBlock(b.id, { disabled: !b.disabled })}
                              title="Toggle Enable"
                              className={`p-1 rounded hover:bg-[#222] ${
                                b.disabled ? 'text-[#ff6347]' : 'text-[#888]'
                              }`}
                            >
                              <Power className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveBlock(idx, -1)}
                              className="p-1 text-[#888] hover:text-white"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveBlock(idx, 1)}
                              className="p-1 text-[#888] hover:text-white"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteBlock(b.id)}
                              className="p-1 text-[#888] hover:text-[#ff6347]"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Block Inspector */}
              <div className="md:col-span-7 bg-[#161616] border border-[#2d2d2d] rounded flex flex-col min-h-0">
                <div className="px-3 py-2 border-b border-[#2a2a2a] text-[11px] font-bold uppercase tracking-wider text-[#999]">
                  {selectedBlock ? `Edit ${selectedBlock.type} Block` : 'Block Properties'}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                  {!selectedBlock ? (
                    <div className="text-[#666] py-8 text-center">
                      Select a block from the stack to edit its parameters.
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[11px] text-[#888] mb-1">Block Label</label>
                        <input
                          value={selectedBlock.label}
                          onChange={(e) => updateBlock(selectedBlock.id, { label: e.target.value })}
                          className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-white"
                        />
                      </div>

                      {selectedBlock.type === 'REQUEST' && (
                        <>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">Method</label>
                              <select
                                value={selectedBlock.method || 'GET'}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, {
                                    method: e.target.value as StackBlock['method'],
                                  })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-white"
                              >
                                {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[11px] text-[#888] mb-1">URL</label>
                              <input
                                value={selectedBlock.url || ''}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { url: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 font-mono text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#888] mb-1">
                              Content-Type
                            </label>
                            <input
                              value={selectedBlock.contentType || ''}
                              onChange={(e) =>
                                updateBlock(selectedBlock.id, { contentType: e.target.value })
                              }
                              placeholder="application/json"
                              className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 font-mono text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#888] mb-1">
                              POST / Request Body
                            </label>
                            <textarea
                              rows={3}
                              value={selectedBlock.content || ''}
                              onChange={(e) =>
                                updateBlock(selectedBlock.id, { content: e.target.value })
                              }
                              className="w-full mono-editor bg-[#111] border border-[#333] rounded p-2 text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#888] mb-1">
                              Headers (one per line: Key: Value)
                            </label>
                            <textarea
                              rows={3}
                              value={Object.entries(selectedBlock.headers || {})
                                .map(([k, v]) => `${k}: ${v}`)
                                .join('\n')}
                              onChange={(e) => {
                                const map: Record<string, string> = {};
                                for (const line of e.target.value.split('\n')) {
                                  const idx = line.indexOf(':');
                                  if (idx > 0) {
                                    map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                                  }
                                }
                                updateBlock(selectedBlock.id, { headers: map });
                              }}
                              className="w-full mono-editor bg-[#111] border border-[#333] rounded p-2 text-white"
                            />
                          </div>
                        </>
                      )}

                      {selectedBlock.type === 'PARSE' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">Target</label>
                              <input
                                value={selectedBlock.parseTarget || '<SOURCE>'}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { parseTarget: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 font-mono text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">Mode</label>
                              <select
                                value={selectedBlock.parseType || 'LR'}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, {
                                    parseType: e.target.value as StackBlock['parseType'],
                                  })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-white"
                              >
                                <option value="LR">LR (Left / Right)</option>
                                <option value="JSON">JSON Path</option>
                                <option value="CSS">CSS Selector</option>
                                <option value="REGEX">REGEX</option>
                              </select>
                            </div>
                          </div>

                          {(selectedBlock.parseType || 'LR') === 'LR' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] text-[#888] mb-1">Left</label>
                                <input
                                  value={selectedBlock.leftDelim || ''}
                                  onChange={(e) =>
                                    updateBlock(selectedBlock.id, { leftDelim: e.target.value })
                                  }
                                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-[#888] mb-1">Right</label>
                                <input
                                  value={selectedBlock.rightDelim || ''}
                                  onChange={(e) =>
                                    updateBlock(selectedBlock.id, { rightDelim: e.target.value })
                                  }
                                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                                />
                              </div>
                            </div>
                          )}

                          {selectedBlock.parseType === 'JSON' && (
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">
                                JSON Field (e.g. subscription.plan)
                              </label>
                              <input
                                value={selectedBlock.jsonField || ''}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { jsonField: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 font-mono text-white"
                              />
                            </div>
                          )}

                          {selectedBlock.parseType === 'CSS' && (
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-2">
                                <label className="block text-[11px] text-[#888] mb-1">
                                  CSS Selector
                                </label>
                                <input
                                  value={selectedBlock.cssSelector || ''}
                                  onChange={(e) =>
                                    updateBlock(selectedBlock.id, { cssSelector: e.target.value })
                                  }
                                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-[#888] mb-1">
                                  Attribute
                                </label>
                                <input
                                  value={selectedBlock.cssAttribute || 'innerText'}
                                  onChange={(e) =>
                                    updateBlock(selectedBlock.id, { cssAttribute: e.target.value })
                                  }
                                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                                />
                              </div>
                            </div>
                          )}

                          {selectedBlock.parseType === 'REGEX' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] text-[#888] mb-1">
                                  Regex Pattern
                                </label>
                                <input
                                  value={selectedBlock.regexPattern || ''}
                                  onChange={(e) =>
                                    updateBlock(selectedBlock.id, { regexPattern: e.target.value })
                                  }
                                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-[#888] mb-1">
                                  Output Template
                                </label>
                                <input
                                  value={selectedBlock.regexOutput || '[1]'}
                                  onChange={(e) =>
                                    updateBlock(selectedBlock.id, { regexOutput: e.target.value })
                                  }
                                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                                />
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2 items-end">
                            <div className="col-span-2">
                              <label className="block text-[11px] text-[#888] mb-1">
                                Variable Name
                              </label>
                              <input
                                value={selectedBlock.varName || ''}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { varName: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                              />
                            </div>
                            <label className="flex items-center gap-2 pb-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedBlock.isCapture)}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { isCapture: e.target.checked })
                                }
                                className="accent-[#1e90ff]"
                              />
                              <span>Is Capture</span>
                            </label>
                          </div>
                        </>
                      )}

                      {selectedBlock.type === 'KEYCHECK' && (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedBlock.banOn4XX)}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { banOn4XX: e.target.checked })
                                }
                                className="accent-[#1e90ff]"
                              />
                              <span>Ban on 4XX</span>
                            </label>
                            <button
                              onClick={() => {
                                const chains: KeychainEntry[] = [
                                  ...(selectedBlock.keychains || []),
                                  {
                                    id: uid(),
                                    type: 'Success',
                                    mode: 'OR',
                                    keys: [
                                      {
                                        id: uid(),
                                        target: '<SOURCE>',
                                        condition: 'Contains',
                                        value: '',
                                      },
                                    ],
                                  },
                                ];
                                updateBlock(selectedBlock.id, { keychains: chains });
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e90ff] text-white text-[11px] font-semibold"
                            >
                              <Plus className="w-3 h-3" />
                              Add Keychain
                            </button>
                          </div>

                          {(selectedBlock.keychains || []).map((kc, kcIdx) => (
                            <div
                              key={kc.id}
                              className="bg-[#111] border border-[#2d2d2d] rounded p-2 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <select
                                  value={kc.type}
                                  onChange={(e) => {
                                    const next = [...(selectedBlock.keychains || [])];
                                    next[kcIdx] = {
                                      ...kc,
                                      type: e.target.value as KeychainEntry['type'],
                                    };
                                    updateBlock(selectedBlock.id, { keychains: next });
                                  }}
                                  className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-white"
                                >
                                  <option value="Success">Success</option>
                                  <option value="Fail">Fail</option>
                                  <option value="Retry">Retry</option>
                                  <option value="Ban">Ban</option>
                                  <option value="Custom">Custom</option>
                                </select>

                                {kc.type === 'Custom' && (
                                  <input
                                    value={kc.customType || 'CUSTOM'}
                                    onChange={(e) => {
                                      const next = [...(selectedBlock.keychains || [])];
                                      next[kcIdx] = { ...kc, customType: e.target.value };
                                      updateBlock(selectedBlock.id, { keychains: next });
                                    }}
                                    className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-white w-24"
                                  />
                                )}

                                <select
                                  value={kc.mode}
                                  onChange={(e) => {
                                    const next = [...(selectedBlock.keychains || [])];
                                    next[kcIdx] = {
                                      ...kc,
                                      mode: e.target.value as KeychainEntry['mode'],
                                    };
                                    updateBlock(selectedBlock.id, { keychains: next });
                                  }}
                                  className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-white"
                                >
                                  <option value="OR">OR</option>
                                  <option value="AND">AND</option>
                                </select>

                                <button
                                  onClick={() => {
                                    const next = [...(selectedBlock.keychains || [])];
                                    next[kcIdx] = {
                                      ...kc,
                                      keys: [
                                        ...kc.keys,
                                        {
                                          id: uid(),
                                          target: '<SOURCE>',
                                          condition: 'Contains',
                                          value: '',
                                        },
                                      ],
                                    };
                                    updateBlock(selectedBlock.id, { keychains: next });
                                  }}
                                  className="ml-auto text-[11px] text-[#1e90ff] hover:underline"
                                >
                                  + Key
                                </button>
                                <button
                                  onClick={() => {
                                    const next = (selectedBlock.keychains || []).filter(
                                      (_, i) => i !== kcIdx
                                    );
                                    updateBlock(selectedBlock.id, { keychains: next });
                                  }}
                                  className="text-[#888] hover:text-[#ff6347]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {kc.keys.map((k, kIdx) => (
                                <div key={k.id} className="grid grid-cols-12 gap-1.5 items-center">
                                  <input
                                    value={k.target}
                                    onChange={(e) => {
                                      const next = [...(selectedBlock.keychains || [])];
                                      const keys = [...kc.keys];
                                      keys[kIdx] = { ...k, target: e.target.value };
                                      next[kcIdx] = { ...kc, keys };
                                      updateBlock(selectedBlock.id, { keychains: next });
                                    }}
                                    className="col-span-3 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 font-mono text-[11px] text-white"
                                  />
                                  <select
                                    value={k.condition}
                                    onChange={(e) => {
                                      const next = [...(selectedBlock.keychains || [])];
                                      const keys = [...kc.keys];
                                      keys[kIdx] = {
                                        ...k,
                                        condition: e.target.value as KeyCondition,
                                      };
                                      next[kcIdx] = { ...kc, keys };
                                      updateBlock(selectedBlock.id, { keychains: next });
                                    }}
                                    className="col-span-4 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 text-[11px] text-white"
                                  >
                                    {[
                                      'Contains',
                                      'DoesNotContain',
                                      'EqualTo',
                                      'NotEqualTo',
                                      'MatchesRegex',
                                      'GreaterThan',
                                      'LessThan',
                                    ].map((c) => (
                                      <option key={c} value={c}>
                                        {c}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={k.value}
                                    onChange={(e) => {
                                      const next = [...(selectedBlock.keychains || [])];
                                      const keys = [...kc.keys];
                                      keys[kIdx] = { ...k, value: e.target.value };
                                      next[kcIdx] = { ...kc, keys };
                                      updateBlock(selectedBlock.id, { keychains: next });
                                    }}
                                    placeholder="Value"
                                    className="col-span-4 bg-[#1a1a1a] border border-[#333] rounded px-1.5 py-1 font-mono text-[11px] text-white"
                                  />
                                  <button
                                    onClick={() => {
                                      const next = [...(selectedBlock.keychains || [])];
                                      next[kcIdx] = {
                                        ...kc,
                                        keys: kc.keys.filter((_, i) => i !== kIdx),
                                      };
                                      updateBlock(selectedBlock.id, { keychains: next });
                                    }}
                                    className="col-span-1 text-[#777] hover:text-[#ff6347] flex justify-center"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedBlock.type === 'FUNCTION' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">Function</label>
                              <select
                                value={selectedBlock.functionName || 'Hash'}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { functionName: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-white"
                              >
                                {[
                                  'Hash',
                                  'HMAC',
                                  'Base64Encode',
                                  'Base64Decode',
                                  'URLEncode',
                                  'URLDecode',
                                  'Replace',
                                  'Substring',
                                  'Length',
                                  'ToLowercase',
                                  'ToUppercase',
                                  'Trim',
                                  'RandomNum',
                                  'RandomString',
                                  'CurrentUnixTime',
                                  'UnixTimeToDate',
                                ].map((fn) => (
                                  <option key={fn} value={fn}>
                                    {fn}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">
                                Output Variable
                              </label>
                              <input
                                value={selectedBlock.varName || ''}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { varName: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">
                                Arg 1 (e.g. SHA256 / pattern)
                              </label>
                              <input
                                value={selectedBlock.functionArg1 || ''}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { functionArg1: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#888] mb-1">
                                Arg 2 (optional)
                              </label>
                              <input
                                value={selectedBlock.functionArg2 || ''}
                                onChange={(e) =>
                                  updateBlock(selectedBlock.id, { functionArg2: e.target.value })
                                }
                                className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#888] mb-1">
                              Input String
                            </label>
                            <input
                              value={selectedBlock.functionInput || ''}
                              onChange={(e) =>
                                updateBlock(selectedBlock.id, { functionInput: e.target.value })
                              }
                              className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 font-mono text-white"
                            />
                          </div>
                        </>
                      )}

                      {selectedBlock.type === 'SET' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-[#888] mb-1">
                              Variable Name
                            </label>
                            <input
                              value={selectedBlock.varName || ''}
                              onChange={(e) =>
                                updateBlock(selectedBlock.id, { varName: e.target.value })
                              }
                              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#888] mb-1">Value</label>
                            <input
                              value={selectedBlock.setValue || ''}
                              onChange={(e) =>
                                updateBlock(selectedBlock.id, { setValue: e.target.value })
                              }
                              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 font-mono text-white"
                            />
                          </div>
                        </div>
                      )}

                      {selectedBlock.type === 'PRINT' && (
                        <div>
                          <label className="block text-[11px] text-[#888] mb-1">Text</label>
                          <input
                            value={selectedBlock.printText || ''}
                            onChange={(e) =>
                              updateBlock(selectedBlock.id, { printText: e.target.value })
                            }
                            className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 font-mono text-white"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* LoliScript Editor + Syntax Highlighted Preview */
            <div className="flex-1 grid grid-rows-2 gap-2 min-h-0">
              <div className="bg-[#161616] border border-[#2d2d2d] rounded flex flex-col min-h-0">
                <div className="px-3 py-1.5 border-b border-[#2a2a2a] flex justify-between items-center">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#999]">
                    LoliScript Source Editor
                  </span>
                  <span className="text-[11px] text-[#666]">
                    Switch to Stack or Save to parse blocks
                  </span>
                </div>
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  spellCheck={false}
                  className="flex-1 w-full mono-editor bg-[#0f0f0f] text-[#dcdcdc] p-3 text-xs leading-5 focus:outline-none resize-none"
                />
              </div>

              <div className="bg-[#161616] border border-[#2d2d2d] rounded flex flex-col min-h-0">
                <div className="px-3 py-1.5 border-b border-[#2a2a2a] text-[11px] font-bold uppercase tracking-wider text-[#999]">
                  Syntax Highlighted Preview
                </div>
                <div className="flex-1 overflow-auto p-2">
                  <LoliScriptHighlight code={scriptText} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Debugger */}
        <div className="lg:col-span-5 bg-[#161616] border border-[#2d2d2d] rounded flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bbb]">
              Debugger
            </span>
            {dbgResult && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#777] font-mono">{dbgResult.elapsedMs}ms</span>
                <span
                  className="px-2 py-0.5 rounded font-bold text-[11px] bg-[#111] border border-[#333]"
                  style={{ color: statusBadgeColor(dbgResult.status) }}
                >
                  {dbgResult.customStatus
                    ? `${dbgResult.status}: ${dbgResult.customStatus}`
                    : dbgResult.status}
                </span>
              </div>
            )}
          </div>

          {/* Debugger Controls */}
          <div className="p-2.5 border-b border-[#2a2a2a] space-y-2 bg-[#141414]">
            <div className="grid grid-cols-12 gap-2 text-xs">
              <div className="col-span-5">
                <label className="block text-[10px] text-[#888] mb-0.5">Test Data</label>
                <input
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 font-mono text-white"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-[10px] text-[#888] mb-0.5">Wordlist Type</label>
                <select
                  value={testWordlistType}
                  onChange={(e) => setTestWordlistType(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-white"
                >
                  {settings.wordlistTypes.map((wt) => (
                    <option key={wt.name} value={wt.name}>
                      {wt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-3 flex items-end">
                <button
                  onClick={runDebugger}
                  disabled={running}
                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded bg-[#2d6a1e] hover:bg-[#378224] disabled:opacity-50 text-white font-bold"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {running ? 'Run...' : 'Start'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] text-[#888] shrink-0">Proxy (optional):</span>
              <input
                value={testProxy}
                onChange={(e) => setTestProxy(e.target.value)}
                placeholder="127.0.0.1:8080"
                className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 font-mono text-[11px] text-white"
              />
            </div>
          </div>

          {/* Debugger Output Sub-Tabs */}
          <div className="flex border-b border-[#2a2a2a] bg-[#131313] text-xs">
            {(['log', 'vars', 'response'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDbgTab(t)}
                className={`px-3 py-1.5 font-semibold uppercase text-[11px] border-b-2 transition-colors ${
                  dbgTab === t
                    ? 'border-[#1e90ff] text-white'
                    : 'border-transparent text-[#777] hover:text-[#bbb]'
                }`}
              >
                {t === 'log'
                  ? 'Execution Log'
                  : t === 'vars'
                  ? `Variables (${dbgResult ? Object.keys(dbgResult.variables).length : 0})`
                  : 'Response'}
              </button>
            ))}
          </div>

          {/* Debugger Output Body */}
          <div className="flex-1 overflow-auto p-2.5 text-xs">
            {!dbgResult ? (
              <div className="h-full flex items-center justify-center text-[#666] text-center px-4">
                Click Start to execute the active stack/script against the test data and inspect logs, captures, and HTTP responses.
              </div>
            ) : dbgTab === 'log' ? (
              <div className="space-y-1.5 font-mono text-[11px]">
                {dbgResult.logs.map((entry, idx) => {
                  const color =
                    entry.level === 'success'
                      ? settings.ob.Themes.ForegroundGood
                      : entry.level === 'error'
                      ? settings.ob.Themes.ForegroundBad
                      : entry.level === 'warn'
                      ? settings.ob.Themes.ForegroundRetry
                      : entry.level === 'var'
                      ? '#ffd700'
                      : '#ccc';
                  return (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-[#111] border border-[#222] leading-relaxed"
                    >
                      <span className="text-[#666] mr-2">[{entry.blockType}]</span>
                      <span style={{ color }}>{entry.message}</span>
                    </div>
                  );
                })}
              </div>
            ) : dbgTab === 'vars' ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#ff6347] mb-1">
                    Captures (CAP)
                  </h4>
                  {Object.keys(dbgResult.captures).length === 0 ? (
                    <p className="text-[#666] text-[11px]">No captures recorded.</p>
                  ) : (
                    <div className="bg-[#111] border border-[#2a2a2a] rounded divide-y divide-[#222] font-mono">
                      {Object.entries(dbgResult.captures).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 px-2.5 py-1.5">
                          <span className="text-[#adff2f]">{k}</span>
                          <span className="text-white break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-[11px] font-bold uppercase text-[#ffd700] mb-1">
                    Variables (VAR)
                  </h4>
                  <div className="bg-[#111] border border-[#2a2a2a] rounded divide-y divide-[#222] font-mono">
                    {Object.entries(dbgResult.variables)
                      .filter(([k]) => k !== 'SOURCE')
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2 px-2.5 py-1.5">
                          <span className="text-[#7fffd4]">{k}</span>
                          <span className="text-[#ccc] break-all max-w-[65%] text-right">
                            {v}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 h-full flex flex-col">
                {!dbgResult.lastResponse ? (
                  <p className="text-[#666]">No HTTP response captured.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between bg-[#111] border border-[#2a2a2a] rounded px-2.5 py-1.5 font-mono text-[11px]">
                      <span className="text-[#adff2f]">
                        HTTP {dbgResult.lastResponse.statusCode}
                      </span>
                      <span className="text-[#888] truncate ml-2">
                        {dbgResult.lastResponse.address}
                      </span>
                    </div>

                    <div className="flex gap-1 text-[11px]">
                      {(['body', 'headers', 'html'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setRespSubTab(st)}
                          className={`px-2 py-1 rounded ${
                            respSubTab === st
                              ? 'bg-[#1e90ff] text-white'
                              : 'bg-[#222] text-[#aaa]'
                          }`}
                        >
                          {st.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {respSubTab === 'body' && (
                      <pre className="flex-1 overflow-auto bg-[#0f0f0f] border border-[#2a2a2a] rounded p-2 text-[11px] font-mono text-[#ccc] whitespace-pre-wrap break-all">
                        {dbgResult.lastResponse.body}
                      </pre>
                    )}

                    {respSubTab === 'headers' && (
                      <div className="flex-1 overflow-auto bg-[#0f0f0f] border border-[#2a2a2a] rounded p-2 font-mono text-[11px] space-y-1">
                        {Object.entries(dbgResult.lastResponse.headers).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-[#dda0dd]">{k}: </span>
                            <span className="text-[#ccc]">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {respSubTab === 'html' && (
                      <iframe
                        title="HTML Preview"
                        sandbox=""
                        srcDoc={dbgResult.lastResponse.body}
                        className="flex-1 w-full bg-white rounded border border-[#333]"
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Syntax Helper Modal (from SyntaxHelper.xml) */}
      {showSyntaxHelp && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#1c1c1c] border border-[#3a3a3a] rounded p-4 space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-2">
              <h3 className="text-sm font-bold text-white">LoliScript Syntax Helper</h3>
              <button
                onClick={() => setShowSyntaxHelp(false)}
                className="text-[#888] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {SYNTAX_DOCS.map((doc) => (
                <div key={doc.cmd} className="space-y-1">
                  <div className="text-xs font-bold text-[#1e90ff]">{doc.cmd}</div>
                  <LoliScriptHighlight code={doc.syntax} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
