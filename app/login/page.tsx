import { redirect } from "next/navigation";
import { currentProfiles, HOME } from "../../lib/guard";
import { FieldError } from "../../components/ui";
import { SubmitButton } from "../../components/client";
import { login } from "../actions";

export const metadata = { title: "Вход" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; u?: string }> }) {
  const { profiles } = await currentProfiles();
  if (profiles.length) redirect(HOME[profiles[0].role]);
  const { error, u } = await searchParams;
  const loginErr = error === "login" ? "Введите логин." : null;
  const passErr = error === "password" ? "Логин или пароль не подошли. После 5 ошибок вход для логина закрыт на 15 минут." : null;
  return <main id="main" className="login">
    <div className="login-in">
      <span className="lab" style={{ fontWeight: 600, color: "var(--ink2)" }}>Цифровой деканат</span>
      <h1>Вход</h1>
      <form action={login} className="glass" noValidate>
        <div className="field">
          <label htmlFor="login">Логин</label>
          <input id="login" name="login" autoComplete="username" required maxLength={80} defaultValue={u ?? ""} autoCapitalize="none" spellCheck={false}
            aria-invalid={loginErr ? true : undefined} aria-describedby={loginErr ? "login-e" : undefined} />
          {loginErr && <FieldError id="login-e">{loginErr}</FieldError>}
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128}
            aria-invalid={passErr ? true : undefined} aria-describedby={passErr ? "password-e" : undefined} autoFocus={!!passErr} />
          {passErr && <FieldError id="password-e">{passErr}</FieldError>}
        </div>
        <SubmitButton pendingText="Входим…">Войти</SubmitButton>
        <p className="fine">Концепт для конкурса, не официальный сервис. Все данные вымышленные.</p>
      </form>
    </div>
  </main>;
}
