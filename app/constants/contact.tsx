import { IconFacebook, IconInstagram } from "@/components/ui/icons";
/**
 * Reception hours, in 24-hour time. Kept next to the rest of the contact
 * details so the page copy and the `openingHoursSpecification` in the
 * site layout's schema.org graph cannot drift apart.
 */
export const OPENING_HOURS = { opens: "08:00", closes: "17:00" };

export const contact = {
  address: "C. Roques del Salmor, 5, 38679 Costa Adeje, Tenerife, España",
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
