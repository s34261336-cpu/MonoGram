import { useState } from 'react';
import { ArrowRight, Check, LoaderCircle, MailCheck, MessageCircle, ShieldCheck } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import './_group.css';
import './Glass.css';

type Notice = { title: string; description: string };

export function Glass() {
  const [register, setRegister] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
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

  function changeMode(nextRegister: boolean) {
    setRegister(nextRegister);
    setConfirmation(false);
    setNotice(null);
    form.clearErrors();
  }

  async function submit(values: z.infer<typeof schema>) {
    setNotice(null);
    setBusy(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setBusy(false);

    if (register) {
      setConfirmation(true);
      return;
    }

    setNotice({
      title: 'Демонстрационный режим',
      description: 'Вход не выполнялся — введённые данные никуда не отправляются.',
    });
    form.reset({ ...values, password: '' });
  }

  return (
    <main className="mg-glass">
      <div className="mg-glass__mesh" aria-hidden="true" />
      <div className="mg-glass__orb mg-glass__orb--one" aria-hidden="true" />
      <div className="mg-glass__orb mg-glass__orb--two" aria-hidden="true" />
      <div className="mg-glass__float mg-glass__float--top" aria-hidden="true">
        <span className="mg-glass__float-icon"><MessageCircle size={15} /></span>
        <span><b>Личные чаты</b><small>всё на своих местах</small></span>
        <i />
      </div>
      <div className="mg-glass__float mg-glass__float--bottom" aria-hidden="true">
        <span className="mg-glass__bubble">Всё важное — рядом</span>
        <span className="mg-glass__bubble-mark"><Check size={12} /></span>
      </div>

      <section className="mg-glass__panel" aria-labelledby="mg-heading">
        <header className="mg-glass__brand-row">
          <div className="mg-glass__brand">
            <span className="mg-glass__brand-icon"><MessageCircle size={19} strokeWidth={2.4} /></span>
            <span>monogram<span className="mg-glass__period">.</span></span>
          </div>
          <span className="mg-glass__secure"><span /> Защищённое пространство</span>
        </header>

        <div className="mg-glass__intro">
          <span className="mg-glass__eyebrow">ВАШ КРУГ ОБЩЕНИЯ</span>
          <h1 id="mg-heading">{confirmation ? 'Почти готово.' : register ? 'Начните с имени.' : <>Разговоры,<br />к которым хочется вернуться.</>}</h1>
          <p>{confirmation
            ? 'Остался один спокойный шаг — подтвердить адрес.'
            : 'Сообщения, каналы и близкие люди — в одном лёгком пространстве.'}</p>
        </div>

        {confirmation ? (
          <section className="mg-glass__confirmation" role="status" aria-live="polite">
            <div className="mg-glass__confirmation-icon"><MailCheck size={23} /></div>
            <div className="mg-glass__confirmation-copy">
              <span className="mg-glass__confirmation-label">ЗАЯВКА ПОДГОТОВЛЕНА</span>
              <h2>Адрес для связи указан</h2>
              <p>Это только демонстрация интерфейса. Письмо не отправлялось, аккаунт не создан, а ваши данные остаются на этой странице.</p>
            </div>
            <Button className="mg-glass__button mg-glass__button--quiet" type="button" onClick={() => changeMode(false)}>
              Вернуться ко входу <ArrowRight size={16} />
            </Button>
          </section>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="mg-glass__form">
              {register && (
                <FormField control={form.control} name="displayName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ваше имя</FormLabel>
                    <FormControl><Input placeholder="Как к вам обращаться" autoComplete="name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Адрес электронной почты</FormLabel>
                  <FormControl><Input type="email" autoComplete="email" placeholder="имя@почта.ru" {...field} /></FormControl>
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
              {notice && (
                <div className="mg-glass__notice" role="status" aria-live="polite">
                  <span><ShieldCheck size={17} /></span>
                  <div><strong>{notice.title}</strong><p>{notice.description}</p></div>
                </div>
              )}
              <Button className="mg-glass__button" type="submit" disabled={busy}>
                {busy ? <><LoaderCircle className="mg-glass__spin" size={17} /> Подождите</> : register ? 'Создать аккаунт' : 'Войти'}
                {!busy && <ArrowRight size={17} />}
              </Button>
            </form>
          </Form>
        )}

        {!confirmation && (
          <div className="mg-glass__switch">
            {register ? 'Уже есть аккаунт MonoGram?' : 'Впервые в MonoGram?'}
            <button type="button" onClick={() => changeMode(!register)}>
              {register ? 'Войти' : 'Создать аккаунт'}
            </button>
          </div>
        )}

        <footer className="mg-glass__foot">
          <ShieldCheck size={15} />
          <span>Личные данные остаются личными</span>
          <span className="mg-glass__foot-dot" />
          <span>Макет MonoGram</span>
        </footer>
      </section>
      <div className="mg-glass__side-note" aria-hidden="true"><span /> ДЛЯ РАЗГОВОРОВ, КОТОРЫЕ ВАЖНЫ</div>
    </main>
  );
}
