export type Principle = {
  number: string;
  title: string;
  description: string;
};

export type TeamMember = {
  name: string;
  role: string;
  area: string;
  initials: string;
};

export const principles: Principle[] = [
  {
    number: "I",
    title: "Evidence first",
    description:
      "Every protocol we offer is grounded in peer-reviewed science. If the evidence is not there, neither are we.",
  },
  {
    number: "II",
    title: "Whole-person care",
    description:
      "Longevity is not a supplement stack. It is sleep, movement, nutrition, community, and purpose. We treat all of it.",
  },
  {
    number: "III",
    title: "Honest medicine",
    description:
      "We tell you what we know, what we do not know, and what the data says. No hype, no shortcuts.",
  },
];

export const team: TeamMember[] = [
  {
    name: "Dr. Carlos Mendez",
    role: "Medical Director",
    area: "Longevity & Regenerative Medicine",
    initials: "CM",
  },
  {
    name: "Ana Torres",
    role: "Head of Wellness",
    area: "Manual Therapies & Breathwork",
    initials: "AT",
  },
  {
    name: "Liam Fischer",
    role: "Community Director",
    area: "Movement & Running Club",
    initials: "LF",
  },
  {
    name: "Dr. Sofia Alarcon",
    role: "Head of Nutrition",
    area: "Metabolic & Nutritional Health",
    initials: "SA",
  },
];
