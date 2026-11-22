import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { AppSettings } from '../types.ts';

interface Props {
  settings: AppSettings;
  onSave: (next: AppSettings) => Promise<void>;
}

export const SettingsView: React.FC<Props> = ({ settings, onSave }) => {
  const [draft, setDraft] = useState<AppSettings>(structuredClone(settings));
  const [subTab, setSubTab] = useState<'general' | 'rurilib' | 'themes' | 'env'>('general');
  const [savedMsg, setSavedMsg] = useState('');

  async function handleSave() {
    await onSave(draft);
    setSavedMsg('Settings saved');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#161616] border border-[#2d2d2d] rounded px-3 py-2">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'general', label: 'PrivateBullet (OB)' },
            { id: 'rurilib', label: 'RuriLib Engine' },
            { id: 'themes', label: 'Themes & Colors' },
            { id: 'env', label: 'Environment.ini' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`px-3 py-1.5 rounded text-xs font-semibold ${
                subTab === t.id
                  ? 'bg-[#1e90ff] text-white'
                  : 'bg-[#222] text-[#aaa] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#2d6a1e] hover:bg-[#378224] text-xs font-bold text-white"
        >
          <Save className="w-3.5 h-3.5" />
          {savedMsg || 'Save Settings'}
        </button>
      </div>

      <div className="flex-1 bg-[#161616] border border-[#2d2d2d] rounded p-4 overflow-y-auto text-xs space-y-4">
        {subTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <div>
              <label className="block text-[#888] mb-1">Default Config Author</label>
              <input
                value={draft.ob.General.DefaultAuthor}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ob: {
                      ...draft.ob,
                      General: { ...draft.ob.General, DefaultAuthor: e.target.value },
                    },
                  })
                }
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div className="space-y-2 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.ob.General.DisplayLoliScriptOnLoad}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ob: {
                        ...draft.ob,
                        General: {
                          ...draft.ob.General,
                          DisplayLoliScriptOnLoad: e.target.checked,
                        },
                      },
                    })
                  }
                  className="accent-[#1e90ff]"
                />
                <span>Display LoliScript on Stacker Load</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.ob.Sounds.EnableSounds}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ob: {
                        ...draft.ob,
                        Sounds: { ...draft.ob.Sounds, EnableSounds: e.target.checked },
                      },
                    })
                  }
                  className="accent-[#1e90ff]"
                />
                <span>Enable Rifle Hit Audio Cue (`rifle_hit.wav`)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.ob.General.RecommendedBots}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ob: {
                        ...draft.ob,
                        General: { ...draft.ob.General, RecommendedBots: e.target.checked },
                      },
                    })
                  }
                  className="accent-[#1e90ff]"
                />
                <span>Use Recommended Bots Count</span>
              </label>
            </div>
          </div>
        )}

        {subTab === 'rurilib' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
            <div>
              <label className="block text-[#888] mb-1">Wait Time Between Bots (ms)</label>
              <input
                type="number"
                value={draft.rl.General.WaitTime}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rl: {
                      ...draft.rl,
                      General: { ...draft.rl.General, WaitTime: Number(e.target.value) },
                    },
                  })
                }
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="block text-[#888] mb-1">Request Timeout (seconds)</label>
              <input
                type="number"
                value={draft.rl.General.RequestTimeout}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rl: {
                      ...draft.rl,
                      General: { ...draft.rl.General, RequestTimeout: Number(e.target.value) },
                    },
                  })
                }
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="block text-[#888] mb-1">Max Hits (0 = Unlimited)</label>
              <input
                type="number"
                value={draft.rl.General.MaxHits}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rl: {
                      ...draft.rl,
                      General: { ...draft.rl.General, MaxHits: Number(e.target.value) },
                    },
                  })
                }
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div>
              <label className="block text-[#888] mb-1">Ban Loop Evasion</label>
              <input
                type="number"
                value={draft.rl.Proxies.BanLoopEvasion}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rl: {
                      ...draft.rl,
                      Proxies: {
                        ...draft.rl.Proxies,
                        BanLoopEvasion: Number(e.target.value),
                      },
                    },
                  })
                }
                className="w-full bg-[#111] border border-[#333] rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <div className="col-span-2 flex items-center gap-6 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.rl.Proxies.ShuffleOnStart}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rl: {
                        ...draft.rl,
                        Proxies: { ...draft.rl.Proxies, ShuffleOnStart: e.target.checked },
                      },
                    })
                  }
                  className="accent-[#1e90ff]"
                />
                <span>Shuffle Wordlist on Start</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.rl.Proxies.NeverBan}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rl: {
                        ...draft.rl,
                        Proxies: { ...draft.rl.Proxies, NeverBan: e.target.checked },
                      },
                    })
                  }
                  className="accent-[#1e90ff]"
                />
                <span>Never Ban Proxies</span>
              </label>
            </div>
          </div>
        )}

        {subTab === 'themes' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl">
            {Object.entries(draft.ob.Themes).map(([key, val]) => (
              <div key={key} className="bg-[#111] border border-[#2a2a2a] rounded p-2.5">
                <label className="block text-[11px] text-[#999] mb-1.5">{key}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={val}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        ob: {
                          ...draft.ob,
                          Themes: {
                            ...draft.ob.Themes,
                            [key]: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-8 h-7 bg-transparent border-0 cursor-pointer"
                  />
                  <span className="font-mono text-white">{val}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {subTab === 'env' && (
          <div className="space-y-4 max-w-4xl">
            <div>
              <h4 className="font-bold text-white mb-2">Wordlist Types (Environment.ini)</h4>
              <div className="bg-[#111] border border-[#2a2a2a] rounded overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1a1a1a] text-[#888]">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Separator</th>
                      <th className="py-2 px-3">Slices</th>
                      <th className="py-2 px-3">Verify Regex</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222] font-mono">
                    {draft.wordlistTypes.map((wt) => (
                      <tr key={wt.name}>
                        <td className="py-1.5 px-3 text-[#7fffd4]">{wt.name}</td>
                        <td className="py-1.5 px-3 text-white">{wt.separator}</td>
                        <td className="py-1.5 px-3 text-[#adff2f]">{wt.slices.join(', ')}</td>
                        <td className="py-1.5 px-3 text-[#aaa] truncate max-w-xs">{wt.regex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-2">Custom Keychains & Export Formats</h4>
              <div className="flex flex-wrap gap-2">
                {draft.customKeychains.map((kc) => (
                  <span
                    key={kc.name}
                    className="px-2.5 py-1 rounded bg-[#111] border border-[#333] font-bold"
                    style={{ color: kc.color }}
                  >
                    {kc.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
