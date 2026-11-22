import React from 'react';

const KEYWORD_COLORS: Record<string, string> = {
  FUNCTION: '#adff2f',
  KEYCHECK: '#1e90ff',
  KEYCHAIN: '#dda0dd',
  KEY: '#87ceeb',
  VALUE: '#87ceeb',
  NKEY: '#87ceeb',
  MKEY: '#87ceeb',
  NMKEY: '#87ceeb',
  RKEY: '#87ceeb',
  RECAPTCHA: '#40e0d0',
  SOLVECAPTCHA: '#40e0d0',
  REQUEST: '#32cd32',
  HEADER: '#dda0dd',
  COOKIE: '#87ceeb',
  CONTENT: '#87ceeb',
  CONTENTTYPE: '#87ceeb',
  PARSE: '#ffd700',
  LR: '#ffa500',
  CSS: '#ffa500',
  JSON: '#ffa500',
  REGEX: '#ffa500',
  CAPTCHA: '#ff8c00',
  REPORTCAPTCHA: '#ff8c00',
  BYPASSCF: '#e9967a',
  TCP: '#9370db',
  UTILITY: '#f5deb3',
  NAVIGATE: '#4169e1',
  BROWSERACTION: '#228b22',
  ELEMENTACTION: '#b22222',
  EXECUTEJS: '#6a5acd',
  IF: '#ff4500',
  ELSE: '#ff4500',
  ENDIF: '#ff4500',
  WHILE: '#ff4500',
  ENDWHILE: '#ff4500',
  JUMP: '#ff4500',
  PRINT: '#ffa500',
  SET: '#ffa500',
  DELETE: '#ffa500',
  VAR: '#ffff00',
  GVAR: '#ffff00',
  CAP: '#ff6347',
  '->': '#ff00ff',
};

function renderTokens(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /("(?:\\.|[^"\\])*")|(<[^>]+>)|(\b(?:FUNCTION|KEYCHECK|KEYCHAIN|KEY|VALUE|NKEY|MKEY|NMKEY|RKEY|RECAPTCHA|SOLVECAPTCHA|REQUEST|HEADER|COOKIE|CONTENT|CONTENTTYPE|PARSE|LR|CSS|JSON|REGEX|CAPTCHA|REPORTCAPTCHA|BYPASSCF|TCP|UTILITY|NAVIGATE|BROWSERACTION|ELEMENTACTION|EXECUTEJS|IF|ELSE|ENDIF|WHILE|ENDWHILE|JUMP|PRINT|SET|DELETE|VAR|GVAR|CAP)\b|->)/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<span key={k++}>{line.slice(lastIdx, match.index)}</span>);
    }
    const text = match[0];
    if (match[1]) {
      // String literal with variable highlights inside
      const inner = text.split(/(<[^>|>]+>)/g);
      parts.push(
        <span key={k++} className="text-[#add8e6]">
          {inner.map((seg, idx) =>
            seg.startsWith('<') && seg.endsWith('>') ? (
              <span key={idx} className="text-[#ffff00] font-semibold">
                {seg}
              </span>
            ) : (
              <span key={idx}>{seg}</span>
            )
          )}
        </span>
      );
    } else if (match[2]) {
      parts.push(
        <span key={k++} className="text-[#ffff00] font-semibold">
          {text}
        </span>
      );
    } else {
      const color = KEYWORD_COLORS[text] || '#dcdcdc';
      parts.push(
        <span key={k++} style={{ color }} className="font-bold">
          {text}
        </span>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < line.length) {
    parts.push(<span key={k++}>{line.slice(lastIdx)}</span>);
  }
  return parts;
}

export const LoliScriptHighlight: React.FC<{ code: string }> = ({ code }) => {
  const lines = code.split(/\r?\n/);

  return (
    <pre className="m-0 p-3 text-xs leading-5 overflow-x-auto bg-[#0f0f0f] border border-[#2f2f2f] rounded font-mono">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('##')) {
          return (
            <div key={i} className="text-[#808080] italic">
              <span className="inline-block w-7 text-right mr-3 text-[#444] select-none">{i + 1}</span>
              {line || ' '}
            </div>
          );
        }
        if (trimmed.startsWith('!')) {
          return (
            <div key={i} className="text-[#ff6347] opacity-80">
              <span className="inline-block w-7 text-right mr-3 text-[#444] select-none">{i + 1}</span>
              {line || ' '}
            </div>
          );
        }
        return (
          <div key={i} className="text-[#dcdcdc]">
            <span className="inline-block w-7 text-right mr-3 text-[#444] select-none">{i + 1}</span>
            {line ? renderTokens(line) : ' '}
          </div>
        );
      })}
    </pre>
  );
};
