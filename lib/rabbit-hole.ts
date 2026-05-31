export type RabbitHoleNode = {
  id: string;
  question: string;
  depth: number;
  children: RabbitHoleNode[];
};

export type RabbitHoleTopQuestion = {
  id: string;
  question: string;
  discipline: string | null;
  tree: RabbitHoleNode | null;
};

export type RabbitHolePlayStatus = {
  timezone: string;
  isAdmin: boolean;
  freePlayUsedToday: boolean;
  bonusPlays: number;
  freePlaysAvailable: number;
  playsAvailable: number;
  points: number;
  globalRank: number | null;
};

export function getUserTimezone(input?: string | null) {
  const timezone = input || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

export function localDayKey(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function scoreRabbitHole(depth: number, explored: number, correct: boolean) {
  const base = depth * 7 + explored * 3;
  return correct ? base + 25 : Math.max(0, base - 12);
}
