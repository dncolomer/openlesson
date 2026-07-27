import { redirect } from "next/navigation";

/** Legacy path — product renamed to Learning Loop. */
export default function PostSessionLearningCheckRedirect() {
  redirect("/sales/learning-loop");
}
