import { NavLink, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const tabs = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/prs', label: 'Pull Requests' },
  { to: '/team', label: 'Team' },
  { to: '/ask', label: 'Ask' },
];

export function Nav() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });

  return (
    <header className="sticky top-0 z-40 nav-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6 text-[13px]">
        <Link to="/" className="flex items-center gap-2 font-medium tracking-tight text-ink-800">
          <Logo />
          <span>DevPulse</span>
        </Link>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 transition ${
                  isActive ? 'bg-ink-100 text-ink-800' : 'text-ink-600 hover:text-ink-800'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {me?.authenticated ? (
            <div className="flex items-center gap-2">
              {me.avatar_url && (
                <img src={me.avatar_url} alt="" className="h-6 w-6 rounded-full ring-1 ring-ink-200" />
              )}
              <span className="text-ink-600">{me.login}</span>
            </div>
          ) : (
            <a href={(import.meta.env.VITE_API_URL ?? '/api') + '/auth/github'} className="btn-ghost">
              Connect GitHub
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 L21 7 L12 12 L3 7 Z"
        fill="url(#g)"
      />
      <path d="M3 12 L12 17 L21 12" stroke="#0071e3" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 17 L12 22 L21 17" stroke="#0071e3" strokeWidth="1.5" strokeLinejoin="round" opacity=".5" />
      <defs>
        <linearGradient id="g" x1="3" y1="2" x2="21" y2="12">
          <stop offset="0" stopColor="#0071e3" />
          <stop offset="1" stopColor="#7e3bff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
