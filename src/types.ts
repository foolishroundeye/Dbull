export type BotStatus =
  | 'NONE'
  | 'SUCCESS'
  | 'FAIL'
  | 'RETRY'
  | 'BAN'
  | 'CUSTOM'
  | 'ERROR';

export type BlockType =
  | 'REQUEST'
  | 'KEYCHECK'
  | 'PARSE'
  | 'FUNCTION'
  | 'UTILITY'
  | 'SET'
  | 'DELETE'
  | 'PRINT'
  | 'SOLVECAPTCHA'
  | 'NAVIGATE'
  | 'BROWSERACTION'
  | 'EXECUTEJS'
  | 'TCP';

export type KeychainType = 'Success' | 'Fail' | 'Retry' | 'Ban' | 'Custom';
export type KeychainMode = 'OR' | 'AND';
export type KeyCondition =
  | 'Contains'
  | 'DoesNotContain'
  | 'EqualTo'
  | 'NotEqualTo'
  | 'MatchesRegex'
  | 'GreaterThan'
  | 'LessThan';

export interface KeyEntry {
  id: string;
  target: string; // e.g. <SOURCE>, <RESPONSECODE>, <ADDRESS>, or variable
  condition: KeyCondition;
  value: string;
}

export interface KeychainEntry {
  id: string;
  type: KeychainType;
  customType?: string;
  mode: KeychainMode;
  keys: KeyEntry[];
}

export interface StackBlock {
  id: string;
  type: BlockType;
  label: string;
  disabled?: boolean;
  // REQUEST fields
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url?: string;
  content?: string;
  contentType?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  autoRedirect?: boolean;
  readResponseSource?: boolean;
  // KEYCHECK fields
  banOn4XX?: boolean;
  banOnToCheck?: boolean;
  keychains?: KeychainEntry[];
  // PARSE fields
  parseTarget?: string;
  parseType?: 'LR' | 'JSON' | 'CSS' | 'REGEX';
  leftDelim?: string;
  rightDelim?: string;
  jsonField?: string;
  cssSelector?: string;
  cssAttribute?: string;
  regexPattern?: string;
  regexOutput?: string;
  parseIndex?: number;
  recursive?: boolean;
  createEmpty?: boolean;
  prefix?: string;
  suffix?: string;
  isCapture?: boolean;
  varName?: string;
  // FUNCTION fields
  functionName?: string;
  functionArg1?: string;
  functionArg2?: string;
  functionInput?: string;
  // UTILITY fields
  utilityGroup?: 'LIST' | 'VARIABLE' | 'CONVERSION';
  utilityAction?: string;
  utilityTarget?: string;
  utilityParam1?: string;
  utilityParam2?: string;
  // SET / DELETE / PRINT / STUB fields
  setValue?: string;
  printText?: string;
  rawLine?: string;
}

export interface ConfigItem {
  id: string;
  name: string;
  author: string;
  category: string;
  version: string;
  lastModified: string;
  allowedWordlist1: string;
  allowedWordlist2: string;
  suggestedBots: number;
  needsProxies: boolean;
  onlySocks: boolean;
  blocks: StackBlock[];
  loliScript: string;
}

export interface ProxyItem {
  id: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'HTTP' | 'SOCKS4' | 'SOCKS5';
  status: 'UNTESTED' | 'WORKING' | 'BAD';
  pingMs: number | null;
  country: string;
  lastChecked?: string;
}

export interface WordlistItem {
  id: string;
  name: string;
  type: string;
  totalLines: number;
  validLines: number;
  lines: string[];
  createdAt: string;
}

export interface HitItem {
  id: string;
  data: string;
  type: 'SUCCESS' | 'CUSTOM' | 'NONE';
  customStatus?: string;
  configId: string;
  configName: string;
  wordlistName: string;
  proxy: string;
  captures: Record<string, string>;
  timestamp: string;
}

export interface RunnerJob {
  id: string;
  name: string;
  configId: string;
  configName: string;
  wordlistId: string;
  wordlistName: string;
  botsCount: number;
  useProxies: boolean;
  proxyMode: 'ALL' | 'WORKING';
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED';
  progress: number;
  total: number;
  tested: number;
  hits: number;
  custom: number;
  fails: number;
  retries: number;
  banned: number;
  toCheck: number;
  cpm: number;
  startedAt?: string;
  elapsedSeconds: number;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    data: string;
    proxy: string;
    status: BotStatus;
    customStatus?: string;
    captureSummary: string;
  }>;
}

export interface WordlistTypeRule {
  name: string;
  regex: string;
  verify: boolean;
  separator: string;
  slices: string[];
}

export interface CustomKeychainColor {
  name: string;
  color: string;
}

export interface OBSettings {
  General: {
    DisplayLoliScriptOnLoad: boolean;
    RecommendedBots: boolean;
    StartingWidth: number;
    StartingHeight: number;
    ChangeRunnerInterface: boolean;
    DisableQuitWarning: boolean;
    DisableNotSavedWarning: boolean;
    DefaultAuthor: string;
    LiveConfigUpdates: boolean;
    DisableHTMLView: boolean;
    AlwaysOnTop: boolean;
    AutoCreateRunner: boolean;
    PersistDebuggerLog: boolean;
    DisableSyntaxHelper: boolean;
    DisplayCapturesLast: boolean;
    DisableCopyPasteBlocks: boolean;
    EnableLogging: boolean;
    LogToFile: boolean;
    LogBufferSize: number;
    BackupDB: boolean;
    IgnoreWordlistOnHitDedupe: boolean;
  };
  Sounds: {
    EnableSounds: boolean;
    OnHitSound: string;
    OnReloadSound: string;
  };
  Themes: {
    BackgroundMain: string;
    BackgroundSecondary: string;
    ForegroundMain: string;
    ForegroundGood: string;
    ForegroundBad: string;
    ForegroundCustom: string;
    ForegroundRetry: string;
    ForegroundToCheck: string;
    ForegroundMenuSelected: string;
  };
}

export interface RLSettings {
  General: {
    WaitTime: number;
    RequestTimeout: number;
    MaxHits: number;
    BotsDisplayMode: number;
    EnableBotLog: boolean;
    SaveLastSource: boolean;
    SendToCheckOnAbort: boolean;
    WebhookEnabled: boolean;
    WebhookURL: string;
    WebhookUser: string;
  };
  Proxies: {
    ConcurrentUse: boolean;
    NeverBan: boolean;
    BanLoopEvasion: number;
    ShuffleOnStart: boolean;
    Reload: boolean;
    AlwaysGetClearance: boolean;
  };
  Captchas: {
    CurrentService: number;
    Timeout: number;
    BypassBalanceCheck: boolean;
  };
  Selenium: {
    Browser: number;
    Headless: boolean;
    PageLoadTimeout: number;
  };
}

export interface ProxyManagerSettings {
  ProxySiteUrls: string[];
  ProxyKeys: string[];
  ActiveProxySiteUrl: string;
  ActiveProxyKey: string;
}

export interface AppSettings {
  ob: OBSettings;
  rl: RLSettings;
  proxyManager: ProxyManagerSettings;
  wordlistTypes: WordlistTypeRule[];
  customKeychains: CustomKeychainColor[];
  exportFormats: string[];
}

export interface DebuggerLogEntry {
  step: number;
  blockType: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'var';
}

export interface DebuggerResult {
  status: BotStatus;
  customStatus?: string;
  variables: Record<string, string>;
  captures: Record<string, string>;
  logs: DebuggerLogEntry[];
  lastResponse: {
    statusCode: number;
    address: string;
    headers: Record<string, string>;
    cookies: Record<string, string>;
    body: string;
  } | null;
  elapsedMs: number;
}
