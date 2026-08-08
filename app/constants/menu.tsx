export const maiMenu = [
  {
    name: "Wellness",
    href: "/wellness",
    card: {
      title: "Wellness",
      description:
        "Thermal contrast, manual therapies, and breathwork — a curated journey to restore your body's natural balance.",
      imagen: "/images/menu/wellness-900x600.webp",
    },
    itemMenu: [
      {
        itemName: "Manual therapies",
        href: "/wellness/manual-therapies",
        card: {
          title: "Manual Therapies",
          description:
            "Skilled hands releasing tension, restoring mobility, and deepening your sense of physical ease.",
          imagen: "/images/menu/manual-therapies-900x400.webp",
        },
      },
      {
        itemName: "Therapeutic Facials",
        href: "/wellness/facial-therapies",
        card: {
          title: "Therapeutic Facials",
          description:
            "Expert facial protocols combining manual techniques and advanced technology for radiant, lasting skin health.",
          imagen: "/images/menu/facial-therapies-900x600.webp",
        },
      },
      // TODO: re-enable when thermal contrast goes live
      // {
      //   itemName: "Thermal contrast",
      //   href: "/wellness/contrast-therapy",
      //   comingSoon: true,
      //   card: {
      //     title: "Thermal contrast",
      //     description:
      //       "Cold immersion and dry saunas to activate the nervous system, boost circulation, and sharpen mental resilience.",
      //     imagen: "/images/menu/thermal-contrast-900x600.webp",
      //   },
      // },
      // TODO: re-enable when breathing sessions go live
      // {
      //   itemName: "Breathing sessions",
      //   href: "/wellness/breathing-sessions",
      //   comingSoon: true,
      //   card: {
      //     title: "Breathing Sessions",
      //     description:
      //       "Structured breathwork to calm the mind, regulate the nervous system, and cultivate lasting inner stillness.",
      //     imagen: "/images/menu/breathing-sessions-900x600.webp",
      //   },
      // },
      {
        itemName: "Red light therapy",
        href: "/wellness/red-light-therapy",
        comingSoon: true,
        card: {
          title: "Red Light Therapy",
          description:
            "Targeted red and near-infrared light to accelerate cellular repair, reduce inflammation, and support deep tissue recovery.",
          imagen: "/images/menu/red-light-therapy-900x600.webp",
        },
      },
      {
        itemName: "Functional wellbeing",
        href: "/wellness/functional-wellbeing",
        comingSoon: true,
        card: {
          title: "Functional Wellbeing",
          description:
            "Assessment and training built around how your body actually moves, to sustain strength, mobility and energy over time.",
          imagen: "/images/menu/functional-wellbeing-900x600.webp",
        },
      },
    ],
  },
  {
    name: "Medicine",
    href: "/medicine",
    card: {
      title: "Medicine",
      description:
        "Clinical protocols bridging regenerative science and integrative medicine to address the root causes of imbalance.",
      imagen: "/images/menu/medicine-900x600.webp",
    },
    itemMenu: [
      // TODO: re-enable when regenerative medicine goes live
      // {
      //   itemName: "Regenerative medicine",
      //   href: "/medicine/regenerative-medicine",
      //   comingSoon: true,
      //   card: {
      //     title: "Regenerative Medicine",
      //     description:
      //       "Treatments that activate the body's own repair mechanisms — promoting deep, long-term healing from within.",
      //     imagen: "/images/menu/regenerative-medicine-900x600.webp",
      //   },
      // },
      {
        itemName: "Intravenous therapy",
        href: "/medicine/intravenous-therapy",
        comingSoon: true,
        card: {
          title: "Intravenous Therapy",
          description:
            "Vitamins, minerals, and nutrients infused directly into the bloodstream for immediate cellular impact.",
          imagen: "/images/menu/intravenous-therapy-900x600.webp",
        },
      },
      // TODO: re-enable when hyperbaric chambers go live
      // {
      //   itemName: "Hyperbaric chambers",
      //   href: "/medicine/hyperbaric-chambers",
      //   comingSoon: true,
      //   card: {
      //     title: "Hyperbaric Chambers",
      //     description:
      //       "Pressurized oxygen therapy that floods tissues with healing oxygen — speeding recovery and sharpening focus.",
      //     imagen: "/images/menu/hyperbaric-chambers-900x600.webp",
      //   },
      // },
    ],
  },
  {
    name: "Experiences",
    href: "/experiences",
    card: {
      title: "Experiences",
      description:
        "A living ecosystem of people united by a shared commitment to health, movement, learning, and meaningful connection.",
      imagen: "/images/menu/community-900x600.webp",
    },
    itemMenu: [
      {
        itemName: "Education and programs",
        href: "/experiences/education-programs",
        comingSoon: true,
        card: {
          title: "Education and Programs",
          description:
            "Talks, workshops, and immersive programs that deepen your health knowledge and empower real, lasting change.",
          imagen: "/images/menu/education-programs-900x600.webp",
        },
      },
      {
        itemName: "Running club",
        href: "/experiences/running-club",
        comingSoon: true,
        card: {
          title: "Running Club",
          description:
            "Group runs along curated routes — structured training with the energy and accountability of a like-minded community.",
          imagen: "/images/menu/running-club-900x600.webp",
        },
      },
      // TODO: re-enable when memberships go live
      // {
      //   itemName: "Memberships",
      //   href: "/experiences/memberships",
      //   card: {
      //     title: "Memberships",
      //     description:
      //       "Tiered memberships for consistent access to Essentia's full ecosystem of wellness, medicine, and experiences.",
      //     imagen: "/images/menu/memberships-900x600.webp",
      //   },
      // },
    ],
  },
  {
    name: "Essentia",
    href: "/",
    card: {
      title: null,
      description: null,
      imagen: null,
    },
    itemMenu: [
      {
        itemName: "About",
        href: "/about",
        card: null,
      },
      {
        itemName: "Reviews",
        href: "/reviews",
        card: null,
      },
      {
        itemName: "Blog",
        href: "/blog",
        card: null,
      },
      {
        itemName: "Shop",
        href: "/shop",
        card: null,
      },
      {
        itemName: "Contact",
        href: "/contact",
        card: null,
      },
    ],
  },
];

export const legalMenu = [
  {
    name: "Legal",
    href: "/legal",
  },
  {
    name: "Privacy",
    href: "/privacy",
  },
  {
    name: "Terms",
    href: "/terms",
  },
  {
    name: "Cookies",
    href: "/cookies",
  },
];
