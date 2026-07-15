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
    description: question?.question ?? "A quick Uncertain Systems quiz.",
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
        <QuizCard question={question} backgroundImage={backgroundImage} />
      </section>
    </main>
  );
}
