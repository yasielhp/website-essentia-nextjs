import type {
  CampaignKind,
  CampaignLocale,
  CampaignLocaleContent,
} from "@/types/campaign";

/**
 * Starting points for the content step: a handful of emails the centre sends
 * often, written in both languages, with the blocks the editor knows. The
 * admin picks one, then edits every word; nothing here is fixed.
 *
 * Kept as data rather than in the database so a template cannot be broken
 * from the dashboard, and so the copy travels with the code that renders it.
 */
export type CampaignTemplate = {
  id: string;
  /** The kinds this template fits best; shown first for them, available to all. */
  kinds: CampaignKind[];
  content: Record<CampaignLocale, CampaignLocaleContent>;
};

const BOOKING_URL = {
  es: "https://www.essentiawellnessclub.com/es/reserva",
  en: "https://www.essentiawellnessclub.com/booking",
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "newsletter",
    kinds: ["standard", "split"],
    content: {
      es: {
        subject: "Novedades de Essentia este mes",
        preheader: "Lo que hemos preparado para ti en el centro.",
        title: "Hola {{first_name}}, esto es lo nuevo",
        blocks: [
          {
            type: "paragraph",
            text: "Este mes hemos preparado algunas novedades que queremos contarte antes que a nadie.",
          },
          { type: "heading", text: "Lo más destacado" },
          {
            type: "paragraph",
            text: "**Nuevo tratamiento**: cuéntalo aquí en dos líneas.\n\n**Horarios**: qué cambia y desde cuándo.",
          },
          { type: "divider" },
          {
            type: "paragraph",
            text: "Si te apetece pasarte, reserva tu sesión en un minuto.",
          },
          { type: "button", text: "Reservar sesión", url: BOOKING_URL.es },
        ],
      },
      en: {
        subject: "What's new at Essentia this month",
        preheader: "What we have prepared for you at the centre.",
        title: "Hello {{first_name}}, here is what's new",
        blocks: [
          {
            type: "paragraph",
            text: "This month we have prepared a few things we wanted you to hear about first.",
          },
          { type: "heading", text: "Highlights" },
          {
            type: "paragraph",
            text: "**New treatment**: describe it here in two lines.\n\n**Opening hours**: what changes and from when.",
          },
          { type: "divider" },
          {
            type: "paragraph",
            text: "If you feel like dropping by, booking a session takes a minute.",
          },
          { type: "button", text: "Book a session", url: BOOKING_URL.en },
        ],
      },
    },
  },
  {
    id: "promotion",
    kinds: ["standard", "split"],
    content: {
      es: {
        subject: "{{first_name}}, una oferta solo para ti",
        preheader: "Válida hasta fin de mes.",
        title: "Un detalle para cuidarte",
        blocks: [
          {
            type: "paragraph",
            text: "Durante este mes, **20 % de descuento** en tu próxima sesión. Sin letra pequeña: reserva, ven y disfruta.",
          },
          { type: "image", url: "", alt: "" },
          {
            type: "paragraph",
            text: "Plazas limitadas por horario. Si tienes un día en mente, mejor reservar pronto.",
          },
          { type: "button", text: "Aprovechar la oferta", url: BOOKING_URL.es },
        ],
      },
      en: {
        subject: "{{first_name}}, an offer just for you",
        preheader: "Valid until the end of the month.",
        title: "A little something to look after yourself",
        blocks: [
          {
            type: "paragraph",
            text: "This month, **20% off** your next session. No small print: book, come in and enjoy.",
          },
          { type: "image", url: "", alt: "" },
          {
            type: "paragraph",
            text: "Slots are limited per time of day. If you have a day in mind, book early.",
          },
          { type: "button", text: "Claim the offer", url: BOOKING_URL.en },
        ],
      },
    },
  },
  {
    id: "announcement",
    kinds: ["standard"],
    content: {
      es: {
        subject: "Tenemos algo nuevo que contarte",
        preheader: "Una novedad en Essentia.",
        title: "Nuevo en Essentia",
        blocks: [
          { type: "image", url: "", alt: "" },
          {
            type: "paragraph",
            text: "Presenta aquí la novedad: qué es, para quién y por qué merece la pena.",
          },
          { type: "heading", text: "Cómo funciona" },
          {
            type: "paragraph",
            text: "Tres o cuatro líneas con lo esencial. Duración, precio, cómo reservar.",
          },
          { type: "button", text: "Saber más", url: BOOKING_URL.es },
        ],
      },
      en: {
        subject: "We have something new to tell you",
        preheader: "Something new at Essentia.",
        title: "New at Essentia",
        blocks: [
          { type: "image", url: "", alt: "" },
          {
            type: "paragraph",
            text: "Introduce the news here: what it is, who it is for and why it is worth it.",
          },
          { type: "heading", text: "How it works" },
          {
            type: "paragraph",
            text: "Three or four lines with the essentials. Duration, price, how to book.",
          },
          { type: "button", text: "Find out more", url: BOOKING_URL.en },
        ],
      },
    },
  },
  {
    id: "welcome",
    kinds: ["autoresponder"],
    content: {
      es: {
        subject: "Bienvenida a Essentia, {{first_name}}",
        preheader: "Gracias por unirte. Esto es lo que puedes esperar.",
        title: "Gracias por unirte, {{first_name}}",
        blocks: [
          {
            type: "paragraph",
            text: "Nos alegra tenerte cerca. De vez en cuando te escribiremos con novedades, consejos y alguna oferta. Nada de correos cada dos días.",
          },
          { type: "heading", text: "Por dónde empezar" },
          {
            type: "paragraph",
            text: "Si todavía no nos conoces en persona, la primera sesión es la mejor manera. Elige el tratamiento que te llame y reserva cuando te venga bien.",
          },
          {
            type: "button",
            text: "Reservar mi primera sesión",
            url: BOOKING_URL.es,
          },
        ],
      },
      en: {
        subject: "Welcome to Essentia, {{first_name}}",
        preheader: "Thanks for joining. Here is what to expect.",
        title: "Thank you for joining, {{first_name}}",
        blocks: [
          {
            type: "paragraph",
            text: "We are glad to have you close. Every so often we will write with news, tips and the occasional offer. No email every other day.",
          },
          { type: "heading", text: "Where to start" },
          {
            type: "paragraph",
            text: "If you have not met us in person yet, a first session is the best way. Pick the treatment that calls to you and book whenever suits.",
          },
          {
            type: "button",
            text: "Book my first session",
            url: BOOKING_URL.en,
          },
        ],
      },
    },
  },
  {
    id: "birthday",
    kinds: ["dateBased"],
    content: {
      es: {
        subject: "¡Feliz cumpleaños, {{first_name}}!",
        preheader: "Un regalo de Essentia para celebrarlo.",
        title: "Feliz cumpleaños, {{first_name}}",
        blocks: [
          {
            type: "paragraph",
            text: "Hoy es tu día, y queríamos celebrarlo contigo. Te regalamos **un 25 % de descuento** en la sesión que elijas durante este mes.",
          },
          {
            type: "paragraph",
            text: "Menciona este email al reservar o al llegar, y listo.",
          },
          { type: "button", text: "Reservar mi regalo", url: BOOKING_URL.es },
        ],
      },
      en: {
        subject: "Happy birthday, {{first_name}}!",
        preheader: "A gift from Essentia to celebrate.",
        title: "Happy birthday, {{first_name}}",
        blocks: [
          {
            type: "paragraph",
            text: "Today is your day, and we wanted to celebrate it with you. Enjoy **25% off** the session of your choice this month.",
          },
          {
            type: "paragraph",
            text: "Mention this email when you book or when you arrive, and that is it.",
          },
          { type: "button", text: "Book my gift", url: BOOKING_URL.en },
        ],
      },
    },
  },
  {
    id: "win-back",
    kinds: ["automated"],
    content: {
      es: {
        subject: "Te echamos de menos, {{first_name}}",
        preheader: "Hace un tiempo que no nos vemos.",
        title: "Hace tiempo que no nos vemos",
        blocks: [
          {
            type: "paragraph",
            text: "Han pasado unas semanas desde tu última visita y queríamos saber cómo estás. Cuidarse no es un gasto: es la mejor inversión que puedes hacer.",
          },
          {
            type: "paragraph",
            text: "Para facilitarte la vuelta, tu próxima sesión tiene **un 15 % de descuento**.",
          },
          { type: "button", text: "Volver a Essentia", url: BOOKING_URL.es },
        ],
      },
      en: {
        subject: "We miss you, {{first_name}}",
        preheader: "It has been a while since we saw you.",
        title: "It has been a while",
        blocks: [
          {
            type: "paragraph",
            text: "A few weeks have passed since your last visit and we wanted to know how you are. Looking after yourself is not an expense: it is the best investment you can make.",
          },
          {
            type: "paragraph",
            text: "To make coming back easier, your next session is **15% off**.",
          },
          {
            type: "button",
            text: "Come back to Essentia",
            url: BOOKING_URL.en,
          },
        ],
      },
    },
  },
  {
    id: "after-visit",
    kinds: ["automated"],
    content: {
      es: {
        subject: "¿Cómo te sientes, {{first_name}}?",
        preheader: "Unos días después de tu sesión.",
        title: "Gracias por tu visita",
        blocks: [
          {
            type: "paragraph",
            text: "Han pasado unos días desde tu sesión y nos gustaría saber cómo te sientes. Si notaste algo que quieras comentarnos, responde a este email.",
          },
          { type: "heading", text: "Para mantener el efecto" },
          {
            type: "paragraph",
            text: "Bebe agua, muévete un poco cada día y, si te apetece continuar, aquí tienes el enlace para tu siguiente cita.",
          },
          {
            type: "button",
            text: "Reservar la siguiente",
            url: BOOKING_URL.es,
          },
        ],
      },
      en: {
        subject: "How are you feeling, {{first_name}}?",
        preheader: "A few days after your session.",
        title: "Thank you for your visit",
        blocks: [
          {
            type: "paragraph",
            text: "A few days have passed since your session and we would love to know how you feel. If you noticed anything you would like to share, just reply to this email.",
          },
          { type: "heading", text: "To keep the effect" },
          {
            type: "paragraph",
            text: "Drink water, move a little every day and, if you feel like continuing, here is the link for your next appointment.",
          },
          { type: "button", text: "Book the next one", url: BOOKING_URL.en },
        ],
      },
    },
  },
  {
    id: "blog-post",
    kinds: ["rss"],
    content: {
      es: {
        subject: "Nuevo en el blog: {{post_title}}",
        preheader: "{{post_excerpt}}",
        title: "{{post_title}}",
        blocks: [
          { type: "paragraph", text: "{{post_excerpt}}" },
          {
            type: "paragraph",
            text: "Lo hemos publicado hoy en el blog de Essentia. Léelo con calma cuando quieras.",
          },
          { type: "button", text: "Leer el artículo", url: "{{post_url}}" },
        ],
      },
      en: {
        subject: "New on the blog: {{post_title}}",
        preheader: "{{post_excerpt}}",
        title: "{{post_title}}",
        blocks: [
          { type: "paragraph", text: "{{post_excerpt}}" },
          {
            type: "paragraph",
            text: "We published it today on the Essentia blog. Read it at your own pace whenever you like.",
          },
          { type: "button", text: "Read the article", url: "{{post_url}}" },
        ],
      },
    },
  },
  {
    id: "event",
    kinds: ["standard"],
    content: {
      es: {
        subject: "Te invitamos: {{first_name}}, reserva la fecha",
        preheader: "Un encuentro en Essentia.",
        title: "Te invitamos",
        blocks: [
          { type: "image", url: "", alt: "" },
          {
            type: "paragraph",
            text: "**Qué**: nombre del encuentro.\n**Cuándo**: día y hora.\n**Dónde**: Essentia, Baobab Suites, Costa Adeje.",
          },
          {
            type: "paragraph",
            text: "Plazas limitadas. Confirma la tuya y te guardamos el sitio.",
          },
          { type: "button", text: "Confirmar asistencia", url: BOOKING_URL.es },
        ],
      },
      en: {
        subject: "You are invited: {{first_name}}, save the date",
        preheader: "A gathering at Essentia.",
        title: "You are invited",
        blocks: [
          { type: "image", url: "", alt: "" },
          {
            type: "paragraph",
            text: "**What**: name of the gathering.\n**When**: day and time.\n**Where**: Essentia, Baobab Suites, Costa Adeje.",
          },
          {
            type: "paragraph",
            text: "Places are limited. Confirm yours and we will keep you a seat.",
          },
          { type: "button", text: "Confirm attendance", url: BOOKING_URL.en },
        ],
      },
    },
  },
];

/** Templates that fit the kind first, the rest after. */
export function templatesFor(kind: CampaignKind): CampaignTemplate[] {
  return [...CAMPAIGN_TEMPLATES].sort(
    (a, b) => Number(b.kinds.includes(kind)) - Number(a.kinds.includes(kind)),
  );
}
