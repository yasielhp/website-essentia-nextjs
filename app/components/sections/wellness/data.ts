export type Treatment = {
  number: string;
  href: string;
  img: string;
  title: string;
  tagline: string;
  description: string;
  comingSoon?: true;
};

export const treatments: Treatment[] = [
  {
    number: "01",
    href: "/wellness/contrast-therapy",
    img: "/images/menu/thermal-contrast-900x600.webp",
    title: "Contrast Therapy",
    tagline: "Heat & Cold",
    description: "Heat and cold to activate recovery and reduce inflammation.",
    comingSoon: true,
  },
  {
    number: "02",
    href: "/wellness/breathing-sessions",
    img: "/images/menu/breathing-sessions-900x600.webp",
    title: "Breathing Sessions",
    tagline: "Breathwork",
    description: "Guided breathwork to shift from stress to active recovery.",
    comingSoon: true,
  },
  {
    number: "03",
    href: "/wellness/red-light-therapy",
    img: "/images/menu/red-light-therapy-900x600.webp",
    title: "Red Light Therapy",
    tagline: "Photobiomodulation",
    description:
      "Red and infrared light to stimulate cellular repair and regeneration.",

    comingSoon: true,
  },
  {
    number: "04",
    href: "/wellness/manual-therapies",
    img: "/images/menu/manual-therapies-900x400.webp",
    title: "Manual Therapies",
    tagline: "Touch & Restoration",
    description: "Precise manual work to release tension and restore mobility.",
  },
  {
    number: "05",
    href: "/wellness/facial-therapies",
    img: "/images/menu/facial-therapies-900x600.webp",
    title: "Therapeutic Facials",
    tagline: "Skin & Radiance",
    description:
      "Advanced facial protocols combining manual techniques and technology to restore skin health.",
  },
];

export const principles = [
  {
    number: "I",
    title: "Full spectrum",
    description:
      "No single modality is enough. Thermal, light, breath, touch, and movement work as one integrated system.",
  },
  {
    number: "II",
    title: "Adaptive",
    description:
      "Each session follows your current state — recovery, activation, or calibration. The protocol adapts to you.",
  },
  {
    number: "III",
    title: "Cumulative",
    description:
      "Restoration compounds over time. Regular practice builds a baseline of resilience that changes how your body responds to stress.",
  },
] as const;
