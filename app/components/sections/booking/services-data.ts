export type BookableService = {
  id: string;
  category: "wellness" | "medicine";
  title: string;
  description: string;
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
    description: "Alternating heat and cold to activate recovery and reduce inflammation.",
    duration: "60 min",
    price: "€45",
    image: "/images/menu/thermal-contrast.webp",
  },
  {
    id: "breathing-sessions",
    category: "wellness",
    title: "Breathing Sessions",
    description: "Guided breathwork to shift from stress to active recovery.",
    duration: "45 min",
    price: "€35",
    image: "/images/menu/breathing-sessions.webp",
  },
  {
    id: "red-light-therapy",
    category: "wellness",
    title: "Red Light Therapy",
    description: "Red and infrared light to stimulate cellular repair and regeneration.",
    duration: "20 min",
    price: "€25",
    image: "/images/menu/red-light-therapy.webp",
  },
  {
    id: "manual-therapies",
    category: "wellness",
    title: "Manual Therapies",
    description: "Precise manual work to release tension and restore mobility.",
    duration: "60 or 90 min",
    price: "€80 / €110",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "functional-well-being",
    category: "wellness",
    title: "Functional Well-being",
    description: "Movement and strength training designed around longevity.",
    duration: "50 min",
    price: "€65",
    image: "/images/menu/functional-wellbeing.webp",
  },
  // Medicine
  {
    id: "hyperbaric-chambers",
    category: "medicine",
    title: "Hyperbaric Oxygen",
    description: "Pressurised oxygen to accelerate tissue repair and reduce inflammation.",
    duration: "60 min",
    price: "€120",
    image: "/images/menu/hyperbaric-chambers.webp",
  },
  {
    id: "intravenous-therapy",
    category: "medicine",
    title: "IV Therapy",
    description: "Direct nutrient delivery for rapid absorption and cellular support.",
    duration: "45 min",
    price: "€95",
    image: "/images/menu/intravenous-therapy.webp",
  },
  {
    id: "regenerative-medicine",
    category: "medicine",
    title: "Regenerative Medicine",
    description: "Protocols that activate your body's own repair mechanisms.",
    duration: "Consultation + protocol",
    price: "From €250",
    image: "/images/menu/regenerative-medicine.webp",
  },
];
