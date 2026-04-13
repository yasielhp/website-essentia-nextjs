import {
  IconFacebook,
  IconInstagram,
  IconYouTube,
} from "@/components/ui/icons";
import { env } from "process";

export const contact = {
  address: "Baobab Suites, Costa Adeje, Tenerife, Islas Canarias, España",
  phone: "+34 922 123 456",
  email: "info@essentiawellnessclub.com",
  domain: env.NEXT_PUBLIC_SITE_URL || "essentiawellnessclub.com",
  socialMedia: [
    {
      name: "Instagram",
      url: "https://www.instagram.com/essentia",
      icon: IconInstagram,
    },
    {
      name: "Facebook",
      url: "https://www.facebook.com/essentia",
      icon: IconFacebook,
    },
    {
      name: "Youtube",
      url: "https://www.youtube.com/essentia",
      icon: IconYouTube,
    },
  ],
};
