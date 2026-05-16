import type { Benefit, SessionDetail } from "@/types";

export type MedicineTreatmentData = {
  slug: string;
  heroImage: string;
  heroAlt: string;
  title: string;
  price: string;
  duration: string;
  intro: string;
  benefitsHeading: string;
  benefitsSubtitle: string;
  benefits: Benefit[];
  sessionHeading: string;
  sessionSubtitle: string;
  sessionDetails: SessionDetail[];
  ctaHeading: string;
  ctaBody: string;
};

export const treatments: Record<string, MedicineTreatmentData> = {
  "hyperbaric-chambers": {
    slug: "hyperbaric-chambers",
    heroImage: "/images/menu/hyperbaric-chambers.webp",
    heroAlt: "Hyperbaric oxygen chamber at Essentia",
    title: "Hyperbaric Oxygen.",
    price: "€120",
    duration: "60 min",
    intro:
      "Hyperbaric oxygen therapy (HBOT) delivers 100% oxygen at pressures above atmospheric, allowing blood plasma to carry significantly more oxygen to tissues. At Essentia, our protocols are supervised by our medical team and tailored to your health goals.",
    benefitsHeading: "What it does.",
    benefitsSubtitle:
      "The clinical evidence for HBOT spans decades and multiple disciplines. These are the mechanisms with the strongest support.",
    benefits: [
      {
        title: "Accelerates tissue repair",
        description:
          "Elevated oxygen availability stimulates angiogenesis — the formation of new blood vessels — and dramatically accelerates healing in hypoxic or damaged tissue.",
      },
      {
        title: "Reduces systemic inflammation",
        description:
          "HBOT consistently suppresses pro-inflammatory cytokines and oxidative stress markers, with effects that persist well beyond the session itself.",
      },
      {
        title: "Enhances neuroplasticity",
        description:
          "Emerging research shows repeated HBOT sessions increase BDNF and promote neurogenesis, with clinical applications in post-concussion recovery and cognitive performance.",
      },
      {
        title: "Supports immune function",
        description:
          "Pressurised oxygen enhances the bactericidal capacity of white blood cells and promotes the clearance of chronic infections that thrive in low-oxygen environments.",
      },
    ],
    sessionHeading: "What a session looks like.",
    sessionSubtitle:
      "Every HBOT session is medically supervised. Safety and precision are non-negotiable.",
    sessionDetails: [
      {
        number: "I",
        title: "Duration",
        description:
          "60 minutes inside the chamber at 1.5–2.0 ATA, preceded by a 10-minute pressurisation phase and followed by gradual depressurisation. Total time: approximately 80 minutes.",
      },
      {
        number: "II",
        title: "Format",
        description:
          "Single-person chambers for privacy and comfort. You can read, rest, or use a tablet during the session. Loose, natural-fibre clothing is required. No electronics inside.",
      },
      {
        number: "III",
        title: "Protocol",
        description:
          "Our medical team prescribes a course of sessions based on your goals and baseline. Most therapeutic protocols run 10–40 sessions. Maintenance is one session per week.",
      },
    ],
    ctaHeading: "Accelerate your recovery.",
    ctaBody:
      "Hyperbaric Oxygen Therapy is available to Essentia members. Book a consultation with our medical team or reserve your first session directly.",
  },

  "intravenous-therapy": {
    slug: "intravenous-therapy",
    heroImage: "/images/menu/intravenous-therapy.webp",
    heroAlt: "IV therapy at Essentia Tenerife",
    title: "IV Therapy.",
    price: "€95",
    duration: "45 min",
    intro:
      "Intravenous nutrient therapy bypasses the digestive system entirely, delivering vitamins, minerals, and amino acids directly into the bloodstream at concentrations impossible to achieve orally. At Essentia, every IV formulation is prescribed by our medical team after reviewing your bloodwork.",
    benefitsHeading: "What it does.",
    benefitsSubtitle:
      "IV therapy is not a wellness trend. It is a medical intervention with specific indications and measurable outcomes.",
    benefits: [
      {
        title: "100% bioavailability",
        description:
          "Oral supplements are absorbed at 10–50% depending on gut health, food intake, and individual variation. IV delivery achieves 100% absorption regardless of digestive status.",
      },
      {
        title: "Rapid cellular repletion",
        description:
          "Deficiencies in magnesium, B vitamins, vitamin C, and zinc are common and have broad systemic effects. IV repletion restores optimal levels within a single session.",
      },
      {
        title: "Supports glutathione production",
        description:
          "High-dose vitamin C and glutathione precursors via IV significantly boost the body's primary antioxidant system, reducing oxidative damage and supporting immune and liver function.",
      },
      {
        title: "Improves energy and recovery",
        description:
          "NAD+ IV protocols directly replenish intracellular NAD levels — a critical coenzyme for mitochondrial function that declines sharply with age — restoring cellular energy production.",
      },
    ],
    sessionHeading: "What a session looks like.",
    sessionSubtitle:
      "Every session starts with a review. We do not administer anything without understanding your baseline.",
    sessionDetails: [
      {
        number: "I",
        title: "Duration",
        description:
          "45–90 minutes depending on the formulation. NAD+ protocols take longer due to the slower infusion rate required. You will be seated comfortably throughout.",
      },
      {
        number: "II",
        title: "Format",
        description:
          "Private treatment room. A nurse or medical professional places the IV cannula and monitors throughout. Most members read, listen to music, or rest during the infusion.",
      },
      {
        number: "III",
        title: "Protocol",
        description:
          "First session includes bloodwork review and a brief consultation to select the right formulation. Common protocols: Myers' Cocktail, high-dose vitamin C, NAD+, or custom blends.",
      },
    ],
    ctaHeading: "Replenish at the source.",
    ctaBody:
      "IV Therapy is available to all Essentia members. Book a consultation with our medical team or reserve your first session directly.",
  },

  "regenerative-medicine": {
    slug: "regenerative-medicine",
    heroImage: "/images/menu/regenerative-medicine.webp",
    heroAlt: "Regenerative medicine consultation at Essentia",
    title: "Regenerative Medicine.",
    price: "From €250",
    duration: "Consultation + protocol",
    intro:
      "Regenerative medicine activates the body's own repair mechanisms using biological signals — peptides, growth factors, and advanced protocols that target the cellular processes underlying ageing and injury. At Essentia, these treatments are prescribed and supervised by our medical director.",
    benefitsHeading: "What it does.",
    benefitsSubtitle:
      "This is the frontier of longevity medicine. The evidence is growing rapidly.",
    benefits: [
      {
        title: "Peptide therapy",
        description:
          "Targeted peptides such as BPC-157, TB-500, and GHK-Cu modulate inflammation, accelerate tissue repair, and support gut integrity through receptor-specific signalling pathways.",
      },
      {
        title: "Hormone optimisation",
        description:
          "Age-related hormonal decline is not inevitable. Our medical team assesses your full hormonal panel and prescribes evidence-based optimisation protocols under continuous monitoring.",
      },
      {
        title: "Senolytics and longevity protocols",
        description:
          "Senescent cell accumulation is a primary driver of biological ageing. Targeted senolytic protocols — dasatinib, quercetin, fisetin — are prescribed based on your biomarker profile.",
      },
      {
        title: "PRP and growth factor therapies",
        description:
          "Platelet-rich plasma derived from your own blood is used to accelerate repair in joints, tendons, and skin — concentrating the growth factors your body already produces.",
      },
    ],
    sessionHeading: "What a protocol looks like.",
    sessionSubtitle:
      "Regenerative medicine is not a single session. It is a structured, monitored programme.",
    sessionDetails: [
      {
        number: "I",
        title: "Consultation",
        description:
          "A 60-minute consultation with our Medical Director. We review your bloodwork, health history, and goals before prescribing anything. Comprehensive bloodwork panel is included.",
      },
      {
        number: "II",
        title: "Protocol design",
        description:
          "A personalised protocol is designed around your specific biomarkers and objectives. Protocols typically run 3–6 months with regular check-ins and bloodwork reassessment.",
      },
      {
        number: "III",
        title: "Ongoing monitoring",
        description:
          "We track your response to every intervention with objective markers. Protocols are adjusted based on results. Nothing is continued without evidence that it is working for you.",
      },
    ],
    ctaHeading: "Invest in your biology.",
    ctaBody:
      "Regenerative Medicine protocols are available to Essentia members. Begin with a consultation with our Medical Director.",
  },
};
