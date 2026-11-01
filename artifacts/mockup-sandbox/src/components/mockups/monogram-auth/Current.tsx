import { useState } from 'react';
import { ArrowLeft, LoaderCircle, MessageCircle, Shield } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import './_group.css';

// The extraction keeps the original AuthScreen markup. Auth actions are stubbed
// only inside this isolated visual preview.
function useAuth() {
  return {
    async signIn(_email: string, _password: string): Promise<void> {},
    async signUp(_email: string, _password: string, _displayName: string): Promise<boolean> {
      return false;
    },
  };
}

export function Current() {
  const { signIn, signUp } = useAuth();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const schema = z.object({
    displayName: z.string().optional(),
    email: z.string().email('Введите корректный адрес электронной почты.'),
    password: z.string().min(8, 'Пароль должен содержать не менее 8 символов.'),
  }).refine((value) => !register || (value.displayName || '').trim().length >= 2, {
    path: ['displayName'],
    message: 'Имя должно содержать не менее 2 символов.',
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function submit(values: z.infer<typeof schema>) {
    setError('');
    setBusy(true);
    try {
      if (register) {
        const signedIn = await signUp(values.email, values.password, values.displayName || '');
        setError(signedIn ? '' : 'Проверьте почту, подтвердите адрес и затем войдите.');
        if (!signedIn) setRegister(false);
      } else {
        await signIn(values.email, values.password);
      }
    } catch {
      setError(register
        ? 'Не удалось создать аккаунт. Проверьте адрес почты и настройки регистрации, затем попробуйте снова.'
        : 'Не удалось войти. Проверьте адрес почты и пароль.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-orbit orbit-one" />
      <div className="auth-orbit orbit-two" />
      <section className="auth-panel glass-card">
        <div className="brand-lockup">
          <div className="brand-icon"><MessageCircle size={22} /></div>
          <span>monogram<span className="brand-period">.</span></span>
        </div>
        <div className="auth-kicker">Общение без лишнего шума</div>
        <h1>{register ? 'Больше места для близких.' : 'Ваши разговоры —\nтолько ваши.'}</h1>
        <p className="auth-description">Личные сообщения, интересные каналы и звёзды MonoGram — в одном месте.</p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="form-stack">
            {register && (
              <FormField control={form.control} name="displayName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ваше имя</FormLabel>
                  <FormControl><Input placeholder="Как к вам обращаться" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Адрес электронной почты</FormLabel>
                <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Пароль</FormLabel>
                <FormControl><Input type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder="Не менее 8 символов" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button className="primary-button auth-submit" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={17} /> : register ? 'Создать аккаунт' : 'Войти'}
              <ArrowLeft className="submit-arrow" size={16} />
            </Button>
          </form>
        </Form>
        <div className="auth-switch">
          {register ? 'Уже есть аккаунт MonoGram?' : 'Впервые в MonoGram?'}
          <button type="button" onClick={() => { setRegister(!register); setError(''); }}>
            {register ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
        <div className="auth-foot"><Shield size={14} /> Ваш аккаунт по умолчанию закрыт</div>
      </section>
      <div className="auth-side-note"><span className="note-rule" /> ДЛЯ НАСТОЯЩИХ РАЗГОВОРОВ</div>
    </main>
  );
}
