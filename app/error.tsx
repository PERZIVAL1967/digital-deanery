"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main" className="login">
    <div className="login-in">
      <h1>Упс</h1>
      <div className="glass">
        <b>Не удалось загрузить данные</b>
        <p className="note">Сервер не ответил вовремя. Данные не потерялись: попробуйте ещё раз.</p>
        <button type="button" className="btn pri full" onClick={() => reset()}>Повторить</button>
        <Link className="btn sec full" href="/">На главную</Link>
      </div>
    </div>
  </main>;
}
