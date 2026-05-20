export type BookableService = {
  id: string;
  category: "wellness" | "medicine";
  title: string;
  description: string;
  body: string;
  highlights: { title: string; description: string }[];
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
      "A brief ritual that releases tension across the back, neck, and shoulders. Enveloping techniques, mindful pressure, and essential oils.",
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
      "A decontracting deep-pressure massage for areas of pain, stiffness, and muscle overload.",
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
      "An aesthetic and therapeutic massage to sculpt the silhouette, reduce fluid retention, and improve the appearance of orange-peel skin.",
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
      "A massage for tired legs and fatigued muscles. Ideal for athletes and active people: reduces fatigue and helps prevent injury.",
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
      "A massage designed for expectant mothers. Gentle, safe techniques that relieve muscular tension and swelling during pregnancy.",
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
      "An experience of deep relaxation with soft, continuous manoeuvres. Stimulates circulation and revitalises energy from within.",
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
      "For skin exposed to the sun. Anti-inflammatory aloe vera wrap followed by a relaxing full-body massage.",
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
      "A deep-tissue massage for contractures, stiffness, and persistent pain. Improves mobility and muscle elasticity.",
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
      "A multisensory experience: cranio-facial massage, reflexology, and aromatherapy for a complete disconnect.",
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
      "A sensory ritual for two: reconnection through touch, breath, and mutual care.",
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
    price: "270 €",
    priceCenter: "270 €",
    image: "/images/menu/manual-therapies.webp",
  },
  {
    id: "essentia-signature",
    category: "wellness",
    title: "Essentia",
    description:
      "A complete experience: body peel, ultra-hydrating wrap, rejuvenating facial with craniofacial massage, and a full-body massage.",
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
    price: "350 €",
    priceCenter: "350 €",
    image: "/images/menu/manual-therapies.webp",
  },
];
