import { useState } from 'react';

export default function LoginForm({ needsSetup }: { needsSetup: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(needsSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed.');
      window.location.href = '/admin';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <p className="label">{needsSetup ? 'first run — create your admin account' : 'studio access'}</p>
      <input
        autoFocus
        placeholder="username"
        value={username}
        autoComplete="username"
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder={needsSetup ? 'password (min 10 chars)' : 'password'}
        value={password}
        autoComplete={needsSetup ? 'new-password' : 'current-password'}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="auth-error">{error}</p>}
      <button className="btn-primary" disabled={busy} type="submit">
        {busy ? '…' : needsSetup ? 'create account' : 'enter'}
      </button>
    </form>
  );
}
