export const programs = [
  {
    key: "runningClub",
    href: "/experiences/running-club",
    img: "/images/menu/running-club-900x600.webp",
  },
  {
    key: "education",
    href: "/experiences/education-programs",
    img: "/images/menu/education-programs-900x600.webp",
  },
] as const;

export const valueKeys = ["intention", "connection", "growth"] as const;

export const valueNumbers: Record<(typeof valueKeys)[number], string> = {
  intention: "I",
  connection: "II",
  growth: "III",
};
