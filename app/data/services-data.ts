export type BookableService = {
  id: string;
  category: "wellness" | "medicine";
  title: string;
  description: string;
  durations: string[];
  price: string;
  priceCenter?: string;
  priceSuite?: string;
  image: string;
};

export const bookableServices: BookableService[] = [
  {
    id: "espira",
    category: "wellness",
    title: "Espira",
    description:
      "Ritual breve que libera tensiones en espalda, cuello y hombros. Técnicas envolventes, presión consciente y aceites esenciales.",
    durations: ["30 min"],
    price: "90 €",
    priceCenter: "90 €",
    priceSuite: "120 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "pulse",
    category: "wellness",
    title: "Pulse",
    description:
      "Masaje descontracturante de presión profunda para zonas de dolor, rigidez y sobrecarga muscular.",
    durations: ["45 min"],
    price: "100 €",
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "drenaje-linfatico",
    category: "wellness",
    title: "Drenaje Linfático Brasileño",
    description:
      "Masaje estético y terapéutico para moldear la silueta, reducir retención de líquidos y mejorar la piel de naranja.",
    durations: ["50 min"],
    price: "100 €",
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "essentia-active",
    category: "wellness",
    title: "Essentia Active",
    description:
      "Masaje para piernas y músculos fatigados. Ideal para deportistas y personas activas: reduce fatiga, previene lesiones.",
    durations: ["45 min"],
    price: "110 €",
    priceCenter: "110 €",
    priceSuite: "140 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "nurtura",
    category: "wellness",
    title: "Nurtura",
    description:
      "Masaje diseñado para futuras mamás. Técnicas suaves y seguras que alivian tensión muscular e hinchazón durante el embarazo.",
    durations: ["50 min"],
    price: "130 €",
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "serenna",
    category: "wellness",
    title: "Serenna",
    description:
      "Experiencia de relajación profunda con maniobras suaves y continuas. Estimula la circulación y revitaliza la energía desde el interior.",
    durations: ["50 min"],
    price: "130 €",
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "solea",
    category: "wellness",
    title: "Soléa",
    description:
      "Para pieles expuestas al sol. Envoltura de aloe vera antiinflamatoria más masaje relajante de cuerpo completo.",
    durations: ["70 min"],
    price: "150 €",
    priceCenter: "150 €",
    priceSuite: "180 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "soma",
    category: "wellness",
    title: "Soma",
    description:
      "Masaje de tejido profundo para contracturas, rigidez y dolores persistentes. Mejora movilidad y elasticidad muscular.",
    durations: ["60 min"],
    price: "160 €",
    priceCenter: "160 €",
    priceSuite: "190 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "lume",
    category: "wellness",
    title: "Lume",
    description:
      "Experiencia multisensorial: masaje cráneo-facial, reflexología y aromaterapia para una desconexión total.",
    durations: ["80 min"],
    price: "220 €",
    priceCenter: "220 €",
    priceSuite: "250 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "alure-duo",
    category: "wellness",
    title: "Alure Duo",
    description:
      "Ritual sensorial para dos personas: reconexión a través del tacto, la respiración y el cuidado mutuo.",
    durations: ["50 min"],
    price: "270 €",
    priceCenter: "270 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "essentia-signature",
    category: "wellness",
    title: "Essentia",
    description:
      "Experiencia completa: peeling corporal, envoltura ultra hidratante, facial rejuvenecedor con masaje craneofacial y masaje de cuerpo completo.",
    durations: ["120 min"],
    price: "350 €",
    priceCenter: "350 €",
    image: "/images/menu/manual-therapies.webp",
  },
];
