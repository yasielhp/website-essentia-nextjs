export const programs = [
  {
    key: "runningClub",
    href: "/community/running-club",
    img: "/images/menu/running-club.webp",
  },
  {
    key: "education",
    href: "/community/education-programs",
    img: "/images/menu/education-programs.webp",
  },
] as const;

export const valueKeys = ["intention", "connection", "growth"] as const;

export const valueNumbers: Record<(typeof valueKeys)[number], string> = {
  intention: "I",
  connection: "II",
  growth: "III",
};
