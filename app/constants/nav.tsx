import {
  IconGrid,
  IconCalendar,
  IconContacts,
  IconMembers,
  IconFlag,
  IconBook,
  IconReceipt,
  IconSettings,
} from "@/components/ui/icons";

export const navLinks = [
  { label: "Overview", href: "/dashboard" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Contacts", href: "/dashboard/contacts" },
  { label: "Members", href: "/dashboard/members" },
  { label: "Races", href: "/dashboard/races" },
  { label: "Education", href: "/dashboard/education" },
  { label: "Transactions", href: "/dashboard/transactions" },
  { label: "Settings", href: "/dashboard/settings" },
];

export const navIcons: Record<string, React.ReactNode> = {
  Overview: <IconGrid />,
  Bookings: <IconCalendar />,
  Contacts: <IconContacts />,
  Members: <IconMembers />,
  Races: <IconFlag />,
  Education: <IconBook />,
  Transactions: <IconReceipt />,
  Settings: <IconSettings />,
};
