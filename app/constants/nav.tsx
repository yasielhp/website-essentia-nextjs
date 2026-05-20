import {
  IconGrid,
  IconCalendar,
  IconMembers,
  IconFlag,
  IconBook,
  IconReceipt,
  IconUsers,
  IconBlog,
} from "@/components/ui/icons";

export const navLinks = [
  { label: "Overview", href: "/dashboard" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Users", href: "/dashboard/users" },
  { label: "Members", href: "/dashboard/members" },
  { label: "Transactions", href: "/dashboard/transactions" },
  { label: "Races", href: "/dashboard/races" },
  { label: "Education", href: "/dashboard/education" },
  { label: "Blog", href: "/dashboard/blog" },
];

export const navIcons: Record<string, React.ReactNode> = {
  Overview: <IconGrid />,
  Bookings: <IconCalendar />,
  Users: <IconUsers />,
  Members: <IconMembers />,
  Races: <IconFlag />,
  Education: <IconBook />,
  Blog: <IconBlog />,
  Transactions: <IconReceipt />,
};
