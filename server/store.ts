import {
  AppSettings,
  ConfigItem,
  HitItem,
  ProxyItem,
  RunnerJob,
  WordlistItem,
} from '../src/types.ts';
import { parseLoliScriptToBlocks } from './loliScript.ts';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const sampleScript1 = `## Sandbox API Auth Test Config
FUNCTION Hash "SHA256" "<PASS>" -> VAR "PASS_HASH"

REQUEST POST "/api/sandbox/login"
  CONTENT "{\\"username\\":\\"<USER>\\",\\"password\\":\\"<PASS>\\",\\"hash\\":\\"<PASS_HASH>\\"}"
  CONTENTTYPE "application/json"
  HEADER "X-Client: PrivateBullet-Web/1.0"

KEYCHECK BanOn4XX=TRUE
  KEYCHAIN Success OR
    KEY "\\"authenticated\\":true" Contains
  KEYCHAIN Custom "2FACTOR" OR
    KEY "\\"status\\":\\"2fa_required\\"" Contains
  KEYCHAIN Custom "FREE" OR
    KEY "\\"tier\\":\\"free\\"" Contains
  KEYCHAIN Ban OR
    KEY "\\"error\\":\\"rate_limited\\"" Contains
  KEYCHAIN Fail OR
    KEY "\\"authenticated\\":false" Contains

PARSE "<SOURCE>" JSON "subscription.plan" -> CAP "Plan"
PARSE "<SOURCE>" JSON "subscription.tier" -> CAP "Tier"
PARSE "<SOURCE>" JSON "subscription.expires" -> CAP "Expires"
PARSE "<SOURCE>" JSON "profile.points" -> CAP "Points"`;

const sampleScript2 = `## Sandbox HTML Profile Scraper
REQUEST GET "/api/sandbox/profile?user=<USER>"
  HEADER "Accept: text/html"

KEYCHECK
  KEYCHAIN Success OR
    KEY "profile-card" Contains
  KEYCHAIN Fail OR
    KEY "User not found" Contains

PARSE "<SOURCE>" CSS ".profile-name" "innerText" 0 -> CAP "DisplayName"
PARSE "<SOURCE>" CSS ".badge-role" "innerText" 0 -> CAP "Role"
PARSE "<SOURCE>" LR "Member Since: " "</span>" -> CAP "Joined"
PARSE "<SOURCE>" REGEX "ID #([0-9]+)" "[1]" -> CAP "AccountId"`;

const sampleScript3 = `## HTTPBin Echo & Header Inspector
FUNCTION RandomString "?u?u?d?d?l?l" -> VAR "NONCE"
FUNCTION Base64Encode "<USER>:<NONCE>" -> VAR "TOKEN"

REQUEST POST "https://httpbin.org/post"
  CONTENT "{\\"user\\":\\"<USER>\\",\\"nonce\\":\\"<NONCE>\\"}"
  CONTENTTYPE "application/json"
  HEADER "Authorization: Bearer <TOKEN>"

KEYCHECK
  KEYCHAIN Success OR
    KEY "\\"url\\": \\"https://httpbin.org/post\\"" Contains

PARSE "<SOURCE>" JSON "origin" -> CAP "OriginIP"
PARSE "<SOURCE>" JSON "headers.Authorization" -> CAP "EchoAuth"`;

export const defaultSettings: AppSettings = {
  ob: {
    General: {
      DisplayLoliScriptOnLoad: false,
      RecommendedBots: true,
      StartingWidth: 800,
      StartingHeight: 620,
      ChangeRunnerInterface: false,
      DisableQuitWarning: false,
      DisableNotSavedWarning: false,
      DefaultAuthor: 'PrivateBullet',
      LiveConfigUpdates: false,
      DisableHTMLView: false,
      AlwaysOnTop: false,
      AutoCreateRunner: false,
      PersistDebuggerLog: false,
      DisableSyntaxHelper: false,
      DisplayCapturesLast: false,
      DisableCopyPasteBlocks: false,
      EnableLogging: false,
      LogToFile: false,
      LogBufferSize: 10000,
      BackupDB: true,
      IgnoreWordlistOnHitDedupe: false,
    },
    Sounds: {
      EnableSounds: false,
      OnHitSound: '/sounds/rifle_hit.wav',
      OnReloadSound: '/sounds/rifle_reload.wav',
    },
    Themes: {
      BackgroundMain: '#222222',
      BackgroundSecondary: '#111111',
      ForegroundMain: '#dcdcdc',
      ForegroundGood: '#adff2f',
      ForegroundBad: '#ff6347',
      ForegroundCustom: '#ff8c00',
      ForegroundRetry: '#ffff00',
      ForegroundToCheck: '#7fffd4',
      ForegroundMenuSelected: '#1e90ff',
    },
  },
  rl: {
    General: {
      WaitTime: 100,
      RequestTimeout: 10,
      MaxHits: 0,
      BotsDisplayMode: 1,
      EnableBotLog: true,
      SaveLastSource: false,
      SendToCheckOnAbort: false,
      WebhookEnabled: false,
      WebhookURL: '',
      WebhookUser: 'Undefined',
    },
    Proxies: {
      ConcurrentUse: false,
      NeverBan: false,
      BanLoopEvasion: 100,
      ShuffleOnStart: false,
      Reload: true,
      AlwaysGetClearance: false,
    },
    Captchas: {
      CurrentService: 0,
      Timeout: 120,
      BypassBalanceCheck: false,
    },
    Selenium: {
      Browser: 0,
      Headless: false,
      PageLoadTimeout: 60,
    },
  },
  proxyManager: {
    ProxySiteUrls: ['https://httpbin.org/ip', 'https://netflix.com'],
    ProxyKeys: ['origin', 'title>Netflix'],
    ActiveProxySiteUrl: 'https://httpbin.org/ip',
    ActiveProxyKey: 'origin',
  },
  wordlistTypes: [
    {
      name: 'Default',
      regex: '^.*$',
      verify: false,
      separator: ':',
      slices: ['USER', 'PASS'],
    },
    {
      name: 'MailPass',
      regex: '^.*@.*:.*$',
      verify: true,
      separator: ':',
      slices: ['USER', 'PASS'],
    },
    {
      name: 'Email',
      regex: '^[^@]+@[^\\.]+\\..+$',
      verify: true,
      separator: ':',
      slices: ['EMAIL'],
    },
    {
      name: 'Credentials',
      regex: '^.*:.*$',
      verify: true,
      separator: ':',
      slices: ['USERNAME', 'PASSWORD'],
    },
    {
      name: 'Numeric',
      regex: '^[0-9]*$',
      verify: true,
      separator: ':',
      slices: ['CODE'],
    },
    {
      name: 'URLs',
      regex: '^(http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?$',
      verify: true,
      separator: '^',
      slices: ['URL'],
    },
    {
      name: '1$REQ',
      regex: '(.*?)\\|(.*?)\\|(.*?)\\|(.*?)',
      verify: true,
      separator: '|',
      slices: ['cc', 'mes', 'ano', 'cvv'],
    },
  ],
  customKeychains: [
    { name: 'FREE', color: '#ff4500' },
    { name: '2FACTOR', color: '#800000' },
    { name: 'EXPIRED', color: '#dc143c' },
    { name: 'CUSTOM', color: '#ff8c00' },
  ],
  exportFormats: ['<CAPTURE>', '<DATA>:<PROXY>:<CAPTURE>', '<DATA>'],
};

class DataStore {
  settings: AppSettings = structuredClone(defaultSettings);

  configs: ConfigItem[] = [
    {
      id: 'cfg-sandbox-auth',
      name: 'Sandbox API Auth Check',
      author: 'PrivateBullet',
      category: 'Sandbox',
      version: '1.0',
      lastModified: new Date().toISOString(),
      allowedWordlist1: 'Default',
      allowedWordlist2: 'MailPass',
      suggestedBots: 10,
      needsProxies: false,
      onlySocks: false,
      loliScript: sampleScript1,
      blocks: parseLoliScriptToBlocks(sampleScript1),
    },
    {
      id: 'cfg-sandbox-profile',
      name: 'Sandbox HTML Profile Scraper',
      author: 'PrivateBullet',
      category: 'Parser',
      version: '1.0',
      lastModified: new Date().toISOString(),
      allowedWordlist1: 'Default',
      allowedWordlist2: 'Credentials',
      suggestedBots: 5,
      needsProxies: false,
      onlySocks: false,
      loliScript: sampleScript2,
      blocks: parseLoliScriptToBlocks(sampleScript2),
    },
    {
      id: 'cfg-httpbin-echo',
      name: 'HTTPBin Echo Inspector',
      author: 'PrivateBullet',
      category: 'Network',
      version: '1.0',
      lastModified: new Date().toISOString(),
      allowedWordlist1: 'Default',
      allowedWordlist2: 'Credentials',
      suggestedBots: 4,
      needsProxies: false,
      onlySocks: false,
      loliScript: sampleScript3,
      blocks: parseLoliScriptToBlocks(sampleScript3),
    },
  ];

  wordlists: WordlistItem[] = [
    {
      id: 'wl-sandbox-demo',
      name: 'Sandbox_Demo_Combos.txt',
      type: 'Default',
      totalLines: 8,
      validLines: 8,
      lines: [
        'demo:demo123',
        'alice@example.com:Pass123!',
        'mfa:test',
        'free@example.com:free',
        'invalid:wrong1',
        'bob:secret99',
        'charlie@example.com:hunter2',
        'pro_tester:valid2026',
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'wl-profile-users',
      name: 'Profile_Users.txt',
      type: 'Default',
      totalLines: 4,
      validLines: 4,
      lines: ['demo:0', 'alice:0', 'pro_tester:0', 'missing_user:0'],
      createdAt: new Date().toISOString(),
    },
  ];

  proxies: ProxyItem[] = [
    {
      id: 'prx-1',
      host: '127.0.0.1',
      port: 8080,
      type: 'HTTP',
      status: 'UNTESTED',
      pingMs: null,
      country: 'LOCAL',
    },
    {
      id: 'prx-2',
      host: '10.0.0.12',
      port: 1080,
      type: 'SOCKS5',
      status: 'UNTESTED',
      pingMs: null,
      country: 'LAN',
    },
  ];

  hits: HitItem[] = [
    {
      id: uid(),
      data: 'demo:demo123',
      type: 'SUCCESS',
      configId: 'cfg-sandbox-auth',
      configName: 'Sandbox API Auth Check',
      wordlistName: 'Sandbox_Demo_Combos.txt',
      proxy: 'Direct',
      captures: {
        Plan: 'Enterprise Pro',
        Tier: 'paid',
        Expires: '2027-12-31',
        Points: '4200',
      },
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: uid(),
      data: 'mfa:test',
      type: 'CUSTOM',
      customStatus: '2FACTOR',
      configId: 'cfg-sandbox-auth',
      configName: 'Sandbox API Auth Check',
      wordlistName: 'Sandbox_Demo_Combos.txt',
      proxy: 'Direct',
      captures: {},
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
  ];

  runners: RunnerJob[] = [
    {
      id: 'run-initial',
      name: 'Runner #1 — Sandbox Auth',
      configId: 'cfg-sandbox-auth',
      configName: 'Sandbox API Auth Check',
      wordlistId: 'wl-sandbox-demo',
      wordlistName: 'Sandbox_Demo_Combos.txt',
      botsCount: 5,
      useProxies: false,
      proxyMode: 'WORKING',
      status: 'IDLE',
      progress: 0,
      total: 8,
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
    },
  ];
}

export const store = new DataStore();
