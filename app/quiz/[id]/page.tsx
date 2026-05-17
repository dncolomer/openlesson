import { readdir } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getQuizQuestion, quizQuestions } from "../quiz-data";
import { QuizCard } from "./QuizCard";

export const dynamic = "force-dynamic";

const AESTHETICS_DIR = path.join(process.cwd(), "public", "aesthetics");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return quizQuestions.map((question) => ({ id: String(question.id) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const question = getQuizQuestion(Number(id));

  return {
    title: question ? `Quiz ${question.id}: ${question.topic}` : "Helios Quiz",
    description: question?.question ?? "A quick openLesson quiz.",
  };
}

async function getRandomAestheticImage() {
  try {
    const packages = await readdir(AESTHETICS_DIR, { withFileTypes: true });
    const images = (
      await Promise.all(
        packages
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
          .map(async (entry) => {
            const files = await readdir(path.join(AESTHETICS_DIR, entry.name), { withFileTypes: true });
            return files
              .filter((file) => file.isFile() && IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase()))
              .map((file) => `/aesthetics/${entry.name}/${file.name}`);
          }),
      )
    ).flat();

    return images.length > 0 ? images[Math.floor(Math.random() * images.length)] : null;
  } catch {
    return null;
  }
}

export default async function QuizPage({ params }: PageProps) {
  const { id } = await params;
  const question = getQuizQuestion(Number(id));
  if (!question) notFound();

  const backgroundImage = await getRandomAestheticImage();

  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-neutral-100 sm:p-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center sm:min-h-[calc(100vh-4rem)]">
        <div className="relative min-h-[min(92vh,860px)] w-full max-w-[484px] overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/70 sm:aspect-[9/16] sm:w-auto sm:max-w-none">
          {backgroundImage && (
            <img
              src={backgroundImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-neutral-950/72 backdrop-blur-[3px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(239,68,68,0.16),transparent_24%),linear-gradient(to_bottom,rgba(0,0,0,0.28),rgba(0,0,0,0.08)_36%,rgba(0,0,0,0.55))]" />

          <QuizCard question={question} />
        </div>
      </section>
    </main>
  );
}
