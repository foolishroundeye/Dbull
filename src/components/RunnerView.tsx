import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Zap,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { AppSettings, ConfigItem, RunnerJob, WordlistItem } from '../types.ts';

interface Props {
  runners: RunnerJob[];
  configs: ConfigItem[];
  wordlists: WordlistItem[];
  settings: AppSettings;
  onRefresh: () => Promise<void>;
  onHitsUpdated: () => Promise<void>;
}

export const RunnerView: React.FC<Props> = ({
  runners,
  configs,
  wordlists,
  settings,
  onRefresh,
  onHitsUpdated,
}) => {
  const [selectedId, setSelectedId] = useState<string>(runners[0]?.id || '');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newCfgId, setNewCfgId] = useState(configs[0]?.id || '');
  const [newWlId, setNewWlId] = useState(wordlists[0]?.id || '');
  const [newBots, setNewBots] = useState(5);
  const [newUseProxies, setNewUseProxies] = useState(false);

  const activeRunner = runners.find((r) => r.id === selectedId) || runners[0];
  const prevHitsRef = useRef<number>(activeRunner?.hits || 0);

  // Poll while any runner is active
  useEffect(() => {
    const anyRunning = runners.some((r) => r.status === 'RUNNING');
    if (!anyRunning) return;
    const timer = setInterval(() => {
      void onRefresh();
      void onHitsUpdated();
    }, 650);
    return () => clearInterval(timer);
  }, [runners, onRefresh, onHitsUpdated]);

  // Play hit sound if enabled in OBSettings
  useEffect(() => {
    if (!activeRunner) return;
    if (
      settings.ob.Sounds.EnableSounds &&
      activeRunner.hits > prevHitsRef.current
    ) {
      const audio = new Audio(settings.ob.Sounds.OnHitSound || '/sounds/rifle_hit.wav');
      audio.volume = 0.35;
      audio.play().catch(() => {});
    }
    prevHitsRef.current = activeRunner.hits;
  }, [activeRunner?.hits, settings.ob.Sounds]);

  useEffect(() => {
    if (!selectedId && runners[0]) {
      setSelectedId(runners[0].id);
    }
  }, [runners, selectedId]);

  async function handleAction(id: string, action: 'start' | 'pause' | 'stop') {
    await fetch(`/api/runners/${id}/${action}`, { method: 'POST' });
    await onRefresh();
    await onHitsUpdated();
  }

  async function handleUpdateRunner(patch: Partial<RunnerJob>) {
    if (!activeRunner) return;
    await fetch(`/api/runners/${activeRunner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await onRefresh();
  }

  async function handleCreateRunner(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/runners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configId: newCfgId || configs[0]?.id,
        wordlistId: newWlId || wordlists[0]?.id,
        botsCount: newBots,
        useProxies: newUseProxies,
      }),
    });
    const created = await res.json();
    setShowNewModal(false);
    await onRefresh();
    if (created?.id) setSelectedId(created.id);
  }

  async function handleDeleteRunner(id: string) {
    await fetch(`/api/runners/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  const themes = settings.ob.Themes;

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      {/* Top Runner Selector Strip */}
      <div className="flex items-center justify-between gap-2 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          {runners.map((r) => {
            const isSel = activeRunner?.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-colors shrink-0 ${
                  isSel
                    ? 'bg-[#1e90ff]/20 border-[#1e90ff] text-white'
                    : 'bg-[#1f1f1f] border-[#333] text-[#bbb] hover:border-[#555]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    r.status === 'RUNNING'
                      ? 'bg-[#adff2f] animate-pulse'
                      : r.status === 'PAUSED'
                      ? 'bg-[#ffff00]'
                      : r.status === 'COMPLETED'
                      ? 'bg-[#1e90ff]'
                      : 'bg-[#666]'
                  }`}
                />
                <span>{r.name}</span>
                <span className="text-[10px] opacity-70">
                  ({r.tested}/{r.total})
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            setNewCfgId(configs[0]?.id || '');
            setNewWlId(wordlists[0]?.id || '');
            setShowNewModal(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#1e90ff] hover:bg-[#1a7ad9] text-white shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          New Runner
        </button>
      </div>

      {!activeRunner ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#161616] border border-[#2d2d2d] rounded text-[#888]">
          <p className="text-sm mb-3">No runners configured.</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-[#1e90ff] text-white rounded text-xs font-semibold"
          >
            Create Runner
          </button>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Controls & Metrics */}
          <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto pr-1">
            <div className="bg-[#161616] border border-[#2d2d2d] rounded p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-2">
                <div>
                  <h2 className="text-sm font-bold text-white">{activeRunner.name}</h2>
                  <p className="text-[11px] text-[#888]">
                    Status: <span className="font-semibold text-[#dcdcdc]">{activeRunner.status}</span> · Elapsed:{' '}
                    {activeRunner.elapsedSeconds}s
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteRunner(activeRunner.id)}
                  title="Remove Runner"
                  className="p-1.5 text-[#888] hover:text-[#ff6347] rounded hover:bg-[#222]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Config</label>
                  <select
                    disabled={activeRunner.status === 'RUNNING'}
                    value={activeRunner.configId}
                    onChange={(e) => handleUpdateRunner({ configId: e.target.value })}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-[#dcdcdc] disabled:opacity-60"
                  >
                    {configs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Wordlist</label>
                  <select
                    disabled={activeRunner.status === 'RUNNING'}
                    value={activeRunner.wordlistId}
                    onChange={(e) => handleUpdateRunner({ wordlistId: e.target.value })}
                    className="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-[#dcdcdc] disabled:opacity-60"
                  >
                    {wordlists.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.validLines})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#888] mb-1">
                    Bots (Threads: {activeRunner.botsCount})
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    disabled={activeRunner.status === 'RUNNING'}
                    value={activeRunner.botsCount}
                    onChange={(e) =>
                      handleUpdateRunner({ botsCount: Number(e.target.value) })
                    }
                    className="w-full accent-[#1e90ff]"
                  />
                </div>

                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={activeRunner.status === 'RUNNING'}
                      checked={activeRunner.useProxies}
                      onChange={(e) =>
                        handleUpdateRunner({ useProxies: e.target.checked })
                      }
                      className="accent-[#1e90ff]"
                    />
                    <span className="text-xs text-[#dcdcdc]">Use Proxies</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {activeRunner.status !== 'RUNNING' ? (
                  <button
                    onClick={() => handleAction(activeRunner.id, 'start')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-[#2d6a1e] hover:bg-[#378224] text-white text-xs font-bold"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {activeRunner.status === 'PAUSED' ? 'RESUME' : 'START'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction(activeRunner.id, 'pause')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded bg-[#b58900] hover:bg-[#cfa000] text-white text-xs font-bold"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    PAUSE
                  </button>
                )}

                <button
                  onClick={() => handleAction(activeRunner.id, 'stop')}
                  disabled={activeRunner.status === 'IDLE' || activeRunner.status === 'COMPLETED'}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-[#8b261d] hover:bg-[#a82f24] disabled:opacity-40 text-white text-xs font-bold"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  STOP
                </button>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[#999]">
                  <span>
                    Progress: {activeRunner.tested} / {activeRunner.total}
                  </span>
                  <span className="font-mono text-[#1e90ff] font-bold">
                    {activeRunner.progress}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#111] rounded overflow-hidden border border-[#2d2d2d]">
                  <div
                    className="h-full bg-[#1e90ff] transition-all duration-200"
                    style={{ width: `${activeRunner.progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#161616] border border-[#2d2d2d] rounded p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#888]">
                  <span>HITS</span>
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: themes.ForegroundGood }} />
                </div>
                <div
                  className="text-xl font-bold font-mono mt-1"
                  style={{ color: themes.ForegroundGood }}
                >
                  {activeRunner.hits}
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2d2d2d] rounded p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#888]">
                  <span>CUSTOM</span>
                  <Zap className="w-3.5 h-3.5" style={{ color: themes.ForegroundCustom }} />
                </div>
                <div
                  className="text-xl font-bold font-mono mt-1"
                  style={{ color: themes.ForegroundCustom }}
                >
                  {activeRunner.custom}
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2d2d2d] rounded p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#888]">
                  <span>FAILS</span>
                  <XCircle className="w-3.5 h-3.5" style={{ color: themes.ForegroundBad }} />
                </div>
                <div
                  className="text-xl font-bold font-mono mt-1"
                  style={{ color: themes.ForegroundBad }}
                >
                  {activeRunner.fails}
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2d2d2d] rounded p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#888]">
                  <span>RETRIES</span>
                  <RefreshCw className="w-3.5 h-3.5" style={{ color: themes.ForegroundRetry }} />
                </div>
                <div
                  className="text-xl font-bold font-mono mt-1"
                  style={{ color: themes.ForegroundRetry }}
                >
                  {activeRunner.retries}
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2d2d2d] rounded p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#888]">
                  <span>BANNED</span>
                  <ShieldAlert className="w-3.5 h-3.5 text-[#ff4500]" />
                </div>
                <div className="text-xl font-bold font-mono mt-1 text-[#ff4500]">
                  {activeRunner.banned}
                </div>
              </div>

              <div className="bg-[#161616] border border-[#2d2d2d] rounded p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[#888]">
                  <span>CPM</span>
                  <span className="text-[10px] text-[#1e90ff] font-mono">REQ/M</span>
                </div>
                <div className="text-xl font-bold font-mono mt-1 text-[#1e90ff]">
                  {activeRunner.cpm}
                </div>
              </div>
            </div>
          </div>

          {/* Right Live Bot Output Table */}
          <div className="lg:col-span-7 bg-[#161616] border border-[#2d2d2d] rounded flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#bbb]">
                Live Runner Output
              </span>
              <span className="text-[11px] text-[#777]">
                ToCheck: <span style={{ color: themes.ForegroundToCheck }}>{activeRunner.toCheck}</span>
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#111] text-[#888] border-b border-[#2d2d2d]">
                  <tr>
                    <th className="py-2 px-3 font-medium">Time</th>
                    <th className="py-2 px-3 font-medium">Data</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Proxy</th>
                    <th className="py-2 px-3 font-medium">Capture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222] font-mono">
                  {activeRunner.recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[#666] font-sans">
                        Click START to execute bots against the selected wordlist and config.
                      </td>
                    </tr>
                  ) : (
                    activeRunner.recentLogs.map((log) => {
                      let statusColor = themes.ForegroundToCheck;
                      if (log.status === 'SUCCESS') statusColor = themes.ForegroundGood;
                      else if (log.status === 'FAIL') statusColor = themes.ForegroundBad;
                      else if (log.status === 'CUSTOM') statusColor = themes.ForegroundCustom;
                      else if (log.status === 'RETRY') statusColor = themes.ForegroundRetry;
                      else if (log.status === 'BAN') statusColor = '#ff4500';

                      return (
                        <tr key={log.id} className="hover:bg-[#1e1e1e]">
                          <td className="py-1.5 px-3 text-[#777] whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="py-1.5 px-3 text-[#dcdcdc] whitespace-nowrap">
                            {log.data}
                          </td>
                          <td
                            className="py-1.5 px-3 font-bold whitespace-nowrap"
                            style={{ color: statusColor }}
                          >
                            {log.customStatus ? `${log.status}:${log.customStatus}` : log.status}
                          </td>
                          <td className="py-1.5 px-3 text-[#888] whitespace-nowrap">
                            {log.proxy}
                          </td>
                          <td className="py-1.5 px-3 text-[#aaa] truncate max-w-[260px]">
                            {log.captureSummary || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* New Runner Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRunner}
            className="w-full max-w-md bg-[#1c1c1c] border border-[#3a3a3a] rounded p-4 space-y-3"
          >
            <h3 className="text-sm font-bold text-white border-b border-[#2d2d2d] pb-2">
              Create New Runner
            </h3>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Config</label>
              <select
                value={newCfgId}
                onChange={(e) => setNewCfgId(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-2 text-xs text-white"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#aaa] mb-1">Wordlist</label>
              <select
                value={newWlId}
                onChange={(e) => setNewWlId(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-2 text-xs text-white"
              >
                {wordlists.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.validLines} lines)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#aaa] mb-1">Bots</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newBots}
                  onChange={(e) => setNewBots(Number(e.target.value))}
                  className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-xs text-[#ddd] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUseProxies}
                    onChange={(e) => setNewUseProxies(e.target.checked)}
                    className="accent-[#1e90ff]"
                  />
                  Use Proxies
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 rounded bg-[#2c2c2c] hover:bg-[#383838] text-xs text-[#ccc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#1e90ff] hover:bg-[#1a7ad9] text-xs font-bold text-white"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
