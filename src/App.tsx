import React, { useCallback, useEffect, useState } from 'react';
import {
  PlayCircle,
  Globe,
  FileText,
  FolderGit2,
  Layers,
  Database,
  Wrench,
  Settings as SettingsIcon,
  Crosshair,
} from 'lucide-react';
import {
  AppSettings,
  ConfigItem,
  HitItem,
  ProxyItem,
  RunnerJob,
  WordlistItem,
} from './types.ts';
import { RunnerView } from './components/RunnerView.tsx';
import { ProxyManagerView } from './components/ProxyManagerView.tsx';
import { WordlistManagerView } from './components/WordlistManagerView.tsx';
import { ConfigsView } from './components/ConfigsView.tsx';
import { StackerView } from './components/StackerView.tsx';
import { HitsDbView } from './components/HitsDbView.tsx';
import { ToolsView } from './components/ToolsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

type TabId =
  | 'runner'
  | 'proxies'
  | 'wordlists'
  | 'configs'
  | 'stacker'
  | 'hits'
  | 'tools'
  | 'settings';

export function App() {
  const [tab, setTab] = useState<TabId>('runner');
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [wordlists, setWordlists] = useState<WordlistItem[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [hits, setHits] = useState<HitItem[]>([]);
  const [runners, setRunners] = useState<RunnerJob[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeStackerConfigId, setActiveStackerConfigId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    const res = await fetch('/api/configs');
    const data: ConfigItem[] = await res.json();
    setConfigs(data);
    setActiveStackerConfigId((prev) =>
      prev && data.some((c) => c.id === prev) ? prev : data[0]?.id || ''
    );
  }, []);

  const fetchWordlists = useCallback(async () => {
    const res = await fetch('/api/wordlists');
    setWordlists(await res.json());
  }, []);

  const fetchProxies = useCallback(async () => {
    const res = await fetch('/api/proxies');
    setProxies(await res.json());
  }, []);

  const fetchHits = useCallback(async () => {
    const res = await fetch('/api/hits');
    setHits(await res.json());
  }, []);

  const fetchRunners = useCallback(async () => {
    const res = await fetch('/api/runners');
    setRunners(await res.json());
  }, []);

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    setSettings(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([
      fetchConfigs(),
      fetchWordlists(),
      fetchProxies(),
      fetchHits(),
      fetchRunners(),
      fetchSettings(),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fetchConfigs, fetchWordlists, fetchProxies, fetchHits, fetchRunners, fetchSettings]);

  async function handleSaveSettings(next: AppSettings) {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    setSettings(await res.json());
  }

  function handleOpenInStacker(cfg: ConfigItem) {
    setActiveStackerConfigId(cfg.id);
    setTab('stacker');
  }

  if (loading || !settings) {
    return (
      <div className="h-screen w-screen bg-[#111] text-[#dcdcdc] flex items-center justify-center text-sm font-mono">
        Loading PrivateBullet Web Studio...
      </div>
    );
  }

  const themes = settings.ob.Themes;
  const activeStackerConfig =
    configs.find((c) => c.id === activeStackerConfigId) || configs[0] || null;

  const navItems: Array<{ id: TabId; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'runner', label: 'Runner', icon: <PlayCircle className="w-4 h-4" /> },
    { id: 'proxies', label: 'Proxy Manager', icon: <Globe className="w-4 h-4" /> },
    { id: 'wordlists', label: 'Wordlists', icon: <FileText className="w-4 h-4" /> },
    { id: 'configs', label: 'Configs', icon: <FolderGit2 className="w-4 h-4" /> },
    { id: 'stacker', label: 'Stacker', icon: <Layers className="w-4 h-4" /> },
    {
      id: 'hits',
      label: 'Hits DB',
      icon: <Database className="w-4 h-4" />,
      badge: hits.length,
    },
    { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{
        backgroundColor: themes.BackgroundSecondary,
        color: themes.ForegroundMain,
      }}
    >
      {/* Top Window / Navigation Bar */}
      <header
        className="flex items-center justify-between px-3 border-b border-[#2d2d2d] shrink-0 overflow-x-auto"
        style={{ backgroundColor: themes.BackgroundMain }}
      >
        <div className="flex items-center gap-2.5 py-2 pr-4 shrink-0">
          <div className="w-7 h-7 rounded bg-[#1e90ff]/15 border border-[#1e90ff]/50 flex items-center justify-center">
            <Crosshair className="w-4 h-4 text-[#1e90ff]" />
          </div>
          <div className="leading-tight">
            <div className="text-xs font-extrabold tracking-wide text-white uppercase">
              PrivateBullet <span className="text-[#1e90ff]">1.0</span>
            </div>
            <div className="text-[10px] text-[#888]">Web Automation & LoliScript Studio</div>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap"
                style={{
                  borderColor: active ? themes.ForegroundMenuSelected : 'transparent',
                  color: active ? themes.ForegroundMenuSelected : '#aaa',
                  backgroundColor: active ? 'rgba(30, 144, 255, 0.08)' : 'transparent',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#111] border border-[#333] text-[10px] font-mono text-[#adff2f]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {tab === 'runner' && (
          <RunnerView
            runners={runners}
            configs={configs}
            wordlists={wordlists}
            settings={settings}
            onRefresh={fetchRunners}
            onHitsUpdated={fetchHits}
          />
        )}
        {tab === 'proxies' && (
          <ProxyManagerView
            proxies={proxies}
            settings={settings}
            onRefresh={fetchProxies}
          />
        )}
        {tab === 'wordlists' && (
          <WordlistManagerView
            wordlists={wordlists}
            settings={settings}
            onRefresh={fetchWordlists}
          />
        )}
        {tab === 'configs' && (
          <ConfigsView
            configs={configs}
            onRefresh={fetchConfigs}
            onOpenInStacker={handleOpenInStacker}
          />
        )}
        {tab === 'stacker' && (
          <StackerView
            config={activeStackerConfig}
            settings={settings}
            onConfigUpdated={fetchConfigs}
          />
        )}
        {tab === 'hits' && (
          <HitsDbView hits={hits} settings={settings} onRefresh={fetchHits} />
        )}
        {tab === 'tools' && <ToolsView />}
        {tab === 'settings' && (
          <SettingsView settings={settings} onSave={handleSaveSettings} />
        )}
      </main>
    </div>
  );
}

export default App;
