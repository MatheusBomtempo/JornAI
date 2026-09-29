import { redirect } from "next/navigation";

export default function Home() {
  // The middleware takes care of sending to /login when there is no session.
  redirect("/dashboard");
}
