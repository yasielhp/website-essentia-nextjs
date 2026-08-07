export type MedicineTreatment = {
  href: string;
  img: string;
  title: string;
  description: string;
  comingSoon?: true;
};

export const treatments: MedicineTreatment[] = [
  // TODO: re-enable when hyperbaric chambers go live
  // {
  //   href: "/medicine/hyperbaric-chambers",
  //   img: "/images/menu/hyperbaric-chambers.webp",
  //   title: "Hyperbaric Oxygen",
  //   description:
  //     "Pressurised oxygen to accelerate tissue repair and reduce inflammation.",
  //   comingSoon: true,
  // },
  {
    href: "/medicine/intravenous-therapy",
    img: "/images/menu/intravenous-therapy.webp",
    title: "IV Therapy",
    description:
      "Direct nutrient delivery for rapid absorption and cellular support.",
    comingSoon: true,
  },
  // TODO: re-enable when regenerative medicine goes live
  // {
  //   href: "/medicine/regenerative-medicine",
  //   img: "/images/menu/regenerative-medicine.webp",
  //   title: "Regenerative Medicine",
  //   description: "Protocols that activate your body's own repair mechanisms.",
  //   comingSoon: true,
  // },
];

export const principles = [
  {
    number: "I",
    title: "Science-backed",
    description:
      "Every protocol is rooted in peer-reviewed longevity research and clinical evidence.",
  },
  {
    number: "II",
    title: "Prevention-first",
    description:
      "We focus on what can be addressed before symptoms appear, not just what already has.",
  },
  {
    number: "III",
    title: "Precision",
    description:
      "Protocols are calibrated to your biomarkers and biology, not generic baselines.",
  },
] as const;
