import {
  BlockType,
  KeychainEntry,
  KeychainMode,
  KeychainType,
  KeyCondition,
  KeyEntry,
  StackBlock,
} from '../src/types.ts';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function escapeQuotes(str: string): string {
  return (str ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unescapeQuotes(str: string): string {
  return (str ?? '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function tokenizeArgs(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++;
    if (i >= line.length) break;
    if (line[i] === '"') {
      i++;
      let val = '';
      while (i < line.length) {
        if (line[i] === '\\' && i + 1 < line.length) {
          if (line[i + 1] === '"' || line[i + 1] === '\\') {
            val += line[i + 1];
            i += 2;
            continue;
          }
        }
        if (line[i] === '"') {
          i++;
          break;
        }
        val += line[i++];
      }
      tokens.push(`"${val}"`);
    } else {
      let val = '';
      while (i < line.length && !/\s/.test(line[i])) {
        val += line[i++];
      }
      tokens.push(val);
    }
  }
  return tokens;
}

export function stripQuotes(token?: string): string {
  if (!token) return '';
  if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
    return unescapeQuotes(token.slice(1, -1));
  }
  return token;
}

export function serializeBlocksToLoliScript(blocks: StackBlock[]): string {
  const lines: string[] = [];

  for (const b of blocks) {
    const prefix = b.disabled ? '!' : '';
    switch (b.type) {
      case 'REQUEST': {
        const method = b.method || 'GET';
        const url = escapeQuotes(b.url || 'https://httpbin.org/get');
        const flags: string[] = [];
        if (b.autoRedirect === false) flags.push('AutoRedirect=FALSE');
        if (b.readResponseSource === false) flags.push('ReadResponseSource=FALSE');
        lines.push(`${prefix}REQUEST ${method} "${url}"${flags.length ? ' ' + flags.join(' ') : ''}`);
        if (b.content) {
          lines.push(`${prefix}  CONTENT "${escapeQuotes(b.content)}"`);
        }
        if (b.contentType) {
          lines.push(`${prefix}  CONTENTTYPE "${escapeQuotes(b.contentType)}"`);
        }
        if (b.cookies) {
          for (const [k, v] of Object.entries(b.cookies)) {
            lines.push(`${prefix}  COOKIE "${escapeQuotes(k)}: ${escapeQuotes(v)}"`);
          }
        }
        if (b.headers) {
          for (const [k, v] of Object.entries(b.headers)) {
            lines.push(`${prefix}  HEADER "${escapeQuotes(k)}: ${escapeQuotes(v)}"`);
          }
        }
        break;
      }

      case 'KEYCHECK': {
        const flags: string[] = [];
        if (b.banOn4XX) flags.push('BanOn4XX=TRUE');
        if (b.banOnToCheck === false) flags.push('BanOnToCheck=FALSE');
        lines.push(`${prefix}KEYCHECK${flags.length ? ' ' + flags.join(' ') : ''}`);
        for (const kc of b.keychains || []) {
          const customPart = kc.type === 'Custom' ? ` "${escapeQuotes(kc.customType || 'CUSTOM')}"` : '';
          lines.push(`${prefix}  KEYCHAIN ${kc.type}${customPart} ${kc.mode}`);
          for (const k of kc.keys) {
            const target = k.target && k.target !== '<SOURCE>' ? ` "${escapeQuotes(k.target)}"` : '';
            lines.push(`${prefix}    KEY "${escapeQuotes(k.value)}" ${k.condition}${target}`);
          }
        }
        break;
      }

      case 'PARSE': {
        const target = escapeQuotes(b.parseTarget || '<SOURCE>');
        const mode = b.parseType || 'LR';
        let modeArgs = '';
        if (mode === 'LR') {
          modeArgs = `LR "${escapeQuotes(b.leftDelim || '')}" "${escapeQuotes(b.rightDelim || '')}"`;
        } else if (mode === 'JSON') {
          modeArgs = `JSON "${escapeQuotes(b.jsonField || '')}"`;
        } else if (mode === 'CSS') {
          modeArgs = `CSS "${escapeQuotes(b.cssSelector || '')}" "${escapeQuotes(b.cssAttribute || 'innerText')}" ${b.parseIndex ?? 0}`;
        } else if (mode === 'REGEX') {
          modeArgs = `REGEX "${escapeQuotes(b.regexPattern || '')}" "${escapeQuotes(b.regexOutput || '[1]')}"`;
        }
        const flags: string[] = [];
        if (b.recursive) flags.push('Recursive=TRUE');
        if (b.createEmpty === false) flags.push('CreateEmpty=FALSE');
        const arrow = b.isCapture ? 'CAP' : 'VAR';
        const varName = escapeQuotes(b.varName || 'PARSED');
        const affixes =
          b.prefix || b.suffix
            ? ` "${escapeQuotes(b.prefix || '')}" "${escapeQuotes(b.suffix || '')}"`
            : '';
        lines.push(
          `${prefix}PARSE "${target}" ${modeArgs}${flags.length ? ' ' + flags.join(' ') : ''} -> ${arrow} "${varName}"${affixes}`
        );
        break;
      }

      case 'FUNCTION': {
        const fn = b.functionName || 'Hash';
        const args: string[] = [];
        if (b.functionArg1) args.push(`"${escapeQuotes(b.functionArg1)}"`);
        if (b.functionArg2) args.push(`"${escapeQuotes(b.functionArg2)}"`);
        const input = b.functionInput !== undefined ? ` "${escapeQuotes(b.functionInput)}"` : '';
        const arrow = b.isCapture ? 'CAP' : 'VAR';
        const varName = escapeQuotes(b.varName || 'FUNC_RESULT');
        lines.push(
          `${prefix}FUNCTION ${fn}${args.length ? ' ' + args.join(' ') : ''}${input} -> ${arrow} "${varName}"`
        );
        break;
      }

      case 'UTILITY': {
        const grp = b.utilityGroup || 'VARIABLE';
        const target = escapeQuotes(b.utilityTarget || '');
        const act = b.utilityAction || 'Split';
        const params: string[] = [];
        if (b.utilityParam1) params.push(`"${escapeQuotes(b.utilityParam1)}"`);
        if (b.utilityParam2) params.push(`"${escapeQuotes(b.utilityParam2)}"`);
        const arrow = b.isCapture ? 'CAP' : 'VAR';
        const varName = escapeQuotes(b.varName || 'UTIL_RESULT');
        lines.push(
          `${prefix}UTILITY ${grp} "${target}" ${act}${params.length ? ' ' + params.join(' ') : ''} -> ${arrow} "${varName}"`
        );
        break;
      }

      case 'SET': {
        const arrow = b.isCapture ? 'CAP' : 'VAR';
        lines.push(`${prefix}SET ${arrow} "${escapeQuotes(b.varName || 'MYVAR')}" "${escapeQuotes(b.setValue || '')}"`);
        break;
      }

      case 'DELETE': {
        lines.push(`${prefix}DELETE VAR "${escapeQuotes(b.varName || '')}"`);
        break;
      }

      case 'PRINT': {
        lines.push(`${prefix}PRINT "${escapeQuotes(b.printText || '')}"`);
        break;
      }

      default: {
        lines.push(b.rawLine || `${prefix}${b.type}`);
        break;
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function parseLoliScriptToBlocks(script: string): StackBlock[] {
  const rawLines = script.split(/\r?\n/);
  const blocks: StackBlock[] = [];
  let i = 0;

  while (i < rawLines.length) {
    let raw = rawLines[i].trim();
    if (!raw || raw.startsWith('##')) {
      i++;
      continue;
    }

    let disabled = false;
    if (raw.startsWith('!')) {
      disabled = true;
      raw = raw.slice(1).trim();
    }

    const tokens = tokenizeArgs(raw);
    if (tokens.length === 0) {
      i++;
      continue;
    }

    const cmd = tokens[0].toUpperCase();

    if (cmd === 'REQUEST') {
      const method = (tokens[1]?.toUpperCase() || 'GET') as StackBlock['method'];
      const url = stripQuotes(tokens[2]) || '';
      let autoRedirect = true;
      let readResponseSource = true;
      for (const t of tokens.slice(3)) {
        if (t.toUpperCase() === 'AUTOREDIRECT=FALSE') autoRedirect = false;
        if (t.toUpperCase() === 'READRESPONSESOURCE=FALSE') readResponseSource = false;
      }
      const headers: Record<string, string> = {};
      const cookies: Record<string, string> = {};
      let content = '';
      let contentType = 'application/x-www-form-urlencoded';

      i++;
      while (i < rawLines.length) {
        let sub = rawLines[i].trim();
        if (sub.startsWith('!')) sub = sub.slice(1).trim();
        const subToks = tokenizeArgs(sub);
        const subCmd = subToks[0]?.toUpperCase();
        if (!subCmd) {
          i++;
          continue;
        }
        if (
          ['CONTENT', 'CONTENTTYPE', 'HEADER', 'COOKIE', 'STRINGCONTENT', 'FILECONTENT', 'BOUNDARY', 'SECPROTO'].includes(
            subCmd
          )
        ) {
          if (subCmd === 'CONTENT') content = stripQuotes(subToks[1]);
          else if (subCmd === 'CONTENTTYPE') contentType = stripQuotes(subToks[1]);
          else if (subCmd === 'HEADER') {
            const kv = stripQuotes(subToks[1]);
            const idx = kv.indexOf(':');
            if (idx !== -1) headers[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
          } else if (subCmd === 'COOKIE') {
            const kv = stripQuotes(subToks[1]);
            const idx = kv.indexOf(':');
            if (idx !== -1) cookies[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
          }
          i++;
        } else {
          break;
        }
      }

      blocks.push({
        id: uid(),
        type: 'REQUEST',
        label: `${method} ${url.slice(0, 36)}`,
        disabled,
        method,
        url,
        content,
        contentType,
        headers,
        cookies,
        autoRedirect,
        readResponseSource,
      });
      continue;
    }

    if (cmd === 'KEYCHECK') {
      let banOn4XX = false;
      let banOnToCheck = true;
      for (const t of tokens.slice(1)) {
        if (t.toUpperCase() === 'BANON4XX=TRUE') banOn4XX = true;
        if (t.toUpperCase() === 'BANONTOCHECK=FALSE') banOnToCheck = false;
      }

      const keychains: KeychainEntry[] = [];
      let currentKc: KeychainEntry | null = null;

      i++;
      while (i < rawLines.length) {
        let sub = rawLines[i].trim();
        if (sub.startsWith('!')) sub = sub.slice(1).trim();
        const subToks = tokenizeArgs(sub);
        const subCmd = subToks[0]?.toUpperCase();
        if (!subCmd) {
          i++;
          continue;
        }
        if (subCmd === 'KEYCHAIN') {
          const rawType = (subToks[1] || 'Success') as KeychainType;
          let customType: string | undefined;
          let mode: KeychainMode = 'OR';
          if (rawType.toLowerCase() === 'custom') {
            customType = stripQuotes(subToks[2]) || 'CUSTOM';
            mode = ((subToks[3] || 'OR').toUpperCase() as KeychainMode) || 'OR';
          } else {
            mode = ((subToks[2] || 'OR').toUpperCase() as KeychainMode) || 'OR';
          }
          currentKc = {
            id: uid(),
            type: (rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()) as KeychainType,
            customType,
            mode,
            keys: [],
          };
          keychains.push(currentKc);
          i++;
        } else if (subCmd === 'KEY' && currentKc) {
          const val = stripQuotes(subToks[1]);
          const cond = (subToks[2] || 'Contains') as KeyCondition;
          const target = subToks[3] ? stripQuotes(subToks[3]) : '<SOURCE>';
          const k: KeyEntry = {
            id: uid(),
            target,
            condition: cond,
            value: val,
          };
          currentKc.keys.push(k);
          i++;
        } else {
          break;
        }
      }

      blocks.push({
        id: uid(),
        type: 'KEYCHECK',
        label: `Keycheck (${keychains.length} chains)`,
        disabled,
        banOn4XX,
        banOnToCheck,
        keychains,
      });
      continue;
    }

    if (cmd === 'PARSE') {
      const parseTarget = stripQuotes(tokens[1]) || '<SOURCE>';
      const mode = (tokens[2]?.toUpperCase() || 'LR') as 'LR' | 'JSON' | 'CSS' | 'REGEX';
      const arrowIdx = tokens.findIndex((t) => t === '->');
      const beforeArrow = arrowIdx !== -1 ? tokens.slice(3, arrowIdx) : tokens.slice(3);
      const afterArrow = arrowIdx !== -1 ? tokens.slice(arrowIdx + 1) : [];

      const isCapture = afterArrow[0]?.toUpperCase() === 'CAP';
      const varName = stripQuotes(afterArrow[1]) || 'PARSED';
      const prefix = stripQuotes(afterArrow[2]) || '';
      const suffix = stripQuotes(afterArrow[3]) || '';

      let recursive = false;
      let createEmpty = true;
      const cleanArgs: string[] = [];
      for (const a of beforeArrow) {
        if (a.toUpperCase() === 'RECURSIVE=TRUE') recursive = true;
        else if (a.toUpperCase() === 'CREATEEMPTY=FALSE') createEmpty = false;
        else cleanArgs.push(a);
      }

      const block: StackBlock = {
        id: uid(),
        type: 'PARSE',
        label: `Parse ${mode} -> ${varName}`,
        disabled,
        parseTarget,
        parseType: mode,
        recursive,
        createEmpty,
        isCapture,
        varName,
        prefix,
        suffix,
      };

      if (mode === 'LR') {
        block.leftDelim = stripQuotes(cleanArgs[0]);
        block.rightDelim = stripQuotes(cleanArgs[1]);
      } else if (mode === 'JSON') {
        block.jsonField = stripQuotes(cleanArgs[0]);
      } else if (mode === 'CSS') {
        block.cssSelector = stripQuotes(cleanArgs[0]);
        block.cssAttribute = stripQuotes(cleanArgs[1]) || 'innerText';
        block.parseIndex = cleanArgs[2] ? parseInt(cleanArgs[2], 10) || 0 : 0;
      } else if (mode === 'REGEX') {
        block.regexPattern = stripQuotes(cleanArgs[0]);
        block.regexOutput = stripQuotes(cleanArgs[1]) || '[1]';
      }

      blocks.push(block);
      i++;
      continue;
    }

    if (cmd === 'FUNCTION') {
      const fn = tokens[1] || 'Hash';
      const arrowIdx = tokens.findIndex((t) => t === '->');
      const beforeArrow = arrowIdx !== -1 ? tokens.slice(2, arrowIdx) : tokens.slice(2);
      const afterArrow = arrowIdx !== -1 ? tokens.slice(arrowIdx + 1) : [];

      const isCapture = afterArrow[0]?.toUpperCase() === 'CAP';
      const varName = stripQuotes(afterArrow[1]) || 'FUNC_RESULT';

      let functionArg1 = '';
      let functionArg2 = '';
      let functionInput = '';

      if (beforeArrow.length === 1) {
        functionInput = stripQuotes(beforeArrow[0]);
      } else if (beforeArrow.length === 2) {
        functionArg1 = stripQuotes(beforeArrow[0]);
        functionInput = stripQuotes(beforeArrow[1]);
      } else if (beforeArrow.length >= 3) {
        functionArg1 = stripQuotes(beforeArrow[0]);
        functionArg2 = stripQuotes(beforeArrow[1]);
        functionInput = stripQuotes(beforeArrow[2]);
      }

      blocks.push({
        id: uid(),
        type: 'FUNCTION',
        label: `Function ${fn} -> ${varName}`,
        disabled,
        functionName: fn,
        functionArg1,
        functionArg2,
        functionInput,
        isCapture,
        varName,
      });
      i++;
      continue;
    }

    if (cmd === 'UTILITY') {
      const utilityGroup = (tokens[1]?.toUpperCase() || 'VARIABLE') as StackBlock['utilityGroup'];
      const utilityTarget = stripQuotes(tokens[2]);
      const utilityAction = tokens[3] || 'Split';
      const arrowIdx = tokens.findIndex((t) => t === '->');
      const params = arrowIdx !== -1 ? tokens.slice(4, arrowIdx) : tokens.slice(4);
      const afterArrow = arrowIdx !== -1 ? tokens.slice(arrowIdx + 1) : [];
      const isCapture = afterArrow[0]?.toUpperCase() === 'CAP';
      const varName = stripQuotes(afterArrow[1]) || 'UTIL_RESULT';

      blocks.push({
        id: uid(),
        type: 'UTILITY',
        label: `Utility ${utilityGroup} ${utilityAction}`,
        disabled,
        utilityGroup,
        utilityTarget,
        utilityAction,
        utilityParam1: stripQuotes(params[0]),
        utilityParam2: stripQuotes(params[1]),
        isCapture,
        varName,
      });
      i++;
      continue;
    }

    if (cmd === 'SET') {
      const isCapture = tokens[1]?.toUpperCase() === 'CAP';
      const varName = stripQuotes(tokens[2]) || 'MYVAR';
      const setValue = stripQuotes(tokens[3]) || '';
      blocks.push({
        id: uid(),
        type: 'SET',
        label: `Set ${isCapture ? 'CAP' : 'VAR'} ${varName}`,
        disabled,
        isCapture,
        varName,
        setValue,
      });
      i++;
      continue;
    }

    if (cmd === 'DELETE') {
      const varName = stripQuotes(tokens[2] || tokens[1]) || '';
      blocks.push({
        id: uid(),
        type: 'DELETE',
        label: `Delete ${varName}`,
        disabled,
        varName,
      });
      i++;
      continue;
    }

    if (cmd === 'PRINT') {
      const printText = stripQuotes(tokens[1]) || '';
      blocks.push({
        id: uid(),
        type: 'PRINT',
        label: `Print`,
        disabled,
        printText,
      });
      i++;
      continue;
    }

    const supportedStubs: BlockType[] = ['SOLVECAPTCHA', 'NAVIGATE', 'BROWSERACTION', 'EXECUTEJS', 'TCP'];
    const matchedStub = supportedStubs.find((s) => s === cmd);
    blocks.push({
      id: uid(),
      type: matchedStub || 'PRINT',
      label: `${cmd} (Raw)`,
      disabled,
      rawLine: raw,
      printText: raw,
    });
    i++;
  }

  return blocks;
}
