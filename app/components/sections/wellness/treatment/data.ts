import type { Benefit, SessionDetail } from "@/types";

export type TreatmentData = {
  slug: string;
  heroImage: string;
  heroAlt: string;
  title: string;
  tagline: string;
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

export const treatments: Record<string, TreatmentData> = {
  "contrast-therapy": {
    slug: "contrast-therapy",
    heroImage: "/images/menu/thermal-contrast-900x600.webp",
    heroAlt: "Contrast therapy — sauna and cold plunge at Essentia",
    title: "Contrast Therapy",
    tagline: "Heat & Cold",
    price: "€45",
    duration: "60 min",
    intro:
      "Alternating heat and cold is one of the most studied recovery modalities in sports science. At Essentia, we have designed a structured protocol that maximises the cardiovascular, hormonal, and anti-inflammatory response of each transition.",
    benefitsHeading: "What it does",
    benefitsSubtitle:
      "The science behind thermal contrast is well established. These are the mechanisms that matter most.",
    benefits: [
      {
        title: "Reduces inflammation",
        description:
          "Cold immersion constricts blood vessels and clears metabolic waste. Repeated transitions accelerate the clearance of inflammatory markers after training or injury.",
      },
      {
        title: "Stimulates heat shock proteins",
        description:
          "Sustained sauna exposure triggers HSP production — molecular chaperones that repair damaged proteins and protect cells against future stress.",
      },
      {
        title: "Improves cardiovascular resilience",
        description:
          "The rapid vasoconstriction and vasodilation cycle trains the autonomic nervous system and improves heart rate variability over time.",
      },
      {
        title: "Enhances sleep quality",
        description:
          "The drop in core temperature after cold exposure signals the brain to enter deeper sleep phases, shortening sleep onset and increasing slow-wave duration.",
      },
    ],
    sessionHeading: "What a session looks like",
    sessionSubtitle:
      "Sessions are guided. You will never be left to figure it out alone.",
    sessionDetails: [
      {
        number: "I",
        title: "Duration",
        description:
          "60 minutes. Three alternating rounds: 12–15 minutes in the sauna followed by 2–3 minutes in the cold plunge. Short rest between rounds.",
      },
      {
        number: "II",
        title: "Format",
        description:
          "Solo or shared. Our therapist sets the protocol based on your goal: recovery, activation, or adaptation. First session includes a brief assessment.",
      },
      {
        number: "III",
        title: "Frequency",
        description:
          "Two to three sessions per week is optimal for most members. We track your response and adjust the protocol as your baseline improves.",
      },
    ],
    ctaHeading: "Start your first session",
    ctaBody:
      "Contrast Therapy is included in all Essentia memberships. Book your first session or join the community to get started.",
  },

  "breathing-sessions": {
    slug: "breathing-sessions",
    heroImage: "/images/menu/breathing-sessions-900x600.webp",
    heroAlt: "Breathwork session at Essentia Tenerife",
    title: "Breathing Sessions",
    tagline: "Breathwork",
    price: "€35",
    duration: "45 min",
    intro:
      "Controlled respiration is the fastest lever we have over the autonomic nervous system. Our guided breathwork sessions are built on the evidence: Wim Hof, coherence breathing, box breathing, and CO2 tolerance work — applied to your current state.",
    benefitsHeading: "What it does",
    benefitsSubtitle:
      "Breath is the only autonomic function you can consciously control. That makes it uniquely powerful.",
    benefits: [
      {
        title: "Reduces cortisol",
        description:
          "Slow, rhythmic breathing activates the vagus nerve and shifts the nervous system from sympathetic dominance into parasympathetic recovery — measurably lowering cortisol within minutes.",
      },
      {
        title: "Improves heart rate variability",
        description:
          "Coherence breathing at five breaths per minute synchronises heart rate, blood pressure, and baroreflex sensitivity, improving HRV — a key marker of recovery capacity.",
      },
      {
        title: "Enhances CO2 tolerance",
        description:
          "Most people over-breathe. Training your tolerance to CO2 improves oxygen delivery to tissues (the Bohr effect) and reduces anxiety responses triggered by hypocapnia.",
      },
      {
        title: "Sharpens focus and resilience",
        description:
          "Cyclic hyperventilation followed by breath retention activates the sympathetic system in a controlled way, building mental resilience and cognitive clarity under stress.",
      },
    ],
    sessionHeading: "What a session looks like",
    sessionSubtitle:
      "Every session is guided by a trained instructor. No prior experience required.",
    sessionDetails: [
      {
        number: "I",
        title: "Duration",
        description:
          "45 minutes. Opening check-in, a 30-minute guided protocol, and a 10-minute integration rest. You may feel light-headed during the session — that is normal and expected.",
      },
      {
        number: "II",
        title: "Format",
        description:
          "Group sessions run twice a week. Private 1:1 sessions are available for members who prefer a personalised protocol or have specific performance or therapeutic goals.",
      },
      {
        number: "III",
        title: "Frequency",
        description:
          "One to two sessions per week produces consistent results. Many members combine breathwork with contrast therapy on the same day for a more complete recovery protocol.",
      },
    ],
    ctaHeading: "Breathe differently",
    ctaBody:
      "Breathing Sessions are included in all Essentia memberships. Book your first session or join the community to get started.",
  },

  "red-light-therapy": {
    slug: "red-light-therapy",
    heroImage: "/images/menu/red-light-therapy-900x600.webp",
    heroAlt: "Red light therapy panel at Essentia",
    title: "Red Light Therapy",
    tagline: "Photobiomodulation",
    price: "€25",
    duration: "20 min",
    intro:
      "Photobiomodulation uses specific wavelengths of red and near-infrared light to penetrate skin and tissue, stimulating the mitochondria at a cellular level. At Essentia we use medical-grade full-body panels calibrated to the wavelengths with the strongest clinical evidence.",
    benefitsHeading: "What it does",
    benefitsSubtitle:
      "Light therapy works at the cellular level. The effects accumulate with consistent use.",
    benefits: [
      {
        title: "Stimulates mitochondrial function",
        description:
          "Near-infrared light (810–850 nm) is absorbed by cytochrome c oxidase in the mitochondrial membrane, increasing ATP production and cellular energy availability.",
      },
      {
        title: "Accelerates tissue repair",
        description:
          "Red light (630–670 nm) promotes fibroblast proliferation and collagen synthesis, speeding recovery from muscle damage, tendon injuries, and skin conditions.",
      },
      {
        title: "Reduces systemic inflammation",
        description:
          "Photobiomodulation consistently reduces markers of oxidative stress and pro-inflammatory cytokines in controlled studies across a wide range of conditions.",
      },
      {
        title: "Supports thyroid and hormonal health",
        description:
          "Emerging research shows near-infrared light applied to the thyroid gland can improve function in subclinical hypothyroidism and reduce dependence on medication.",
      },
    ],
    sessionHeading: "What a session looks like",
    sessionSubtitle:
      "Simple, passive, and highly effective. No preparation required.",
    sessionDetails: [
      {
        number: "I",
        title: "Duration",
        description:
          "10–20 minutes per session. You stand or sit in front of the full-body panel at the prescribed distance. Eyes should be protected with the provided goggles.",
      },
      {
        number: "II",
        title: "Format",
        description:
          "Solo sessions in a private booth. Skin should be clean and free of sunscreen or thick moisturisers to allow maximum light penetration. Clothing is removed for target areas.",
      },
      {
        number: "III",
        title: "Frequency",
        description:
          "Three to five sessions per week delivers the best cumulative effect. Many members integrate a 15-minute red light session before or after contrast therapy.",
      },
    ],
    ctaHeading: "Charge your cells",
    ctaBody:
      "Red Light Therapy is included in all Essentia memberships. Book your first session or join the community to get started.",
  },

  "manual-therapies": {
    slug: "manual-therapies",
    heroImage: "/images/wellness/heroes/manual-therapies-1920x1080.webp",
    heroAlt: "Manual therapy session at Essentia",
    title: "Manual Therapies",
    tagline: "Touch & Restoration",
    price: "€80 / €110",
    duration: "60 or 90 min",
    intro:
      "Our manual therapists work with the whole body: fascia, muscle, joint, and nervous system. Every session is an assessment as much as a treatment — finding what is restricted, what is compensating, and what needs to be released before it becomes a problem.",
    benefitsHeading: "What each treatment is for",
    benefitsSubtitle:
      "Every therapy has its own purpose, but they share one intention: to listen to the body, ease what weighs on it and give it back its balance",
    benefits: [
      {
        title: "Releases tension and overload",
        description:
          "We work on stiffness, knots and muscular fatigue to help the body let go of built-up tension and find relief.",
      },
      {
        title: "Supports the body's recovery",
        description:
          "With manual techniques adapted to you, we support the body through tiredness, physical effort, post-training, pregnancy or too much sun.",
      },
      {
        title: "Calms the nervous system",
        description:
          "Enveloping movements, breathing, oils and a conscious rhythm to create deep rest, presence and a real disconnection.",
      },
      {
        title: "Brings back lightness and balance",
        description:
          "Each treatment works to restore a sense of fluidity, mobility and wellbeing, adapting to what the body needs that day.",
      },
    ],
    sessionHeading: "What an Essentia session is like",
    sessionSubtitle:
      "Every session is built around you. We listen to the body, adapt the treatment and stay with the process before, during and after.",
    sessionDetails: [
      {
        number: "I",
        title: "Listen",
        description:
          "Every body arrives with its own story. We look at tension, inflammation, sensitivity, rest and what you specifically need before we start.",
      },
      {
        number: "II",
        title: "Treat",
        description:
          "We apply manual techniques suited to where the body actually is that day, minding the pressure, the rhythm, the breathing and every detail of the experience.",
      },
      {
        number: "III",
        title: "Follow through",
        description:
          "The treatment does not end on the table. We leave you simple guidance to hold on to the lightness, the rest and the balance after the session.",
      },
    ],
    ctaHeading: "Release what is holding you back",
    ctaBody:
      "Manual Therapies are available to all Essentia members. Book your first session or join the community to get started.",
  },

  "facial-therapies": {
    slug: "facial-therapies",
    heroImage: "/images/wellness/heroes/facial-therapies-1920x1080.webp",
    heroAlt: "Facial therapy session at Essentia",
    title: "Therapeutic Facials",
    tagline: "Skin & Radiance",
    price: "€75",
    duration: "60 min",
    intro:
      "Every face has a story. Our facials combine manual technique, professional cosmetics and a personalised eye, to bring back radiance, firmness and natural harmony.",
    benefitsHeading: "What it does",
    benefitsSubtitle:
      "Every facial ritual is built to look after the skin and the face from a deeper standpoint: we are not adding beauty, we are revealing what is already there",
    benefits: [
      {
        title: "Restores radiance",
        description:
          "We work the skin with professional cosmetics, exfoliation and manual technique to bring back freshness, nourishment and a more rested look.",
      },
      {
        title: "Improves firmness",
        description:
          "Through specific manoeuvres and selected actives, we support the facial structure and help redefine the contour.",
      },
      {
        title: "Releases facial tension",
        description:
          "The face carries its load too. We work the muscle, the fascia and the expression to soften tension and bring back harmony.",
      },
      {
        title: "Supports how you age",
        description:
          "Our protocols look after the skin and the facial structure from a natural, gradual and non-invasive standpoint.",
      },
    ],
    sessionHeading: "What a session looks like",
    sessionSubtitle:
      "Every session begins by looking at the face. Nothing is applied before we understand what the skin needs.",
    sessionDetails: [
      {
        number: "I",
        title: "Assessment",
        description:
          "We look at the state of the skin, the expression, the facial tension and the goal of the treatment, and choose the protocol from there.",
      },
      {
        number: "II",
        title: "Treatment",
        description:
          "We combine manual technique, professional cosmetics and specific manoeuvres to work on radiance, firmness, structure and facial rest.",
      },
      {
        number: "III",
        title: "Follow-up",
        description:
          "For treatments such as Kinesiolifting, we set out a personalised plan based on how the face evolves and what each person needs.",
      },
    ],
    ctaHeading: "Restore your skin",
    ctaBody:
      "Therapeutic facials are available to all Essentia members. Book your first session or join the community to get started.",
  },
};
