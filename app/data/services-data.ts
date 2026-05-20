export type BookableService = {
  id: string;
  category: "wellness" | "medicine";
  title: string;
  description: string;
  durations: string[];
  image: string;
};

export type ManualTherapyTreatment = {
  id: string;
  title: string;
  description: string;
  body: string;
  highlights: { title: string; description: string }[];
  durations: string[];
  priceCenter?: string;
  priceSuite?: string;
  image: string;
};

export const bookableServices: BookableService[] = [
  // Wellness
  {
    id: "manual-therapies",
    category: "wellness",
    title: "Manual Therapies",
    description: "Precise manual work to release tension and restore mobility.",
    durations: ["30 min", "120 min"],
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "contrast-therapy",
    category: "wellness",
    title: "Contrast Therapy",
    description:
      "Alternating heat and cold to activate recovery and reduce inflammation.",
    durations: ["60 min"],
    image: "/images/menu/thermal-contrast.webp",
  },
  {
    id: "breathing-sessions",
    category: "wellness",
    title: "Breathing Sessions",
    description: "Guided breathwork to shift from stress to active recovery.",
    durations: ["45 min"],
    image: "/images/menu/breathing-sessions.webp",
  },
  {
    id: "red-light-therapy",
    category: "wellness",
    title: "Red Light Therapy",
    description:
      "Red and infrared light to stimulate cellular repair and regeneration.",
    durations: ["20 min"],
    image: "/images/menu/red-light-therapy.webp",
  },
  {
    id: "functional-well-being",
    category: "wellness",
    title: "Functional Well-being",
    description: "Movement and strength training designed around longevity.",
    durations: ["50 min"],
    image: "/images/menu/functional-wellbeing.webp",
  },
  // Medicine
  {
    id: "hyperbaric-chambers",
    category: "medicine",
    title: "Hyperbaric Oxygen",
    description:
      "Pressurised oxygen to accelerate tissue repair and reduce inflammation.",
    durations: ["60 min"],
    image: "/images/menu/hyperbaric-chambers.webp",
  },
  {
    id: "intravenous-therapy",
    category: "medicine",
    title: "IV Therapy",
    description:
      "Direct nutrient delivery for rapid absorption and cellular support.",
    durations: ["45 min"],
    image: "/images/menu/intravenous-therapy.webp",
  },
  {
    id: "regenerative-medicine",
    category: "medicine",
    title: "Regenerative Medicine",
    description: "Protocols that activate your body's own repair mechanisms.",
    durations: ["30 min", "60 min", "90 min"],
    image: "/images/menu/regenerative-medicine.webp",
  },
];

export const manualTherapyTreatments: ManualTherapyTreatment[] = [
  {
    id: "espira",
    title: "Espira",
    description:
      "Express ritual for neck and shoulders. Oils and precise pressure dissolve tension in 30 minutes.",
    body: "Espira is an express ritual designed for those who need to disconnect in a short window of time. In 30 minutes, our therapist works with precision on the upper back, neck, and shoulders — the areas where everyday tension accumulates. Deep gliding manoeuvres are combined with targeted pressure over tension knots, using essential oils selected for their relaxing and decontracting properties. It is the ideal starting point if you have never received a therapeutic massage or if you are looking for a moment of pause during the week.",
    highlights: [
      {
        title: "Immediate relief",
        description:
          "Works directly on the focal points of tension in the neck and trapezius, with results that are noticeable from the very first session.",
      },
      {
        title: "Therapeutic essential oils",
        description:
          "The combination of aromatherapy and touch activates the parasympathetic nervous system, inducing calm within minutes.",
      },
      {
        title: "Express format with no commitment",
        description:
          "30 minutes of concentrated efficacy. Perfect to pair with other experiences at the centre or as a weekly wellness ritual.",
      },
    ],
    durations: ["30 min"],
    priceCenter: "90 €",
    priceSuite: "120 €",
    image: "/images/wellness/treatments/espira.webp",
  },
  {
    id: "pulse",
    title: "Pulse",
    description:
      "Deep-tissue massage for chronic contractures. Reaches layers ordinary massage cannot.",
    body: "Pulse is designed for the body that works hard. Lasting 45 minutes and delivered with above-average pressure, this massage addresses entrenched muscle contractures, postural rigidity, and pain points that do not yield to ordinary rest. In each session, our therapist identifies the areas under greatest load and applies deep friction techniques, ischaemic compression, and passive mobilisation to restore optimal muscle tone. Especially recommended for people in sedentary jobs, athletes in high-load periods, or anyone carrying accumulated chronic tension.",
    highlights: [
      {
        title: "Controlled deep pressure",
        description:
          "A deep-tissue technique that reaches muscle layers conventional massage cannot address, dissolving true contractures.",
      },
      {
        title: "Assessment in every session",
        description:
          "The therapist adapts pressure and focus areas to your state in the moment, rather than following a fixed protocol.",
      },
      {
        title: "Accelerated recovery",
        description:
          "Reduces muscle recovery time, improves local circulation, and relieves the nervous tension associated with contractures.",
      },
    ],
    durations: ["45 min"],
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/wellness/treatments/pulse.webp",
  },
  {
    id: "drenaje-linfatico",
    title: "Drenaje Linfático Brasileño",
    description:
      "Rhythmic drainage to reduce fluid retention, sculpt the figure, and smooth the skin.",
    body: "Brazilian Lymphatic Drainage is a technique of Brazilian origin that combines classic manual lymphatic drainage with specific contouring manoeuvres. Through rhythmic, directional movements, the superficial lymphatic flow is stimulated, helping to eliminate retained fluids and toxins. The result is a more defined figure, smoother skin, and an immediate feeling of lightness. It is especially effective when performed in cycles of regular sessions, as the effects are cumulative. Indicated for people with fluid retention, cellulite, swelling in the legs, or as a complement to a body transformation process.",
    highlights: [
      {
        title: "Reduction of fluid retention",
        description:
          "Stimulates the lymphatic system to drain excess interstitial fluid, visibly reducing swelling.",
      },
      {
        title: "Contouring effect",
        description:
          "Brazilian manoeuvres work on the hypodermal layer to smooth orange-peel skin and refine body contours.",
      },
      {
        title: "Improved circulation",
        description:
          "Activates microcirculation and venous return, relieving heavy legs and improving tissue oxygenation.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/wellness/treatments/drenaje-linfatico.webp",
  },
  {
    id: "essentia-active",
    title: "Essentia Active",
    description:
      "Sports recovery massage. Reduces fatigue, prevents injury, and restores mobility.",
    body: "Essentia Active is the recovery protocol designed for the body in motion. It combines sports massage techniques, neuromuscular compression, and assisted stretching to accelerate muscle recovery, reduce accumulated fatigue, and maintain tissue function between training sessions. The work focuses especially on the lower-body muscle chains — quadriceps, hamstrings, calves, and glutes — without neglecting the lumbar region and hip flexors. Ideal before and after sporting events, or as weekly maintenance for those who train regularly.",
    highlights: [
      {
        title: "Active muscle recovery",
        description:
          "Specific techniques to reduce DOMS (delayed onset muscle soreness) and speed up the return to activity.",
      },
      {
        title: "Injury prevention",
        description:
          "Detects and treats overloaded areas before they become injuries, preserving the quality of the muscle tissue.",
      },
      {
        title: "Improved joint mobility",
        description:
          "The assisted stretches at the close of the session restore muscle length and joint range of motion.",
      },
    ],
    durations: ["45 min"],
    priceCenter: "110 €",
    priceSuite: "140 €",
    image: "/images/wellness/treatments/essentia-active.webp",
  },
  {
    id: "nurtura",
    title: "Nurtura",
    description:
      "Prenatal massage to ease back pain, reduce swelling, and create deep calm.",
    body: "Nurtura is a prenatal massage designed specifically to accompany the body through pregnancy. With appropriate positioning and gentle pressure techniques, it relieves the lower-back and upper-back discomfort common during gestation, reduces swelling in the extremities, and provides a space of profound calm for both mother and baby. Every manoeuvre is adapted to the second and third trimesters, avoiding contraindicated areas and using plant-based oils that are safe for skin made sensitive by pregnancy. An experience that cares through touch.",
    highlights: [
      {
        title: "Relief from lower-back pain",
        description:
          "Works on the paravertebral muscles and sacrum, which carry a growing load as pregnancy progresses.",
      },
      {
        title: "Reduction of oedema",
        description:
          "Gentle drainage manoeuvres on the legs and ankles to ease the fluid retention typical of the third trimester.",
      },
      {
        title: "Shared deep calm",
        description:
          "Lowering maternal cortisol has a direct effect on the baby's wellbeing, turning the session into a moment of connection.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/wellness/treatments/nurtura.webp",
  },
  {
    id: "serenna",
    title: "Serenna",
    description:
      "Full-body relaxation: warm oils and slow movements to reset the nervous system.",
    body: "Serenna is a total-relaxation massage that combines long, enveloping manoeuvres with circulatory work and stimulation of the parasympathetic nervous system. The session begins with a guided breathing exercise to ease the surrender into rest, followed by a complete tour of the body with warm oils and rhythmic movements that mirror the flow of water. There are no intense pressure points or deep work — the goal is to disconnect completely, slow the pace, and emerge renewed. It is the ideal choice for those who live with the sympathetic nervous system permanently switched on.",
    highlights: [
      {
        title: "Down-regulation of the nervous system",
        description:
          "Slow, continuous manoeuvres send signals of safety to the nervous system, lowering heart rate and cortisol.",
      },
      {
        title: "Circulation and warmth",
        description:
          "Effleurage with warm oils improves superficial circulation and leaves the skin nourished and luminous.",
      },
      {
        title: "Sleep recovery",
        description:
          "Many clients report a noticeable improvement in sleep quality in the days following a Serenna session.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/wellness/treatments/serenna.webp",
  },
  {
    id: "solea",
    title: "Soléa",
    description:
      "Post-sun ritual: aloe vera wrap and full-body massage to calm and restore the skin.",
    body: "Soléa is the essential treatment to restore the skin after sun exposure. The session begins with a wrap of pure aloe vera with anti-inflammatory and soothing action, applied warm across the entire body to calm redness, deeply hydrate, and restore the skin's barrier. After a period of absorption, the therapist performs a full-body massage with soft, gliding movements that enhance the penetration of the active ingredients and work the superficial musculature. The skin emerges hydrated, calmed, and visibly more even.",
    highlights: [
      {
        title: "Active aloe vera wrap",
        description:
          "Concentrated aloe vera calms inflammation, halts peeling, and accelerates cellular regeneration of sun-damaged skin.",
      },
      {
        title: "Deep hydration",
        description:
          "The combination of warmth and natural actives opens the pores and allows maximum hydration to be absorbed into the dermis.",
      },
      {
        title: "Full-body massage included",
        description:
          "This is more than an aesthetic treatment: the massage that follows works the musculature and the nervous system for a holistic recovery.",
      },
    ],
    durations: ["70 min"],
    priceCenter: "150 €",
    priceSuite: "180 €",
    image: "/images/wellness/treatments/solea.webp",
  },
  {
    id: "soma",
    title: "Soma",
    description:
      "Intensive myofascial release for chronic pain, contractures, and restricted movement.",
    body: "Soma is the most intensive protocol on our massage menu. Over 60 minutes, the therapist works systematically on the deep muscle layers, the restrictive fascia, and the trigger points that generate referred pain. Deep-tissue techniques, myofascial release, and joint mobilisation are used to restore lost mobility, dissolve tissue adhesions, and calm chronic pain patterns. The work is deliberate and precise: every manoeuvre has a clear purpose. Recommended for people with chronic neck pain, recurrent lower-back pain, trapezius syndrome, or restricted movement following injury.",
    highlights: [
      {
        title: "Deep myofascial release",
        description:
          "Works on the muscular fascia to break down adhesions that limit movement and perpetuate pain patterns.",
      },
      {
        title: "Active trigger points",
        description:
          "Ischaemic compression on trigger points deactivates referred-pain sources and normalises muscle tone.",
      },
      {
        title: "Joint mobilisation",
        description:
          "Passive mobilisation techniques restore the accessory joint movements that are lost after injury or immobilisation.",
      },
    ],
    durations: ["60 min"],
    priceCenter: "160 €",
    priceSuite: "190 €",
    image: "/images/wellness/treatments/soma.webp",
  },
  {
    id: "lume",
    title: "Lume",
    description:
      "Craniofacial massage, foot reflexology, and personalised aromatherapy in one session.",
    body: "Lume is our most complete multisensory experience. Over 80 minutes, three disciplines are woven together in an uninterrupted flow: craniofacial massage to release the tension stored in the head, scalp, jaw, and neck; foot reflexology to stimulate the internal organs through the reflex points on the sole; and personalised aromatherapy with essential oils chosen according to the client's emotional state before the session. The result is a complete disconnect of the nervous system that goes beyond simple muscle relaxation — Lume works on the autonomic nervous system, the mental state, and bodily perception.",
    highlights: [
      {
        title: "Craniofacial massage",
        description:
          "Releases tension from the jaw, temples, scalp, and neck — the areas where emotional stress is stored.",
      },
      {
        title: "Foot reflexology",
        description:
          "Stimulates the organ reflex points on the sole of the foot, balancing the function of the internal systems.",
      },
      {
        title: "Personalised aromatherapy",
        description:
          "The essential oils are selected in a prior consultation according to the goal of the session: rest, mental clarity, or emotional balance.",
      },
    ],
    durations: ["80 min"],
    priceCenter: "220 €",
    priceSuite: "250 €",
    image: "/images/wellness/treatments/lume.webp",
  },
  {
    id: "alure-duo",
    title: "Alure Duo",
    description:
      "A ritual for two: synchronised therapists, breathwork, and guided touch.",
    body: "Alure Duo is an experience designed for two people who wish to share a space of wellness and reconnection. Two therapists work in synchrony within a private room with a carefully prepared atmosphere — soft lighting, live ambient music, and room aromatherapy. The session combines paired relaxing massage techniques with synchronised breathing exercises and moments of guided conscious touch. It is an experience for couples, friends, or family who want to share quality time outside the routine. No prior wellness experience is required.",
    highlights: [
      {
        title: "Two synchronised therapists",
        description:
          "Working in pairs, with two coordinated professionals, creates an experience of greater depth and sensory immersion.",
      },
      {
        title: "A prepared private room",
        description:
          "An intimate setting with lighting, aromatherapy, and music designed specifically for the shared experience.",
      },
      {
        title: "Reconnection through touch",
        description:
          "Guided conscious-touch exercises foster mutual presence and the emotional bond between participants.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "270 €",
    image: "/images/wellness/treatments/alure-duo.webp",
  },
  {
    id: "essentia-signature",
    title: "Essentia",
    description:
      "Our signature: peel, hydrating wrap, rejuvenating facial, and full-body massage.",
    body: "Essentia is our signature experience: the most complete protocol we offer, designed for a total transformation of body, skin, and mental state in 120 minutes. The session opens with a body peel of mineral salts to remove dead cells and prepare the skin. Next, a wrap of butter and ultra-hydrating oils is applied and absorbed during the following step: a rejuvenating facial massage paired with a craniofacial massage that works on facial expression, skin circulation, and cranial tension. The session concludes with a full-body massage of medium intensity that integrates all the preceding work into one cohesive experience. Exclusive to the centre — not available in-room.",
    highlights: [
      {
        title: "A four-phase protocol",
        description:
          "Peel, wrap, facial, and body massage flow seamlessly into one another, each phase amplifying the effects of the next.",
      },
      {
        title: "Complete skin transformation",
        description:
          "The skin emerges exfoliated, deeply hydrated, and luminous. The results are immediately visible and last for several days.",
      },
      {
        title: "Body-mind integration",
        description:
          "The craniofacial massage at the close of the protocol integrates the experience into the nervous system, leaving a lasting sense of wholeness and calm.",
      },
    ],
    durations: ["120 min"],
    priceCenter: "350 €",
    image: "/images/wellness/treatments/essentia-signature.webp",
  },
];
