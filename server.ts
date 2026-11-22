import express from 'express';
import net from 'node:net';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { executeBotConfig, runParseLogic } from './server/engine.ts';
import { parseLoliScriptToBlocks, serializeBlocksToLoliScript } from './server/loliScript.ts';
import { store } from './server/store.ts';
import { ConfigItem, HitItem, ProxyItem, RunnerJob, WordlistItem } from './src/types.ts';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Track active runner abort flags
const runnerActiveMap = new Map<string, { paused: boolean; stopped: boolean }>();

async function runRunnerLoop(runnerId: string) {
  const job = store.runners.find((r) => r.id === runnerId);
  if (!job) return;

  const config = store.configs.find((c) => c.id === job.configId);
  const wordlist = store.wordlists.find((w) => w.id === job.wordlistId);
  if (!config || !wordlist) {
    job.status = 'STOPPED';
    return;
  }

  const state = { paused: false, stopped: false };
  runnerActiveMap.set(runnerId, state);

  const lines = [...wordlist.lines];
  if (store.settings.rl.Proxies.ShuffleOnStart) {
    lines.sort(() => Math.random() - 0.5);
  }

  job.total = lines.length;
  job.tested = 0;
  job.progress = 0;
  job.hits = 0;
  job.custom = 0;
  job.fails = 0;
  job.retries = 0;
  job.banned = 0;
  job.toCheck = 0;
  job.cpm = 0;
  job.elapsedSeconds = 0;
  job.recentLogs = [];
  job.status = 'RUNNING';
  job.startedAt = new Date().toISOString();

  const startMs = Date.now();
  let cursor = 0;
  let proxyCursor = 0;

  const getProxy = (): string => {
    if (!job.useProxies) return '';
    const pool =
      job.proxyMode === 'WORKING'
        ? store.proxies.filter((p) => p.status === 'WORKING')
        : store.proxies;
    if (pool.length === 0) return '';
    const picked = pool[proxyCursor % pool.length];
    proxyCursor++;
    return `${picked.host}:${picked.port}`;
  };

  const worker = async () => {
    while (!state.stopped) {
      if (state.paused) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      if (
        store.settings.rl.General.MaxHits > 0 &&
        job.hits >= store.settings.rl.General.MaxHits
      ) {
        state.stopped = true;
        break;
      }

      const idx = cursor++;
      if (idx >= lines.length) break;

      const dataLine = lines[idx];
      const proxy = getProxy();

      const res = await executeBotConfig({
        blocks: config.blocks,
        loliScript: config.loliScript,
        inputData: dataLine,
        wordlistType: wordlist.type,
        proxy,
        settings: store.settings,
        serverPort: PORT,
      });

      job.tested++;
      job.progress = job.total > 0 ? Math.round((job.tested / job.total) * 100) : 100;
      const elapsedMin = Math.max((Date.now() - startMs) / 60000, 0.01);
      job.elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
      job.cpm = Math.round(job.tested / elapsedMin);

      if (res.status === 'SUCCESS') {
        job.hits++;
        const hit: HitItem = {
          id: uid(),
          data: dataLine,
          type: 'SUCCESS',
          configId: config.id,
          configName: config.name,
          wordlistName: wordlist.name,
          proxy: proxy || 'Direct',
          captures: res.captures,
          timestamp: new Date().toISOString(),
        };
        store.hits.unshift(hit);
      } else if (res.status === 'CUSTOM') {
        job.custom++;
        const hit: HitItem = {
          id: uid(),
          data: dataLine,
          type: 'CUSTOM',
          customStatus: res.customStatus || 'CUSTOM',
          configId: config.id,
          configName: config.name,
          wordlistName: wordlist.name,
          proxy: proxy || 'Direct',
          captures: res.captures,
          timestamp: new Date().toISOString(),
        };
        store.hits.unshift(hit);
      } else if (res.status === 'FAIL') {
        job.fails++;
      } else if (res.status === 'RETRY') {
        job.retries++;
      } else if (res.status === 'BAN') {
        job.banned++;
      } else {
        job.toCheck++;
      }

      const captureSummary = Object.entries(res.captures)
        .map(([k, v]) => `${k}=${v}`)
        .join(' | ');

      job.recentLogs.unshift({
        id: uid(),
        timestamp: new Date().toLocaleTimeString(),
        data: dataLine,
        proxy: proxy || 'Direct',
        status: res.status,
        customStatus: res.customStatus,
        captureSummary,
      });
      if (job.recentLogs.length > 80) {
        job.recentLogs.length = 80;
      }

      const waitMs = Math.max(0, store.settings.rl.General.WaitTime || 50);
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  };

  const botCount = Math.max(1, Math.min(job.botsCount || 5, 50));
  await Promise.all(Array.from({ length: botCount }, () => worker()));

  job.elapsedSeconds = Math.floor((Date.now() - startMs) / 1000);
  job.status = state.stopped ? 'STOPPED' : 'COMPLETED';
  runnerActiveMap.delete(runnerId);
}

function checkTcpProxy(host: string, port: number, timeoutMs = 2500): Promise<{ ok: boolean; pingMs: number | null }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, pingMs: ok ? Date.now() - start : null });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));

    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // --- Built-in Safe Local Sandbox Endpoints ---
  app.post('/api/sandbox/login', (req, res) => {
    const { username = '', password = '' } = req.body || {};
    const u = String(username).toLowerCase();
    const p = String(password);

    if (u.includes('ban')) {
      return res.status(429).json({
        authenticated: false,
        error: 'rate_limited',
        message: 'Too many requests from test client',
      });
    }

    if ((u === 'demo' && p === 'demo123') || (u === 'alice@example.com' && p === 'Pass123!') || (u === 'pro_tester' && p === 'valid2026')) {
      return res.json({
        authenticated: true,
        status: 'ok',
        subscription: {
          plan: u === 'alice@example.com' ? 'Team Ultra' : 'Enterprise Pro',
          tier: 'paid',
          expires: '2027-12-31',
        },
        profile: {
          points: u === 'demo' ? 4200 : 1850,
          region: 'US-WEST',
        },
      });
    }

    if (u === 'mfa' && p === 'test') {
      return res.json({
        authenticated: false,
        status: '2fa_required',
        message: 'Multi-factor challenge required',
      });
    }

    if (u === 'free@example.com' && p === 'free') {
      return res.json({
        authenticated: true,
        status: 'limited',
        subscription: {
          plan: 'Community Starter',
          tier: 'free',
          expires: 'Never',
        },
        profile: {
          points: 100,
          region: 'EU-CENTRAL',
        },
      });
    }

    return res.status(200).json({
      authenticated: false,
      status: 'invalid_credentials',
      message: 'Invalid username or password',
    });
  });

  app.get('/api/sandbox/profile', (req, res) => {
    const user = String(req.query.user || '').toLowerCase();
    const profiles: Record<string, { name: string; role: string; joined: string; id: string }> = {
      demo: { name: 'Demo Operator', role: 'Lead Architect', joined: '2024-03-15', id: '10482' },
      alice: { name: 'Alice Vance', role: 'QA Engineer', joined: '2025-01-08', id: '20911' },
      pro_tester: { name: 'Pro Tester', role: 'Automation Specialist', joined: '2023-11-22', id: '99814' },
    };
    const found = profiles[user];
    if (!found) {
      return res.status(404).send(`<html><body><div class="error">User not found</div></body></html>`);
    }
    res.type('html').send(`<!doctype html>
<html>
  <body>
    <div class="profile-card">
      <h1 class="profile-name">${found.name}</h1>
      <span class="badge-role">${found.role}</span>
      <span class="meta">Member Since: ${found.joined}</span>
      <p class="account-num">Account ID #${found.id}</p>
    </div>
  </body>
</html>`);
  });

  // --- Configs API ---
  app.get('/api/configs', (_req, res) => {
    res.json(store.configs);
  });

  app.post('/api/configs', (req, res) => {
    const body = req.body || {};
    const loliScript = body.loliScript ?? serializeBlocksToLoliScript(body.blocks || []);
    const blocks =
      Array.isArray(body.blocks) && body.blocks.length > 0
        ? body.blocks
        : parseLoliScriptToBlocks(loliScript);

    const cfg: ConfigItem = {
      id: body.id || `cfg-${uid()}`,
      name: body.name || 'Untitled Config',
      author: body.author || store.settings.ob.General.DefaultAuthor || 'PrivateBullet',
      category: body.category || 'Custom',
      version: body.version || '1.0',
      lastModified: new Date().toISOString(),
      allowedWordlist1: body.allowedWordlist1 || 'Default',
      allowedWordlist2: body.allowedWordlist2 || 'Credentials',
      suggestedBots: Number(body.suggestedBots || 10),
      needsProxies: Boolean(body.needsProxies),
      onlySocks: Boolean(body.onlySocks),
      blocks,
      loliScript: loliScript || serializeBlocksToLoliScript(blocks),
    };
    store.configs.unshift(cfg);
    res.status(201).json(cfg);
  });

  app.put('/api/configs/:id', (req, res) => {
    const idx = store.configs.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Config not found' });

    const body = req.body || {};
    let blocks = body.blocks ?? store.configs[idx].blocks;
    let loliScript = body.loliScript ?? store.configs[idx].loliScript;

    if (body.syncFrom === 'blocks' && Array.isArray(body.blocks)) {
      blocks = body.blocks;
      loliScript = serializeBlocksToLoliScript(blocks);
    } else if (body.syncFrom === 'script' && typeof body.loliScript === 'string') {
      loliScript = body.loliScript;
      blocks = parseLoliScriptToBlocks(loliScript);
    }

    store.configs[idx] = {
      ...store.configs[idx],
      ...body,
      blocks,
      loliScript,
      lastModified: new Date().toISOString(),
    };
    res.json(store.configs[idx]);
  });

  app.delete('/api/configs/:id', (req, res) => {
    store.configs = store.configs.filter((c) => c.id !== req.params.id);
    res.json({ ok: true });
  });

  // --- Debugger API ---
  app.post('/api/debugger/run', async (req, res) => {
    try {
      const { blocks, loliScript, inputData, wordlistType, proxy } = req.body || {};
      const result = await executeBotConfig({
        blocks,
        loliScript,
        inputData: String(inputData ?? 'demo:demo123'),
        wordlistType: String(wordlistType ?? 'Default'),
        proxy: proxy ? String(proxy) : undefined,
        settings: store.settings,
        serverPort: PORT,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Execution error' });
    }
  });

  // --- Wordlists API ---
  app.get('/api/wordlists', (_req, res) => {
    res.json(store.wordlists);
  });

  app.post('/api/wordlists', (req, res) => {
    const { name, type = 'Default', rawContent = '' } = req.body || {};
    const allLines = String(rawContent)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const rule = store.settings.wordlistTypes.find((w) => w.name === type);
    let valid = allLines;
    if (rule && rule.verify && rule.regex) {
      try {
        const re = new RegExp(rule.regex);
        valid = allLines.filter((line) => re.test(line));
      } catch {
        valid = allLines;
      }
    }

    const wl: WordlistItem = {
      id: `wl-${uid()}`,
      name: name || `Wordlist_${store.wordlists.length + 1}.txt`,
      type,
      totalLines: allLines.length,
      validLines: valid.length,
      lines: valid,
      createdAt: new Date().toISOString(),
    };
    store.wordlists.unshift(wl);
    res.status(201).json(wl);
  });

  app.delete('/api/wordlists/:id', (req, res) => {
    store.wordlists = store.wordlists.filter((w) => w.id !== req.params.id);
    res.json({ ok: true });
  });

  // --- Proxies API ---
  app.get('/api/proxies', (_req, res) => {
    res.json(store.proxies);
  });

  app.post('/api/proxies/import', (req, res) => {
    const { rawText = '', type = 'HTTP' } = req.body || {};
    const lines = String(rawText)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const added: ProxyItem[] = [];

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const host = parts[0].trim();
        const port = parseInt(parts[1].trim(), 10);
        if (!host || Number.isNaN(port) || port < 1 || port > 65535) continue;
        const p: ProxyItem = {
          id: `prx-${uid()}`,
          host,
          port,
          username: parts[2]?.trim(),
          password: parts[3]?.trim(),
          type,
          status: 'UNTESTED',
          pingMs: null,
          country: host === '127.0.0.1' ? 'LOCAL' : 'EXT',
        };
        store.proxies.push(p);
        added.push(p);
      }
    }
    res.status(201).json({ addedCount: added.length, proxies: store.proxies });
  });

  app.post('/api/proxies/check', async (req, res) => {
    const { ids } = req.body || {};
    const targets = Array.isArray(ids) && ids.length > 0
      ? store.proxies.filter((p) => ids.includes(p.id))
      : store.proxies;

    await Promise.all(
      targets.map(async (p) => {
        const result = await checkTcpProxy(p.host, p.port, 1800);
        p.status = result.ok ? 'WORKING' : 'BAD';
        p.pingMs = result.pingMs;
        p.lastChecked = new Date().toISOString();
      })
    );

    res.json(store.proxies);
  });

  app.delete('/api/proxies/clear-bad', (_req, res) => {
    store.proxies = store.proxies.filter((p) => p.status !== 'BAD');
    res.json(store.proxies);
  });

  app.delete('/api/proxies/:id', (req, res) => {
    store.proxies = store.proxies.filter((p) => p.id !== req.params.id);
    res.json(store.proxies);
  });

  // --- Hits DB API ---
  app.get('/api/hits', (_req, res) => {
    res.json(store.hits);
  });

  app.delete('/api/hits/:id', (req, res) => {
    store.hits = store.hits.filter((h) => h.id !== req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/hits', (_req, res) => {
    store.hits = [];
    res.json({ ok: true });
  });

  // --- Runners API ---
  app.get('/api/runners', (_req, res) => {
    res.json(store.runners);
  });

  app.post('/api/runners', (req, res) => {
    const { configId, wordlistId, botsCount = 5, useProxies = false, proxyMode = 'WORKING' } = req.body || {};
    const cfg = store.configs.find((c) => c.id === configId) || store.configs[0];
    const wl = store.wordlists.find((w) => w.id === wordlistId) || store.wordlists[0];
    if (!cfg || !wl) return res.status(400).json({ error: 'Config and wordlist are required' });

    const job: RunnerJob = {
      id: `run-${uid()}`,
      name: `Runner #${store.runners.length + 1} — ${cfg.name}`,
      configId: cfg.id,
      configName: cfg.name,
      wordlistId: wl.id,
      wordlistName: wl.name,
      botsCount: Number(botsCount),
      useProxies: Boolean(useProxies),
      proxyMode,
      status: 'IDLE',
      progress: 0,
      total: wl.lines.length,
      tested: 0,
      hits: 0,
      custom: 0,
      fails: 0,
      retries: 0,
      banned: 0,
      toCheck: 0,
      cpm: 0,
      elapsedSeconds: 0,
      recentLogs: [],
    };
    store.runners.unshift(job);
    res.status(201).json(job);
  });

  app.put('/api/runners/:id', (req, res) => {
    const job = store.runners.find((r) => r.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Runner not found' });
    if (job.status === 'RUNNING') return res.status(400).json({ error: 'Stop runner before editing' });

    const { configId, wordlistId, botsCount, useProxies, proxyMode } = req.body || {};
    if (configId) {
      const cfg = store.configs.find((c) => c.id === configId);
      if (cfg) {
        job.configId = cfg.id;
        job.configName = cfg.name;
      }
    }
    if (wordlistId) {
      const wl = store.wordlists.find((w) => w.id === wordlistId);
      if (wl) {
        job.wordlistId = wl.id;
        job.wordlistName = wl.name;
        job.total = wl.lines.length;
      }
    }
    if (botsCount !== undefined) job.botsCount = Number(botsCount);
    if (useProxies !== undefined) job.useProxies = Boolean(useProxies);
    if (proxyMode) job.proxyMode = proxyMode;
    res.json(job);
  });

  app.post('/api/runners/:id/start', (req, res) => {
    const job = store.runners.find((r) => r.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Runner not found' });
    const active = runnerActiveMap.get(job.id);
    if (active && job.status === 'PAUSED') {
      active.paused = false;
      job.status = 'RUNNING';
      return res.json(job);
    }
    if (job.status !== 'RUNNING') {
      void runRunnerLoop(job.id);
    }
    res.json(job);
  });

  app.post('/api/runners/:id/pause', (req, res) => {
    const job = store.runners.find((r) => r.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Runner not found' });
    const active = runnerActiveMap.get(job.id);
    if (active) {
      active.paused = !active.paused;
      job.status = active.paused ? 'PAUSED' : 'RUNNING';
    }
    res.json(job);
  });

  app.post('/api/runners/:id/stop', (req, res) => {
    const job = store.runners.find((r) => r.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Runner not found' });
    const active = runnerActiveMap.get(job.id);
    if (active) {
      active.stopped = true;
      active.paused = false;
    }
    job.status = 'STOPPED';
    res.json(job);
  });

  app.delete('/api/runners/:id', (req, res) => {
    const active = runnerActiveMap.get(req.params.id);
    if (active) active.stopped = true;
    store.runners = store.runners.filter((r) => r.id !== req.params.id);
    res.json({ ok: true });
  });

  // --- Settings API ---
  app.get('/api/settings', (_req, res) => {
    res.json(store.settings);
  });

  app.put('/api/settings', (req, res) => {
    store.settings = {
      ...store.settings,
      ...req.body,
    };
    res.json(store.settings);
  });

  // --- Tools Parser Test API ---
  app.post('/api/tools/parse-test', (req, res) => {
    const { input = '', mode = 'LR', ...opts } = req.body || {};
    const matches = runParseLogic(String(input), mode, opts);
    res.json({ matches });
  });

  // --- Static / Vite Middleware ---
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`[PrivateBullet Web Studio] Listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
