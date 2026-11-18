import { Playground } from '../playground/App';
import { Docs } from './Docs';
import { Home } from './Home';
import { href, useRoute, type Route } from './router';
import { ThemeToggle, useTheme } from './theme';

const NAV: [Route, string][] = [
  ['home', 'Overview'],
  ['docs', 'Docs'],
  ['playground', 'Playground'],
];

const NPM_URL = 'https://www.npmjs.com/package/react-glass-lens';

function Header({ route }: { route: Route }) {
  const [theme, setTheme] = useTheme();
  return (
    <header className={`site-header${route === 'playground' ? ' overlay' : ''}`}>
      <a className="brand" href={href('home')}>
        <span className="brand-dot" aria-hidden /> react-glass-lens
      </a>
      <nav className="site-nav" aria-label="Main">
        {NAV.map(([r, label]) => (
          <a key={r} href={href(r)} aria-current={route === r ? 'page' : undefined} className={route === r ? 'on' : ''}>
            {label}
          </a>
        ))}
      </nav>
      <div className="header-end">
        <a className="npm" href={NPM_URL} target="_blank" rel="noreferrer">
          npm
        </a>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>react-glass-lens · MIT</span>
      <span>
        <a href={href('docs')}>Docs</a> · <a href={href('playground')}>Playground</a> · <a href={NPM_URL}>npm</a>
      </span>
    </footer>
  );
}

export function Site() {
  const { route } = useRoute();
  return (
    <div className={`site route-${route}`}>
      <Header route={route} />
      {route === 'playground' ? (
        <Playground />
      ) : (
        <>
          <main>{route === 'docs' ? <Docs /> : <Home />}</main>
          <Footer />
        </>
      )}
    </div>
  );
}
