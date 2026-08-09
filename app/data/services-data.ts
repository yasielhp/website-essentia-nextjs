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
  /** Full-screen hero on the treatment page. */
  image: string;
  /** Landscape crop for the card on the manual therapies page. */
  thumbnail: string;
};

export const bookableServices: BookableService[] = [
  // Wellness
  {
    id: "manual-therapies",
    category: "wellness",
    title: "Manual Therapies",
    description: "Precise manual work to release tension and restore mobility.",
    durations: ["30 min", "120 min"],
    image: "/images/menu/manual-therapies-900x400.webp",
  },
  {
    id: "facial-therapies",
    category: "wellness",
    title: "Therapeutic Facials",
    description:
      "Advanced facial protocols combining manual techniques and technology to restore skin health.",
    durations: ["60 min"],
    image: "/images/menu/facial-therapies-1200x675.webp",
  },
  // TODO: re-enable when red light therapy goes live
  // {
  //   id: "red-light-therapy",
  //   category: "wellness",
  //   title: "Red Light Therapy",
  //   description:
  //     "Red and infrared light to stimulate cellular repair and regeneration.",
  //   durations: ["20 min"],
  //   image: "/images/menu/red-light-therapy-1200x675.webp",
  // },
  // Medicine
  {
    id: "intravenous-therapy",
    category: "medicine",
    title: "IV Therapy",
    description:
      "Personalised intravenous protocols with vitamins, minerals and micronutrients, always under medical assessment.",
    durations: ["60 min"],
    image: "/images/menu/intravenous-therapy-1200x675.webp",
  },
];

/**
 * The IV protocols, run with VitalDrip.
 *
 * Same shape as the facial rituals: the copy is translated and lives in the
 * messages, so this holds only what code needs — the id that ties a card to
 * its tier in the database, and the images.
 */
export type IvProtocol = {
  id: string;
  /** Landscape crop for the card on the IV therapy page. */
  thumbnail: string;
};

export const ivProtocols: IvProtocol[] = [
  {
    id: "essentia-iv-signature",
    thumbnail:
      "/images/medicine/iv-therapy/cards/essentia-iv-signature-1200x675.webp",
  },
  {
    id: "power-drip",
    thumbnail: "/images/medicine/iv-therapy/cards/power-drip-1200x675.webp",
  },
  {
    id: "immunity-drip",
    thumbnail: "/images/medicine/iv-therapy/cards/immunity-drip-1200x675.webp",
  },
  {
    id: "nirvana-drip",
    thumbnail: "/images/medicine/iv-therapy/cards/nirvana-drip-1200x675.webp",
  },
  {
    id: "stress-balance",
    thumbnail: "/images/medicine/iv-therapy/cards/stress-balance-1200x675.webp",
  },
  {
    id: "beauty-hair-glow",
    thumbnail:
      "/images/medicine/iv-therapy/cards/beauty-hair-glow-1200x675.webp",
  },
  {
    id: "vitamin-c",
    thumbnail: "/images/medicine/iv-therapy/cards/vitamin-c-1200x675.webp",
  },
  {
    id: "nad-plus",
    thumbnail: "/images/medicine/iv-therapy/cards/nad-plus-1200x675.webp",
  },
  {
    id: "resurrection-drip",
    thumbnail:
      "/images/medicine/iv-therapy/cards/resurrection-drip-1200x675.webp",
  },
  {
    id: "body-drip",
    thumbnail: "/images/medicine/iv-therapy/cards/body-drip-1200x675.webp",
  },
  {
    id: "fit-drip",
    thumbnail: "/images/medicine/iv-therapy/cards/fit-drip-1200x675.webp",
  },
  {
    id: "calm-drip",
    thumbnail: "/images/medicine/iv-therapy/cards/calm-drip-1200x675.webp",
  },
];

/** The three facial rituals. No tiers in the database yet, so there are no
 *  individual pages and no per-treatment deep link into the booking form. */
export type FacialTreatment = {
  id: string;
  title: string;
  /** Duration and price, as one line — the formats differ per ritual. */
  meta: string;
  description: string;
  /** Full-screen hero on the ritual's own page. */
  image: string;
  /** Landscape crop for the card on the facials page. */
  thumbnail: string;
  /** Long copy and highlights are still being written. */
  highlights?: { title: string; description: string }[];
};

export const facialTreatments: FacialTreatment[] = [
  {
    id: "aurum",
    title: "Aurum",
    meta: "60 min · €180",
    description:
      "Radiance, firmness and regeneration with gold leaf, premium Aurum cosmetics and Kobido-inspired technique.",
    image: "/images/wellness/facials/heroes/aurum-1920x1080.webp",
    thumbnail: "/images/wellness/facials/cards/aurum-1200x675.webp",
    highlights: [
      {
        title: "Natural radiance",
        description:
          "Helps bring freshness and light back to the face, leaving the skin looking more rested and revitalised.",
      },
      {
        title: "Nourishment and regeneration",
        description:
          "Premium cosmetics, exfoliation and gold leaf together support the skin's visible renewal.",
      },
      {
        title: "Kobido-inspired massage",
        description:
          "Precise facial work to stimulate the tissue, soften the expression and deepen the ritual.",
      },
    ],
  },
  {
    id: "eleva",
    title: "Eleva",
    meta: "60 min · €220",
    description:
      "Definition, structure and a lifting effect with facial wood therapy, natural hyaluronic acid and specific manual technique.",
    image: "/images/wellness/facials/heroes/eleva-1920x1080.webp",
    thumbnail: "/images/wellness/facials/cards/eleva-1200x675.webp",
    highlights: [
      {
        title: "Facial definition",
        description:
          "Works the contour of the face for a more defined, harmonious and rested look.",
      },
      {
        title: "Firmness and structure",
        description:
          "Facial wood therapy and manual technique together tone the tissue and support its natural firmness.",
      },
      {
        title: "A natural lifting effect",
        description:
          "A non-invasive ritual made to lift the expression of the face and bring out its radiance.",
      },
    ],
  },
  {
    id: "kinea-signature",
    title: "Kinéa Signature",
    meta: "First assessment + session · €240",
    description:
      "Full facial re-education, working posture, breathing, fascia, muscle and skin to recover harmony from the structure out.",
    image: "/images/wellness/facials/heroes/kinea-signature-1920x1080.webp",
    thumbnail: "/images/wellness/facials/cards/kinea-signature-1200x675.webp",
    highlights: [
      {
        title: "Full facial re-education",
        description:
          "Works the face from its structure, reading posture, breathing, fascia, muscle and skin.",
      },
      {
        title: "Natural harmony",
        description:
          "Helps soften tension, redefine the face and recover a more rested, balanced expression.",
      },
      {
        title: "A personalised assessment",
        description:
          "The first session includes an assessment, so the treatment fits what that face actually needs.",
      },
    ],
  },
];

export const manualTherapyTreatments: ManualTherapyTreatment[] = [
  {
    id: "espira",
    title: "Espira",
    description:
      "Relaxing massage focused on the upper body — neck, shoulders, cervical area and back. It closes with craniofacial work to settle the nervous system and bring back calm, lightness and presence.",
    body: "Espira is a relaxation ritual for the upper body — neck, cervical area, shoulders and back, where the tension of the day tends to settle.\n\nThrough enveloping movements, gentle pressure and an unhurried rhythm, the treatment helps the muscles let go, softens the tension and builds a state of deep calm.\n\nIt closes with a craniofacial massage, designed to carry the nervous system towards deeper relaxation, rest and presence.",
    highlights: [
      {
        title: "Upper-body relaxation",
        description:
          "Works the neck, shoulders and back with a gentle, enveloping and deeply relaxing approach.",
      },
      {
        title: "An unhurried rhythm",
        description:
          "An experience made to step out of the pace of the day and carry the body towards calm.",
      },
      {
        title: "A sensory close",
        description:
          "The craniofacial massage completes the experience, taking the body into deeper relaxation and a full sense of calm.",
      },
    ],
    durations: ["30 min"],
    priceCenter: "90 €",
    priceSuite: "120 €",
    image: "/images/wellness/treatments/espira-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/espira-1200x675.webp",
  },
  {
    id: "pulse",
    title: "Pulse",
    description:
      "Deep tissue therapeutic massage, made to ease knots, reduce muscular stiffness and give the body back its mobility when rest alone no longer shifts the tension.",
    body: "Pulse is a deep tissue therapeutic massage for the upper body, built to work on areas of built-up tension, stiffness and muscular overload, above all in the back, neck and shoulders.\n\nThrough firm pressure, specific manoeuvres and precise work on the muscle, the treatment helps release knots, improve mobility and ease that feeling of being blocked.\n\nIt suits people with recurring muscular discomfort, physical stress, sedentary work or accumulated tension who need something deeper and more targeted.",
    highlights: [
      {
        title: "Deep, precise work",
        description:
          "Works the muscles of the upper body to ease built-up tension and overloaded areas.",
      },
      {
        title: "Releases knots and stiffness",
        description:
          "Helps reduce that blocked feeling in the neck, shoulders and back.",
      },
      {
        title: "Mobility and relief",
        description:
          "A treatment aimed at recovering freedom of movement, release and muscular wellbeing.",
      },
    ],
    durations: ["45 min"],
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/wellness/treatments/pulse-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/pulse-1200x675.webp",
  },
  {
    id: "drenaje-linfatico",
    title: "Drenaje Linfático Avanzado",
    description:
      "The Método Essentia brings together precision, rhythm and a therapist's eye to follow processes of inflammation, fluid retention and heaviness, building a greater sense of lightness and balance.",
    body: "Advanced Lymphatic Drainage · Método Essentia comes out of years of study, practice and evolution across different manual lymphatic drainage techniques. It starts from the classic principles of drainage and adapts them to a more current, deeper and more personal view of the body.\n\nThrough rhythmic, precise and enveloping movements, the method works with the natural functioning of the lymphatic system, following processes of inflammation, fluid retention, heaviness, recovery and balance in the body.\n\nAs part of that evolution, the treatment closes with a phase of therapeutic photobiomodulation using red and infrared light, applied over the area worked to support the tissue, encourage the feeling of recovery and deepen the experience.\n\nAt Essentia we believe aesthetics begin with health. This treatment goes past appearance: it looks after the body from a therapeutic standpoint, reading the tissue, the inflammation, the breathing and how the body responds, so each session fits what that person actually needs.",
    highlights: [
      {
        title: "Inflammation and retention",
        description:
          "We work with the lymphatic system to move fluid, ease heaviness and reduce that swollen feeling.",
      },
      {
        title: "Therapeutic photobiomodulation",
        description:
          "The closing phase with red and infrared light is applied over the area worked, to support recovery, tissue and wellbeing.",
      },
      {
        title: "A personalised method",
        description:
          "We read the tissue, the breathing and how the body responds, so each session fits what it actually needs.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "100 €",
    priceSuite: "130 €",
    image: "/images/wellness/treatments/drenaje-linfatico-1920x1080.webp",
    thumbnail:
      "/images/wellness/treatments/cards/drenaje-linfatico-1200x675.webp",
  },
  {
    id: "essentia-active",
    title: "Essentia Active",
    description:
      "Recovery massage for tired or overloaded legs. Made to ease heaviness, bring back lightness and look after legs under physical strain.",
    body: "Essentia Active is a massage for the legs and nothing else, made to ease heaviness, fatigue and muscular overload.\n\nThrough release work, pressure adapted to you and stimulating movement, the treatment helps let go of built-up tension, encourage mobility and bring lightness back to the legs.\n\nIt suits active people, athletes, or anyone who spends long hours on their feet and needs to recover rest, freshness and wellbeing in the legs.",
    highlights: [
      {
        title: "Muscle recovery",
        description:
          "Helps ease overload, fatigue and that heavy-legged feeling after training, physical work or long hours on the go.",
      },
      {
        title: "Lightness in the legs",
        description:
          "Works the tension built up in tired legs and muscles to bring back rest, mobility and wellbeing.",
      },
      {
        title: "An active body, looked after",
        description:
          "A treatment made to support physical performance, keep overload in check and hold the body in better shape.",
      },
    ],
    durations: ["45 min"],
    priceCenter: "110 €",
    priceSuite: "140 €",
    image: "/images/wellness/treatments/essentia-active-1920x1080.webp",
    thumbnail:
      "/images/wellness/treatments/cards/essentia-active-1200x675.webp",
  },
  {
    id: "nurtura",
    title: "Nurtura",
    description:
      "A gentle, safe prenatal massage, designed to ease tension and swelling and support the body through pregnancy.",
    body: "Nurtura is a prenatal massage created to support a woman through pregnancy with a delicate, safe and deeply careful approach.\n\nThrough gentle techniques, an unhurried rhythm and pressure adapted to her, the treatment helps ease muscular tension, heaviness and the swelling that comes with this stage, making room for more rest and wellbeing.\n\nEach session adapts to where the pregnancy is, to the state of the body and to what the mother needs, creating a space of calm, connection and care for her and for the baby.",
    highlights: [
      {
        title: "Relief through pregnancy",
        description:
          "Helps reduce tension in the back, the legs and the areas carrying the load, following the body's natural changes at this stage.",
      },
      {
        title: "Less heaviness and swelling",
        description:
          "Gentle, adapted techniques to encourage lightness, rest and greater physical comfort.",
      },
      {
        title: "Safe, conscious care",
        description:
          "We respect every stage of pregnancy with delicate, adapted support. Suitable from the second trimester onwards, provided there is no medical contraindication.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/wellness/treatments/nurtura-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/nurtura-1200x675.webp",
  },
  {
    id: "serenna",
    title: "Serenna",
    description:
      "Full-body relaxation: warm oils and slow movements to reset the nervous system.",
    body: "Serenna is an experience of deep calm, created to pause the body's pace and carry it into real rest.\n\nThrough gentle, continuous and harmonious movements, the treatment invites you to let go, breathe and reconnect with a sense of inner serenity.\n\nThe pressure adapts to each person, bringing together conscious touch and an enveloping rhythm to create an experience of rest, presence and wellbeing.",
    highlights: [
      {
        title: "Deep relaxation",
        description:
          "Gentle, continuous movements that help the body let go of tension and settle into rest.",
      },
      {
        title: "A quieter mind",
        description:
          "An experience made to slow the pace, ease stress and guide the nervous system towards calm.",
      },
      {
        title: "Reconnecting with the body",
        description:
          "Conscious touch, the oils and the rhythm of the massage create a sense of presence, lightness and balance.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "130 €",
    priceSuite: "160 €",
    image: "/images/wellness/treatments/serenna-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/serenna-1200x675.webp",
  },
  {
    id: "solea",
    title: "Soléa",
    description:
      "Post-sun ritual with aloe vera and full-body massage to calm, hydrate and restore the skin after sun exposure.",
    body: "Soléa is a post-sun ritual created to look after the skin and the body after sun exposure, above all when there is heat, sensitivity, dryness or redness.\n\nThe session brings together an aloe vera wrap and a relaxing full-body massage, helping to cool, hydrate and calm the skin while the body settles into deep rest.\n\nIt suits anyone looking to recover comfort, softness and balance after days of sun, beach or pool.",
    highlights: [
      {
        title: "Calm and hydration",
        description:
          "The aloe vera wrap helps cool the skin, bring hydration and ease that sensitive feeling after sun exposure.",
      },
      {
        title: "Rest for the body",
        description:
          "The relaxing full-body massage carries the body towards calm, lightness and wellbeing.",
      },
      {
        title: "A post-sun ritual",
        description:
          "An experience made to restore skin and body after the sun, bringing together care, freshness and relaxation.",
      },
    ],
    durations: ["70 min"],
    priceCenter: "150 €",
    priceSuite: "180 €",
    image: "/images/wellness/treatments/solea-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/solea-1200x675.webp",
  },
  {
    id: "soma",
    title: "Soma",
    description:
      "Full-body deep tissue massage, aimed at persistent tension, muscular stiffness and overloaded areas, working towards mobility and a sense of release.",
    body: "Soma is a deep tissue massage created to work on muscular tension, built-up stiffness and overloaded areas.\n\nThrough deep, precise manoeuvres, it helps release tension, improve mobility and bring the body back to a sense of wellbeing.\n\nIt suits knots, physical overload, accumulated stiffness, or bodies that need something deeper, therapeutic and restorative.",
    highlights: [
      {
        title: "Deep muscular work",
        description:
          "Works the areas holding the most tension, to ease overload and recover muscular comfort.",
      },
      {
        title: "Tension relief",
        description:
          "For bodies that feel loaded, stiff or sore from the effort of the everyday.",
      },
      {
        title: "Mobility restored",
        description:
          "Encourages a greater sense of freedom, lightness and wellbeing after the treatment.",
      },
    ],
    durations: ["60 min"],
    priceCenter: "160 €",
    priceSuite: "190 €",
    image: "/images/wellness/treatments/soma-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/soma-1200x675.webp",
  },
  {
    id: "lume",
    title: "Lume",
    description:
      "A full-body multisensory experience combining massage, craniofacial work and foot reflexology to bring a deep disconnection and carry the body towards calm, rest and balance.",
    body: "Lume is a multisensory experience of deep wellbeing, created for anyone after a real disconnection and complete rest for body and mind.\n\nThrough a combination of relaxing massage, craniofacial work, foot reflexology and manual techniques, the ritual helps release tension, calm the nervous system and recover a deep sense of wellbeing.\n\nMore than a massage, Lume is a pause to reconnect with yourself, restore balance and feel the body from a place of calm again.",
    highlights: [
      {
        title: "Deep disconnection",
        description:
          "An experience designed to slow the pace, ease stress and carry the body towards calm.",
      },
      {
        title: "Craniofacial and reflexology",
        description:
          "Work on the face, head and feet helps release tension, clear the mind and encourage deep rest.",
      },
      {
        title: "Multisensory wellbeing",
        description:
          "Several manual techniques and an enveloping rhythm turn each session into an experience of deep wellbeing.",
      },
    ],
    durations: ["80 min"],
    priceCenter: "220 €",
    priceSuite: "250 €",
    image: "/images/wellness/treatments/lume-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/lume-1200x675.webp",
  },
  {
    id: "alure-duo",
    title: "Alure Duo",
    description:
      "A ritual for two bodies after time, presence and calm. A shared experience of care and connection.",
    body: "Alure Duo is a wellbeing experience designed for two people who want to give themselves a moment of calm, connection and shared care.\n\nMore than a couples massage, it is a sensory ritual where every detail is there to create an intimate, elegant and memorable pause. Through touch, breathing and a carefully prepared setting, the body lets go and the moment becomes something to remember.\n\nIt suits couples, special occasions, or anyone who wants to share a space of wellbeing built on presence, quiet and mutual care.",
    highlights: [
      {
        title: "An experience for two",
        description:
          "A ritual created to share time, calm and presence in a considered, deeply relaxing setting.",
      },
      {
        title: "Connection and wellbeing",
        description:
          "The treatment invites you to switch off from the outside and reconnect through touch, breathing and shared care.",
      },
      {
        title: "A moment to remember",
        description:
          "More than a session: a sensory experience made to be felt, lived and remembered.",
      },
    ],
    durations: ["50 min"],
    priceCenter: "270 €",
    image: "/images/wellness/treatments/alure-duo-1920x1080.webp",
    thumbnail: "/images/wellness/treatments/cards/alure-duo-1200x675.webp",
  },
  {
    id: "essentia-signature",
    title: "Essentia Signature",
    description:
      "Our most complete ritual: exfoliation, hydrating wrap, rejuvenating facial and full-body massage for a premium renewal experience.",
    body: "Essentia is our most exclusive ritual, designed to revitalise the skin, restore balance in the body and turn self-care into a complete sensory experience.\n\nIt opens with a natural-fibre body peeling to renew the skin and prepare it to take in the actives. An ultra-hydrating, toning wrap then brings nourishment, softness and comfort to the body.\n\nThe experience continues with a rejuvenating facial and craniofacial massage, using high-end products such as Aurum Cream, formulated with micro-active gold and aloe vera to bring radiance, hydration and an immediate sense of freshness and renewal.\n\nTo close, a relaxing full-body massage helps release tension, deepen the feeling of rest and finish the ritual in a state of profound wellbeing.\n\nAs a final touch, we include an exclusive wash bag with selected products from the treatment, so the Essentia experience stays with you beyond the session.",
    highlights: [
      {
        title: "Complete body renewal",
        description:
          "Natural-fibre peeling and a hydrating wrap to soften, nourish and bring comfort back to the skin.",
      },
      {
        title: "Rejuvenating facial",
        description:
          "A facial ritual with craniofacial massage, Aurum Cream, micro-active gold and aloe vera for radiance, hydration and freshness.",
      },
      {
        title: "Premium wellbeing",
        description:
          "A full-body massage and an exclusive wash bag, so the experience carries on past the treatment.",
      },
    ],
    durations: ["120 min"],
    priceCenter: "350 €",
    image: "/images/wellness/treatments/essentia-signature-1920x1080.webp",
    thumbnail:
      "/images/wellness/treatments/cards/essentia-signature-1200x675.webp",
  },
];
