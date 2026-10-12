'use client';
import { FormEvent, useState } from 'react';
import { Button, Input, Alert, LinkButton } from './ui';
import { useSearchParams } from 'next/navigation';
import { api, errorText } from '../../web/src/api/client';

export default function PartnerActivation() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/partners/invitations/activate', {
        method: 'POST',
        body: { token, password },
      });
      setPassword('');
      setDone(true);
      window.history.replaceState(null, '', '/partner/activate');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sf-panel sf-partner-form">
      <h1>Активация магазина</h1>
      {done ? (
        <>
          <Alert variant="success">Кабинет активирован.</Alert>
          <LinkButton href="/seller/login">Войти в кабинет</LinkButton>
        </>
      ) : token ? (
        <form onSubmit={submit}>
          <Input
            id="activation-password"
            label="Новый пароль"
            required
            type="password"
            minLength={12}
            maxLength={256}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" loading={busy}>
            {busy ? 'Активация…' : 'Активировать кабинет'}
          </Button>
        </form>
      ) : (
        <Alert variant="error">
          Ссылка для активации отсутствует. Свяжитесь с администратором.
        </Alert>
      )}
    </section>
  );
}
