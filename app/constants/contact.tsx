import { IconFacebook, IconInstagram } from "@/components/ui/icons";
/**
 * Reception hours, in 24-hour time. Kept next to the rest of the contact
 * details so the page copy and the `openingHoursSpecification` in the
 * site layout's schema.org graph cannot drift apart.
 */
export const OPENING_HOURS = { opens: "08:00", closes: "17:00" };

export const contact = {
  address: "Rambla de Santa Cruz, 83, 38004 Santa Cruz de Tenerife",
  /** Google Maps search for `address`; swap for the short share link once the listing exists. */
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Rambla+de+Santa+Cruz+83%2C+38004+Santa+Cruz+de+Tenerife",
  phone: "+34 634 09 12 95",
  email: "info@essentiawellnessclub.com",
  domain: "www.essentiawellnessclub.com",
  socialMedia: [
    {
      name: "Instagram",
      url: "https://www.instagram.com/essentiamassage",
      icon: IconInstagram,
    },
    {
      name: "Facebook",
      url: "https://www.facebook.com/essentia",
      icon: IconFacebook,
    },
  ],
};
