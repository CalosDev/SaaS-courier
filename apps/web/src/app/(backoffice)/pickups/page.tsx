import { redirect } from "next/navigation";

export default function LegacyPickupsPage() {
  redirect("/pickup-requests");
}
