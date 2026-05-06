export interface ContributionDay {
  date: string;
  minutes: number;
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildContributionDays(input: ContributionDay[], days = 365) {
  const byDate = new Map(input.map((day) => [day.date, day.minutes]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const date = dateKey(current);
    return { date, minutes: byDate.get(date) || 0 };
  });
}

export function groupContributionWeeks(days: ContributionDay[]) {
  const padded: Array<ContributionDay | null> = [];
  const firstDay = new Date(`${days[0]?.date || dateKey(new Date())}T00:00:00`).getDay();

  for (let i = 0; i < firstDay; i += 1) padded.push(null);
  padded.push(...days);

  const weeks: Array<Array<ContributionDay | null>> = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }
  return weeks;
}

export function contributionLevel(minutes: number) {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 45) return 2;
  if (minutes < 90) return 3;
  return 4;
}

export function contributionMonthLabels(weeks: Array<Array<ContributionDay | null>>) {
  const seen = new Set<string>();
  return weeks.map((week, index) => {
    const firstDay = week.find(Boolean);
    if (!firstDay) return { index, label: "" };
    const date = new Date(`${firstDay.date}T00:00:00`);
    const label = date.toLocaleDateString("en-US", { month: "short" });
    if (seen.has(label) || date.getDate() > 7) return { index, label: "" };
    seen.add(label);
    return { index, label };
  });
}
