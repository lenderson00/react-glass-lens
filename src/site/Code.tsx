import { useState, type ReactNode } from 'react';

// Minimal TSX/shell highlighter — enough for docs snippets, no dependency.
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'])*'|"(?:\\.|[^"])*"|`(?:\\.|[^`])*`)|(<\/?[A-Za-z][\w.]*|\/?>)|\b(import|from|export|const|let|function|return|type|interface|extends|true|false|null|undefined|new|if|else|await|async)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)(?==)/g;

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of code.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(code.slice(last, idx));
    const cls = m[1] ? 'tk-c' : m[2] ? 'tk-s' : m[3] ? 'tk-t' : m[4] ? 'tk-k' : m[5] ? 'tk-n' : 'tk-a';
    out.push(
      <span key={i++} className={cls}>
        {m[0]}
      </span>,
    );
    last = idx + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function Code({ children, lang = 'tsx', title }: { children: string; lang?: 'tsx' | 'sh'; title?: string }) {
  const code = children.replace(/^\n/, '').replace(/\s+$/, '');
  return (
    <div className="code">
      <div className="code-head">
        <span>{title ?? (lang === 'sh' ? 'Terminal' : 'TSX')}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code>{lang === 'sh' ? <span className="tk-sh">{code}</span> : highlight(code)}</code>
      </pre>
    </div>
  );
}

export function InstallPill() {
  const cmd = 'npm i react-glass-lens';
  return (
    <div className="install">
      <span className="install-prompt" aria-hidden>
        $
      </span>
      <code>{cmd}</code>
      <CopyButton text={cmd} />
    </div>
  );
}
