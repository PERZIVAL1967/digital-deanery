import { requireRole, UUID } from "../../../../lib/guard";
import { plagiarismWorks } from "../../../../lib/dal/cifry";
import { fmtDayMonth, plural } from "../../../../lib/time";
import { Alert, Empty, FieldError, Page, Tag } from "../../../../components/ui";
import { Icon } from "../../../../components/icons";
import { SubmitButton, ToastOnLoad, UploadProgress } from "../../../../components/client";
import { uploadWork } from "./actions";

export const metadata = { title: "Антиплагиат" };

const ERR: Record<string, string> = {
  file: "Выберите файл работы.", type: "Подойдёт файл DOC, DOCX, PDF, ODT, RTF или TXT.", size: "Файл больше 4 МБ. Сожмите его или сохраните в PDF.",
  work: "Эту работу нельзя загрузить: её уже приняли или срок закрыт. Обновите страницу.",
};

export default async function Plagiarism({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await requireRole("student");
  const sp = await searchParams;
  const works = await plagiarismWorks(token);
  const waiting = works.filter((w) => w.status === "waiting" || w.status === "below");
  const nearest = works.filter((w) => w.status === "waiting" && w.days_left >= 0).sort((a, b) => a.days_left - b.days_left)[0];
  const done = sp.done && UUID.test(sp.done) ? works.find((w) => w.id === sp.done) : undefined;
  const fig = done?.originality != null
    ? { num: String(done.originality), unit: "%", label: `оригинальность: ${done.title.toLowerCase()}` }
    : nearest ? { num: String(nearest.days_left), unit: plural(nearest.days_left, "день", "дня", "дней"), label: "до загрузки работы" } : null;
  const errFor = (id: string) => (sp.error && sp.w === id ? ERR[sp.error] : undefined);
  return <Page title="Антиплагиат" fig={fig}>
    {done && <ToastOnLoad text={`Работа проверена: ${done.originality} %, ${done.status === "accepted" ? "принято" : "ниже порога"}.`} />}
    {sp.error === "work" && <Alert>{ERR.work}</Alert>}
    {waiting.map((w) => {
      const err = errFor(w.id);
      return <form key={w.id} action={uploadWork} className="box" encType="multipart/form-data">
        <b>{w.title}</b>
        <span className="note">Срок {fmtDayMonth(w.deadline)}{w.days_left < 0 ? " (прошёл)" : ""}. Порог оригинальности {w.threshold} %.
          {w.status === "below" && ` Прошлая версия: ${w.originality} %, ниже порога. Доработайте и загрузите снова.`}</span>
        <input type="hidden" name="work" value={w.id} />
        <div className="field">
          <label htmlFor={`f-${w.id}`}>Файл работы</label>
          <input id={`f-${w.id}`} type="file" name="file" required accept=".doc,.docx,.pdf,.odt,.rtf,.txt"
            aria-invalid={err ? true : undefined} aria-describedby={err ? `e-${w.id}` : undefined} />
          {err && <FieldError id={`e-${w.id}`}>{err}</FieldError>}
        </div>
        <UploadProgress />
        <SubmitButton pendingText="Проверяем…"><Icon name="upload" />Загрузить работу</SubmitButton>
      </form>;
    })}
    {works.some((w) => w.originality !== null) ? <div className="rows">{works.filter((w) => w.originality !== null).map((w) =>
      <div key={w.id} className="row plain">
        <span className="t">{w.title}</span>
        <span className="end">{w.status === "accepted" ? <Tag k="ok">Принято</Tag> : <Tag k="bad">Ниже порога</Tag>}</span>
        <span className="s">{w.originality} % оригинальности{w.filename ? `, ${w.filename}` : ""}
          <span className="bar" style={{ ["--bar" as string]: w.status === "accepted" ? "#2E9E5B" : "#E0457B" }} role="img" aria-label={`${w.originality} %, порог ${w.threshold} %`}>
            <b style={{ width: `${w.originality}%` }} /><i style={{ left: `${w.threshold}%` }} /></span></span>
      </div>)}</div> : !waiting.length && <Empty icon="shield-check" text="Работ для проверки пока нет." />}
    <p className="note">Черта - порог 75 %. Работу ниже порога можно доработать и загрузить снова. В концепте файл не сохраняется: хранится только имя файла, а процент считается условно.</p>
  </Page>;
}
