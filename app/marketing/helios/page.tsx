import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

const AESTHETICS_DIR = path.join(process.cwd(), "public", "aesthetics");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function MarketingHeliosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const question = firstValue(params.question)?.trim() || firstValue(params.q)?.trim() || "Write down 5-7 foods or meals you enjoy most and note one reason for each.";
  const chapter = firstValue(params.chapter)?.trim() || "2";
  const chapterLabel = /^chapter\b/i.test(chapter) ? chapter : `Chapter ${chapter}`;
  const backgroundImage = await getRandomAestheticImage();

  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-neutral-100 sm:p-8">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] items-center justify-center sm:min-h-[calc(100vh-4rem)]">
        <div className="relative aspect-[9/16] h-[min(92vh,860px)] max-h-[860px] w-auto overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/70">
          {backgroundImage && (
            <img
              src={backgroundImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-[3px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(239,68,68,0.14),transparent_24%),linear-gradient(to_bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.05)_38%,rgba(0,0,0,0.5))]" />

          <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 text-center">
            <p className="mb-5 font-mono text-[13px] font-semibold uppercase tracking-[0.32em] text-rose-50/90">
              {chapterLabel}
            </p>

            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous chapter"
                className="flex size-10 items-center justify-center rounded-full border border-rose-400/70 bg-rose-500/10 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="relative flex size-32 items-center justify-center rounded-full border border-rose-500/85 bg-neutral-950/20 shadow-[0_0_0_4px_rgba(225,29,72,0.18),0_0_44px_rgba(225,29,72,0.2)]">
                <div className="absolute inset-1 rounded-full border border-rose-500/55" />
                <span className="font-serif text-4xl text-neutral-100">H</span>
              </div>

              <button
                type="button"
                aria-label="Next chapter"
                className="flex size-10 items-center justify-center rounded-full border border-rose-400/70 bg-rose-500/10 text-rose-200 shadow-[0_0_24px_rgba(244,63,94,0.22)]"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="mb-3 text-sm font-medium text-neutral-100">Helios</div>
            <div className="mb-10 h-1 w-8 rounded-full bg-rose-400" />

            <div className="relative max-w-[30ch]">
              <span className="absolute -left-7 -top-5 font-serif text-5xl leading-none text-white/15" aria-hidden="true">“</span>
              <h1 className="text-balance text-2xl font-normal leading-[1.42] tracking-[-0.04em] text-neutral-100">
                {question}
              </h1>
            </div>

            <div className="mt-8 flex items-center gap-2 text-[11px] font-medium text-neutral-400">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 5 6 9H2v6h4l5 4V5Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
              </svg>
              <span>Listen to tutor</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
