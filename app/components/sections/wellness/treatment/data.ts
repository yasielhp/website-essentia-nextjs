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
    heroImage: "/images/menu/thermal-contrast.webp",
    heroAlt: "Contrast therapy — sauna and cold plunge at Essentia",
    title: "Contrast Therapy.",
    tagline: "Heat & Cold",
    price: "€45",
    duration: "60 min",
    intro:
      "Alternating heat and cold is one of the most studied recovery modalities in sports science. At Essentia, we have designed a structured protocol that maximises the cardiovascular, hormonal, and anti-inflammatory response of each transition.",
    benefitsHeading: "What it does.",
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
    sessionHeading: "What a session looks like.",
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
    ctaHeading: "Start your first session.",
    ctaBody:
      "Contrast Therapy is included in all Essentia memberships. Book your first session or join the community to get started.",
  },

  "breathing-sessions": {
    slug: "breathing-sessions",
    heroImage: "/images/menu/breathing-sessions.webp",
    heroAlt: "Breathwork session at Essentia Tenerife",
    title: "Breathing Sessions.",
    tagline: "Breathwork",
    price: "€35",
    duration: "45 min",
    intro:
      "Controlled respiration is the fastest lever we have over the autonomic nervous system. Our guided breathwork sessions are built on the evidence: Wim Hof, coherence breathing, box breathing, and CO2 tolerance work — applied to your current state.",
    benefitsHeading: "What it does.",
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
    sessionHeading: "What a session looks like.",
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
    ctaHeading: "Breathe differently.",
    ctaBody:
      "Breathing Sessions are included in all Essentia memberships. Book your first session or join the community to get started.",
  },

  "red-light-therapy": {
    slug: "red-light-therapy",
    heroImage: "/images/menu/red-light-therapy.webp",
    heroAlt: "Red light therapy panel at Essentia",
    title: "Red Light Therapy.",
    tagline: "Photobiomodulation",
    price: "€25",
    duration: "20 min",
    intro:
      "Photobiomodulation uses specific wavelengths of red and near-infrared light to penetrate skin and tissue, stimulating the mitochondria at a cellular level. At Essentia we use medical-grade full-body panels calibrated to the wavelengths with the strongest clinical evidence.",
    benefitsHeading: "What it does.",
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
    sessionHeading: "What a session looks like.",
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
    ctaHeading: "Charge your cells.",
    ctaBody:
      "Red Light Therapy is included in all Essentia memberships. Book your first session or join the community to get started.",
  },

  "manual-therapies": {
    slug: "manual-therapies",
    heroImage: "/images/menu/manual-therapies.webp",
    heroAlt: "Manual therapy session at Essentia",
    title: "Manual Therapies.",
    tagline: "Touch & Restoration",
    price: "€80 / €110",
    duration: "60 or 90 min",
    intro:
      "Our manual therapists work with the whole body: fascia, muscle, joint, and nervous system. Every session is an assessment as much as a treatment — finding what is restricted, what is compensating, and what needs to be released before it becomes a problem.",
    benefitsHeading: "What it does.",
    benefitsSubtitle:
      "Skilled hands accomplish what no machine can replicate. These are the outcomes we target.",
    benefits: [
      {
        title: "Releases fascial restrictions",
        description:
          "Fascial adhesions from training, injury, or prolonged sitting limit range of motion and force the body into compensatory patterns. Manual release restores optimal tissue glide.",
      },
      {
        title: "Reduces chronic tension and pain",
        description:
          "Targeted pressure on trigger points deactivates pain referral patterns and restores normal muscle tone in ways that foam rolling or self-massage cannot replicate.",
      },
      {
        title: "Improves joint mobility",
        description:
          "Articular mobilisation techniques restore the accessory movements within joints that are lost after injury or immobilisation, reducing pain and improving function.",
      },
      {
        title: "Enhances recovery between sessions",
        description:
          "Regular manual work reduces the accumulation of mechanical stress, keeping tissue quality high and reducing the risk of overuse injuries during high-training periods.",
      },
    ],
    sessionHeading: "What a session looks like.",
    sessionSubtitle:
      "Every session begins with a brief assessment. Nothing is done without a reason.",
    sessionDetails: [
      {
        number: "I",
        title: "Duration",
        description:
          "60 or 90 minutes. We recommend 90-minute sessions for the first appointment to allow time for a full postural and movement assessment before treatment begins.",
      },
      {
        number: "II",
        title: "Format",
        description:
          "1:1 with a certified therapist. Modalities include deep tissue massage, myofascial release, joint mobilisation, and dry needling depending on presentation and preference.",
      },
      {
        number: "III",
        title: "Frequency",
        description:
          "Acute issues typically resolve in three to five sessions. Maintenance for active members is one session every two to four weeks to sustain tissue quality and prevent recurrence.",
      },
    ],
    ctaHeading: "Release what is holding you back.",
    ctaBody:
      "Manual Therapies are available to all Essentia members. Book your first session or join the community to get started.",
  },

  "facial-therapies": {
    slug: "facial-therapies",
    heroImage: "/images/menu/functional-wellbeing.webp",
    heroAlt: "Facial therapy session at Essentia",
    title: "Facial Therapies.",
    tagline: "Skin & Radiance",
    price: "€75",
    duration: "60 min",
    intro:
      "Healthy skin is the result of precision, not chance. Our facial therapists combine evidence-backed manual techniques with advanced technology to address your skin's real needs — restoring barrier function, stimulating cellular renewal, and delivering visible, lasting results.",
    benefitsHeading: "What it does.",
    benefitsSubtitle:
      "Every facial protocol is designed around your skin — not a generic routine.",
    benefits: [
      {
        title: "Restores skin barrier function",
        description:
          "Targeted protocols repair the stratum corneum, improve hydration retention, and rebuild the skin's natural defence against environmental stressors.",
      },
      {
        title: "Stimulates cellular renewal",
        description:
          "Manual drainage and technology-assisted treatments increase fibroblast activity, promoting collagen synthesis and accelerating the turnover of damaged surface cells.",
      },
      {
        title: "Reduces inflammation and redness",
        description:
          "Calming techniques combined with anti-inflammatory actives address chronic redness, sensitisation, and post-sun damage without disrupting the skin microbiome.",
      },
      {
        title: "Delivers immediate and lasting radiance",
        description:
          "Skin emerges visibly brighter, firmer, and more even after the first session. With regular practice, results compound — improving tone, texture, and overall skin health over time.",
      },
    ],
    sessionHeading: "What a session looks like.",
    sessionSubtitle:
      "Every session begins with a skin assessment. Nothing is applied without a reason.",
    sessionDetails: [
      {
        number: "I",
        title: "Duration",
        description:
          "60 minutes. A thorough skin analysis opens the session, followed by a personalised protocol combining cleansing, manual work, active serums, and finishing care.",
      },
      {
        number: "II",
        title: "Format",
        description:
          "1:1 with a certified facial therapist. Protocols are adapted to your skin type, current condition, and goals — from deep hydration to firming, brightening, or barrier repair.",
      },
      {
        number: "III",
        title: "Frequency",
        description:
          "One session every three to four weeks maintains optimal skin health. Members addressing specific concerns benefit from an initial course of four to six sessions for visible structural improvement.",
      },
    ],
    ctaHeading: "Restore your skin.",
    ctaBody:
      "Facial Therapies are available to all Essentia members. Book your first session or join the community to get started.",
  },
};
