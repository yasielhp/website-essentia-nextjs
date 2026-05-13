export type BookableService = {
  id: string;
  category: "wellness" | "medicine";
  title: string;
  duration: string;
  price: string;
  image: string;
};

export const bookableServices: BookableService[] = [
  // Wellness
  {
    id: "contrast-therapy",
    category: "wellness",
    title: "Contrast Therapy",
    duration: "60 min",
    price: "€45",
    image: "/images/menu/thermal-contrast.webp",
  },
  {
    id: "breathing-sessions",
    category: "wellness",
    title: "Breathing Sessions",
    duration: "45 min",
    price: "€35",
    image: "/images/menu/breathing-sessions.webp",
  },
  {
    id: "red-light-therapy",
    category: "wellness",
    title: "Red Light Therapy",
    duration: "20 min",
    price: "€25",
    image: "/images/menu/red-light-therapy.webp",
  },
  {
    id: "manual-therapies",
    category: "wellness",
    title: "Manual Therapies",
    duration: "60 or 90 min",
    price: "€80 / €110",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "functional-well-being",
    category: "wellness",
    title: "Functional Well-being",
    duration: "50 min",
    price: "€65",
    image: "/images/menu/functional-wellbeing.webp",
  },
  // Medicine
  {
    id: "hyperbaric-chambers",
    category: "medicine",
    title: "Hyperbaric Oxygen",
    duration: "60 min",
    price: "€120",
    image: "/images/menu/hyperbaric-chambers.webp",
  },
  {
    id: "intravenous-therapy",
    category: "medicine",
    title: "IV Therapy",
    duration: "45 min",
    price: "€95",
    image: "/images/menu/intravenous-therapy.webp",
  },
  {
    id: "regenerative-medicine",
    category: "medicine",
    title: "Regenerative Medicine",
    duration: "Consultation + protocol",
    price: "From €250",
    image: "/images/menu/regenerative-medicine.webp",
  },
];
