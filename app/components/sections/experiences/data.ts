export type Program = {
  key: "runningClub" | "education";
  href: string;
  img: string;
  /** Keep in sync with `UNLAUNCHED_ROUTES`: the card stops being a link. */
  comingSoon?: true;
};

export const programs: Program[] = [
  {
    key: "runningClub",
    href: "/experiences/running-club",
    img: "/images/menu/running-club-900x600.webp",
    comingSoon: true,
  },
  {
    key: "education",
    href: "/experiences/education-programs",
    img: "/images/menu/education-programs-900x600.webp",
    comingSoon: true,
  },
];

export const valueKeys = ["intention", "connection", "growth"] as const;

export const valueNumbers: Record<(typeof valueKeys)[number], string> = {
  intention: "I",
  connection: "II",
  growth: "III",
};
