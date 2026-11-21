import { requireRole } from "../../../../lib/guard";
import { myNotices } from "../../../../lib/dal/staff";
import { readMyNotices } from "../../../../lib/changes/teacher";
import { CabInbox } from "../../../../components/cabinet-pages";

export const metadata = { title: "Уведомления" };

export default async function Inbox() {
  const { token } = await requireRole("staff");
  const list = await myNotices(token);
  if (list.some((n) => !n.read_at)) await readMyNotices(token);
  return <CabInbox home="/staff" list={list} />;
}
