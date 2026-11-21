import Link from "next/link";

/** 404 and «нет доступа» look the same on purpose: no hint that a record exists */
export default function NotFound() {
  return <main id="main" className="login">
    <div className="login-in">
      <h1>404</h1>
      <div className="glass">
        <b>Страница не найдена или нет доступа</b>
        <p className="note">Такой страницы нет, или она принадлежит другому пользователю. Проверьте ссылку.</p>
        <Link className="btn pri full" href="/">На главную</Link>
      </div>
    </div>
  </main>;
}
