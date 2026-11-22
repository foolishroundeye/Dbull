import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import {
  AppSettings,
  BotStatus,
  DebuggerLogEntry,
  DebuggerResult,
  KeyCondition,
  StackBlock,
} from '../src/types.ts';
import { parseLoliScriptToBlocks } from './loliScript.ts';

function resolveVariables(
  template: string,
  vars: Record<string, string>,
  headers: Record<string, string>,
  cookies: Record<string, string>
): string {
  if (!template) return '';
  let out = template;

  // Replace <HEADERS(key)> and <HEADERS(*)>
  out = out.replace(/<HEADERS\(([^)]+)\)>/gi, (_, key: string) => {
    if (key === '*') {
      return Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    }
    const found = Object.entries(headers).find(
      ([k]) => k.toLowerCase() === key.toLowerCase()
    );
    return found ? found[1] : '';
  });

  // Replace <COOKIES(key)> and <COOKIES(*)>
  out = out.replace(/<COOKIES\(([^)]+)\)>/gi, (_, key: string) => {
    if (key === '*') {
      return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
    const found = Object.entries(cookies).find(
      ([k]) => k.toLowerCase() === key.toLowerCase()
    );
    return found ? found[1] : '';
  });

  // Replace <VARNAME>
  out = out.replace(/<([A-Za-z0-9_.$]+)>/g, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return vars[name];
    }
    const ci = Object.keys(vars).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    return ci ? vars[ci] : match;
  });

  return out;
}

function sliceInputData(
  inputData: string,
  wordlistType: string,
  settings: AppSettings
): Record<string, string> {
  const vars: Record<string, string> = {
    INPUT: inputData,
    DATA: inputData,
    SOURCE: '',
    ADDRESS: '',
    RESPONSECODE: '0',
  };

  const rule =
    settings.wordlistTypes.find(
      (r) => r.name.toLowerCase() === wordlistType.toLowerCase()
    ) || settings.wordlistTypes[0];

  if (!rule) {
    const parts = inputData.split(':');
    vars.USER = parts[0] || '';
    vars.PASS = parts.slice(1).join(':') || '';
    return vars;
  }

  const sep = rule.separator || ':';
  const parts = inputData.split(sep);
  rule.slices.forEach((sliceName, idx) => {
    vars[sliceName] = parts[idx] ?? '';
  });

  // Also ensure USER/PASS convenience aliases if USERNAME/PASSWORD
  if (vars.USERNAME && !vars.USER) vars.USER = vars.USERNAME;
  if (vars.PASSWORD && !vars.PASS) vars.PASS = vars.PASSWORD;
  if (vars.EMAIL && !vars.USER) vars.USER = vars.EMAIL;

  return vars;
}

function getJsonPath(obj: unknown, path: string): string[] {
  if (!path) return [typeof obj === 'string' ? obj : JSON.stringify(obj)];
  const normalized = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\$\.?/, '');
  const parts = normalized.split('.').filter(Boolean);

  function traverse(cur: unknown, idx: number): unknown[] {
    if (idx >= parts.length) return [cur];
    if (cur === null || cur === undefined) return [];
    const key = parts[idx];
    if (key === '*' && Array.isArray(cur)) {
      return cur.flatMap((item) => traverse(item, idx + 1));
    }
    if (Array.isArray(cur)) {
      const n = parseInt(key, 10);
      if (!Number.isNaN(n) && n >= 0 && n < cur.length) {
        return traverse(cur[n], idx + 1);
      }
      return cur.flatMap((item) => traverse(item, idx));
    }
    if (typeof cur === 'object') {
      const rec = cur as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(rec, key)) {
        return traverse(rec[key], idx + 1);
      }
    }
    return [];
  }

  return traverse(obj, 0)
    .filter((v) => v !== undefined && v !== null)
    .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)));
}

export function runParseLogic(
  targetText: string,
  mode: 'LR' | 'JSON' | 'CSS' | 'REGEX',
  opts: {
    leftDelim?: string;
    rightDelim?: string;
    jsonField?: string;
    cssSelector?: string;
    cssAttribute?: string;
    parseIndex?: number;
    regexPattern?: string;
    regexOutput?: string;
    recursive?: boolean;
  }
): string[] {
  if (mode === 'LR') {
    const left = opts.leftDelim || '';
    const right = opts.rightDelim || '';
    const results: string[] = [];
    let pos = 0;

    while (pos < targetText.length) {
      let startIdx = pos;
      if (left) {
        const foundL = targetText.indexOf(left, pos);
        if (foundL === -1) break;
        startIdx = foundL + left.length;
      }
      let endIdx = targetText.length;
      if (right) {
        const foundR = targetText.indexOf(right, startIdx);
        if (foundR === -1) break;
        endIdx = foundR;
      }
      results.push(targetText.slice(startIdx, endIdx));
      if (!opts.recursive) break;
      pos = endIdx + (right ? right.length : 1);
    }
    return results;
  }

  if (mode === 'JSON') {
    try {
      const parsed = JSON.parse(targetText);
      const vals = getJsonPath(parsed, opts.jsonField || '');
      return opts.recursive ? vals : vals.slice(0, 1);
    } catch {
      return [];
    }
  }

  if (mode === 'CSS') {
    try {
      const $ = cheerio.load(targetText);
      const els = $(opts.cssSelector || '*');
      const attr = (opts.cssAttribute || 'innerText').toLowerCase();
      const extract = (node: ReturnType<typeof $>): string => {
        if (attr === 'innertext' || attr === 'text') return node.text().trim();
        if (attr === 'innerhtml' || attr === 'html') return node.html() || '';
        if (attr === 'outerhtml') return $.html(node) || '';
        return node.attr(opts.cssAttribute || '') || '';
      };

      if (opts.recursive) {
        const list: string[] = [];
        els.each((_, el) => {
          list.push(extract($(el)));
        });
        return list;
      }
      const idx = opts.parseIndex ?? 0;
      const picked = els.eq(idx);
      if (picked.length === 0) return [];
      return [extract(picked)];
    } catch {
      return [];
    }
  }

  if (mode === 'REGEX') {
    try {
      const flags = opts.recursive ? 'gm' : 'm';
      const re = new RegExp(opts.regexPattern || '(.*)', flags);
      const outTpl = opts.regexOutput || '[1]';
      const results: string[] = [];
      let m: RegExpExecArray | null;
      if (opts.recursive) {
        while ((m = re.exec(targetText)) !== null) {
          let rendered = outTpl;
          for (let g = 0; g < m.length; g++) {
            rendered = rendered.replace(new RegExp(`\\[${g}\\]`, 'g'), m[g] ?? '');
          }
          results.push(rendered);
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } else {
        m = re.exec(targetText);
        if (m) {
          let rendered = outTpl;
          for (let g = 0; g < m.length; g++) {
            rendered = rendered.replace(new RegExp(`\\[${g}\\]`, 'g'), m[g] ?? '');
          }
          results.push(rendered);
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  return [];
}

function evaluateKeyCondition(
  actual: string,
  condition: KeyCondition,
  expected: string
): boolean {
  switch (condition) {
    case 'Contains':
      return actual.includes(expected);
    case 'DoesNotContain':
      return !actual.includes(expected);
    case 'EqualTo':
      return actual === expected;
    case 'NotEqualTo':
      return actual !== expected;
    case 'MatchesRegex':
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    case 'GreaterThan':
      return Number(actual) > Number(expected);
    case 'LessThan':
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

function runFunction(
  name: string,
  arg1: string,
  arg2: string,
  input: string
): string {
  const fn = name.toLowerCase();
  switch (fn) {
    case 'hash': {
      const alg = (arg1 || 'SHA256').toLowerCase();
      const supported = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'].includes(alg)
        ? alg
        : 'sha256';
      return crypto.createHash(supported).update(input).digest('hex');
    }
    case 'hmac': {
      const alg = (arg1 || 'SHA256').toLowerCase();
      const key = arg2 || '';
      const supported = ['md5', 'sha1', 'sha256', 'sha512'].includes(alg)
        ? alg
        : 'sha256';
      return crypto.createHmac(supported, key).update(input).digest('hex');
    }
    case 'base64encode':
      return Buffer.from(input, 'utf8').toString('base64');
    case 'base64decode':
      return Buffer.from(input, 'base64').toString('utf8');
    case 'urlencode':
      return encodeURIComponent(input);
    case 'urldecode':
      try {
        return decodeURIComponent(input);
      } catch {
        return input;
      }
    case 'htmlentityencode':
      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    case 'htmlentitydecode':
      return input
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    case 'replace':
      return input.split(arg1).join(arg2);
    case 'substring': {
      const start = parseInt(arg1 || '0', 10) || 0;
      const len = arg2 ? parseInt(arg2, 10) : undefined;
      return len !== undefined
        ? input.slice(start, start + len)
        : input.slice(start);
    }
    case 'length':
      return String(input.length);
    case 'tolowercase':
      return input.toLowerCase();
    case 'touppercase':
      return input.toUpperCase();
    case 'trim':
      return input.trim();
    case 'randomnum': {
      const min = parseInt(arg1 || '0', 10) || 0;
      const max = parseInt(arg2 || '100', 10) || 100;
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    case 'randomstring': {
      const pattern = arg1 || '?l?l?l?l?d?d';
      const lowers = 'abcdefghijklmnopqrstuvwxyz';
      const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const digits = '0123456789';
      const hex = '0123456789abcdef';
      let res = '';
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === '?' && i + 1 < pattern.length) {
          const code = pattern[++i];
          if (code === 'l') res += lowers[Math.floor(Math.random() * lowers.length)];
          else if (code === 'u') res += uppers[Math.floor(Math.random() * uppers.length)];
          else if (code === 'd') res += digits[Math.floor(Math.random() * digits.length)];
          else if (code === 'h') res += hex[Math.floor(Math.random() * hex.length)];
          else res += lowers[Math.floor(Math.random() * lowers.length)];
        } else {
          res += pattern[i];
        }
      }
      return res;
    }
    case 'currentunixtime':
      return String(Math.floor(Date.now() / 1000));
    case 'unixtimetodate': {
      const ts = parseInt(input, 10) || Math.floor(Date.now() / 1000);
      return new Date(ts * 1000).toISOString();
    }
    case 'countoccurrences': {
      if (!arg1) return '0';
      return String(input.split(arg1).length - 1);
    }
    default:
      return input;
  }
}

export async function executeBotConfig(params: {
  blocks?: StackBlock[];
  loliScript?: string;
  inputData: string;
  wordlistType: string;
  proxy?: string;
  settings: AppSettings;
  serverPort?: number;
}): Promise<DebuggerResult> {
  const started = Date.now();
  const blocks =
    params.blocks && params.blocks.length > 0
      ? params.blocks
      : parseLoliScriptToBlocks(params.loliScript || '');

  const vars = sliceInputData(params.inputData, params.wordlistType, params.settings);
  if (params.proxy) {
    vars.PROXY = params.proxy;
  }
  const captures: Record<string, string> = {};
  const headers: Record<string, string> = {};
  const cookies: Record<string, string> = {};
  const logs: DebuggerLogEntry[] = [];
  let lastResponse: DebuggerResult['lastResponse'] = null;
  let botStatus: BotStatus = 'NONE';
  let customStatus: string | undefined;

  const port = params.serverPort || 3000;
  const timeoutMs = (params.settings.rl.General.RequestTimeout || 10) * 1000;

  logs.push({
    step: 0,
    blockType: 'INIT',
    level: 'info',
    message: `Initialized bot | Data="${params.inputData}" | Wordlist=${params.wordlistType}${
      params.proxy ? ` | Proxy=${params.proxy}` : ''
    }`,
  });

  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    const step = idx + 1;

    if (b.disabled) {
      logs.push({
        step,
        blockType: b.type,
        level: 'warn',
        message: `Skipped disabled block: ${b.label}`,
      });
      continue;
    }

    if (b.type === 'REQUEST') {
      const method = (b.method || 'GET').toUpperCase();
      let resolvedUrl = resolveVariables(b.url || '', vars, headers, cookies);
      if (resolvedUrl.startsWith('/')) {
        resolvedUrl = `http://127.0.0.1:${port}${resolvedUrl}`;
      }

      const reqHeaders: Record<string, string> = {};
      if (b.headers) {
        for (const [k, v] of Object.entries(b.headers)) {
          reqHeaders[k] = resolveVariables(v, vars, headers, cookies);
        }
      }
      if (b.contentType) {
        reqHeaders['Content-Type'] = resolveVariables(b.contentType, vars, headers, cookies);
      }

      const mergedCookies = { ...cookies };
      if (b.cookies) {
        for (const [k, v] of Object.entries(b.cookies)) {
          mergedCookies[k] = resolveVariables(v, vars, headers, cookies);
        }
      }
      const cookieHeader = Object.entries(mergedCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      if (cookieHeader && !reqHeaders['Cookie']) {
        reqHeaders['Cookie'] = cookieHeader;
      }

      const body =
        !['GET', 'HEAD'].includes(method) && b.content
          ? resolveVariables(b.content, vars, headers, cookies)
          : undefined;

      logs.push({
        step,
        blockType: 'REQUEST',
        level: 'info',
        message: `Sending ${method} ${resolvedUrl}`,
      });

      try {
        const response = await fetch(resolvedUrl, {
          method,
          headers: reqHeaders,
          body,
          redirect: b.autoRedirect === false ? 'manual' : 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });

        const respHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          respHeaders[key] = value;
          headers[key] = value;
        });

        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
          for (const part of setCookie.split(/,(?=[^;]+=[^;]+)/)) {
            const pair = part.split(';')[0]?.trim();
            if (pair) {
              const eqIdx = pair.indexOf('=');
              if (eqIdx > 0) {
                cookies[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
              }
            }
          }
        }

        const responseText =
          b.readResponseSource === false ? '' : await response.text();

        vars.SOURCE = responseText;
        vars.ADDRESS = response.url || resolvedUrl;
        vars.RESPONSECODE = String(response.status);

        lastResponse = {
          statusCode: response.status,
          address: vars.ADDRESS,
          headers: respHeaders,
          cookies: { ...cookies },
          body: responseText,
        };

        logs.push({
          step,
          blockType: 'REQUEST',
          level: response.status >= 400 ? 'warn' : 'success',
          message: `Received HTTP ${response.status} (${responseText.length} bytes) from ${vars.ADDRESS}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vars.SOURCE = '';
        vars.RESPONSECODE = '0';
        botStatus = 'RETRY';
        logs.push({
          step,
          blockType: 'REQUEST',
          level: 'error',
          message: `Request failed (${msg}) — Bot status set to RETRY`,
        });
        break;
      }
      continue;
    }

    if (b.type === 'PARSE') {
      const targetStr = resolveVariables(b.parseTarget || '<SOURCE>', vars, headers, cookies);
      const mode = b.parseType || 'LR';
      const matches = runParseLogic(targetStr, mode, {
        leftDelim: resolveVariables(b.leftDelim || '', vars, headers, cookies),
        rightDelim: resolveVariables(b.rightDelim || '', vars, headers, cookies),
        jsonField: resolveVariables(b.jsonField || '', vars, headers, cookies),
        cssSelector: resolveVariables(b.cssSelector || '', vars, headers, cookies),
        cssAttribute: b.cssAttribute,
        parseIndex: b.parseIndex,
        regexPattern: resolveVariables(b.regexPattern || '', vars, headers, cookies),
        regexOutput: b.regexOutput,
        recursive: b.recursive,
      });

      const prefix = resolveVariables(b.prefix || '', vars, headers, cookies);
      const suffix = resolveVariables(b.suffix || '', vars, headers, cookies);
      const varName = b.varName || 'PARSED';

      if (matches.length === 0) {
        if (b.createEmpty !== false) {
          const emptyVal = `${prefix}${suffix}`;
          vars[varName] = emptyVal;
          if (b.isCapture) captures[varName] = emptyVal;
        }
        logs.push({
          step,
          blockType: 'PARSE',
          level: 'warn',
          message: `PARSE ${mode} found 0 matches for ${b.isCapture ? 'CAP' : 'VAR'} "${varName}"`,
        });
      } else {
        const formatted = matches.map((m) => `${prefix}${m}${suffix}`);
        const value = b.recursive ? `[${formatted.join(', ')}]` : formatted[0];
        vars[varName] = value;
        if (b.isCapture) captures[varName] = value;
        logs.push({
          step,
          blockType: 'PARSE',
          level: 'var',
          message: `Parsed ${b.isCapture ? 'CAP' : 'VAR'} "${varName}" = "${value.slice(0, 120)}"`,
        });
      }
      continue;
    }

    if (b.type === 'KEYCHECK') {
      const code = Number(vars.RESPONSECODE || '0');
      if (b.banOn4XX && code >= 400 && code < 500) {
        botStatus = 'BAN';
        logs.push({
          step,
          blockType: 'KEYCHECK',
          level: 'error',
          message: `BanOn4XX triggered (HTTP ${code}) -> Status: BAN`,
        });
        break;
      }

      let matchedChain = false;
      for (const kc of b.keychains || []) {
        const evals = kc.keys.map((k) => {
          const actual = resolveVariables(k.target || '<SOURCE>', vars, headers, cookies);
          const expected = resolveVariables(k.value || '', vars, headers, cookies);
          return evaluateKeyCondition(actual, k.condition, expected);
        });

        const passed =
          evals.length > 0 &&
          (kc.mode === 'AND' ? evals.every(Boolean) : evals.some(Boolean));

        if (passed) {
          matchedChain = true;
          const t = kc.type.toUpperCase();
          if (t === 'SUCCESS') botStatus = 'SUCCESS';
          else if (t === 'FAIL') botStatus = 'FAIL';
          else if (t === 'RETRY') botStatus = 'RETRY';
          else if (t === 'BAN') botStatus = 'BAN';
          else if (t === 'CUSTOM') {
            botStatus = 'CUSTOM';
            customStatus = kc.customType || 'CUSTOM';
          }
          logs.push({
            step,
            blockType: 'KEYCHECK',
            level: botStatus === 'SUCCESS' ? 'success' : botStatus === 'FAIL' ? 'error' : 'warn',
            message: `Matched KEYCHAIN ${kc.type}${customStatus ? ` (${customStatus})` : ''} [${kc.mode}] -> Status: ${botStatus}`,
          });
          break;
        }
      }

      if (!matchedChain) {
        if (b.banOnToCheck !== false) {
          botStatus = 'NONE';
          logs.push({
            step,
            blockType: 'KEYCHECK',
            level: 'warn',
            message: `No keychain matched -> Status: NONE (ToCheck)`,
          });
        } else {
          logs.push({
            step,
            blockType: 'KEYCHECK',
            level: 'info',
            message: `No keychain matched (continuing execution)`,
          });
        }
      } else {
        if (botStatus !== 'SUCCESS') {
          break;
        }
      }
      continue;
    }

    if (b.type === 'FUNCTION') {
      const arg1 = resolveVariables(b.functionArg1 || '', vars, headers, cookies);
      const arg2 = resolveVariables(b.functionArg2 || '', vars, headers, cookies);
      const input = resolveVariables(b.functionInput || '', vars, headers, cookies);
      const result = runFunction(b.functionName || 'Hash', arg1, arg2, input);
      const varName = b.varName || 'FUNC_RESULT';
      vars[varName] = result;
      if (b.isCapture) captures[varName] = result;
      logs.push({
        step,
        blockType: 'FUNCTION',
        level: 'var',
        message: `FUNCTION ${b.functionName} -> ${b.isCapture ? 'CAP' : 'VAR'} "${varName}" = "${result.slice(0, 100)}"`,
      });
      continue;
    }

    if (b.type === 'UTILITY') {
      const target = resolveVariables(b.utilityTarget || '', vars, headers, cookies);
      const p1 = resolveVariables(b.utilityParam1 || '', vars, headers, cookies);
      const p2 = resolveVariables(b.utilityParam2 || '', vars, headers, cookies);
      const varName = b.varName || 'UTIL_RESULT';
      let result = target;
      const act = (b.utilityAction || '').toLowerCase();

      if (act === 'split') {
        const idx = parseInt(p2 || '0', 10) || 0;
        result = target.split(p1 || ',')[idx] ?? '';
      } else if (act === 'join') {
        result = target.split(/\s+/).join(p1 || ',');
      } else if (act === 'hextobase64') {
        result = Buffer.from(target, 'hex').toString('base64');
      } else if (act === 'base64tohex') {
        result = Buffer.from(target, 'base64').toString('hex');
      }

      vars[varName] = result;
      if (b.isCapture) captures[varName] = result;
      logs.push({
        step,
        blockType: 'UTILITY',
        level: 'var',
        message: `UTILITY ${b.utilityGroup} ${b.utilityAction} -> "${varName}" = "${result}"`,
      });
      continue;
    }

    if (b.type === 'SET') {
      const val = resolveVariables(b.setValue || '', vars, headers, cookies);
      const varName = b.varName || 'MYVAR';
      vars[varName] = val;
      if (b.isCapture) captures[varName] = val;
      logs.push({
        step,
        blockType: 'SET',
        level: 'var',
        message: `SET ${b.isCapture ? 'CAP' : 'VAR'} "${varName}" = "${val}"`,
      });
      continue;
    }

    if (b.type === 'DELETE') {
      const varName = b.varName || '';
      delete vars[varName];
      delete captures[varName];
      logs.push({
        step,
        blockType: 'DELETE',
        level: 'info',
        message: `Deleted variable "${varName}"`,
      });
      continue;
    }

    if (b.type === 'PRINT') {
      const msg = resolveVariables(b.printText || '', vars, headers, cookies);
      logs.push({
        step,
        blockType: 'PRINT',
        level: 'info',
        message: `PRINT: ${msg}`,
      });
      continue;
    }

    // Stubbed desktop-only blocks (Selenium / Captcha / Raw TCP)
    logs.push({
      step,
      blockType: b.type,
      level: 'warn',
      message: `${b.type} is stubbed in Web Studio runtime (desktop Selenium/Captcha/TCP drivers are unavailable in cloud container).`,
    });
  }

  return {
    status: botStatus,
    customStatus,
    variables: vars,
    captures,
    logs,
    lastResponse,
    elapsedMs: Date.now() - started,
  };
}
