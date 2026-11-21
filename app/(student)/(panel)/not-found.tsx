import Link from "next/link";
import { Page } from "../../../components/ui";

/** inside the student app: same message for «нет такой записи» and «чужая запись» */
export default function NotFound() {
  return <Page title="Страница не найдена или нет доступа">
    <div className="box"><b>404</b><span className="note">Такой страницы нет, или она принадлежит другому пользователю. Проверьте ссылку.</span></div>
    <Link className="btn pri full" href="/">На главную</Link>
  </Page>;
}
