import {
  IconGrid,
  IconCalendar,
  IconMembers,
  IconFlag,
  IconBook,
  IconReceipt,
  IconUsers,
  IconBlog,
  IconQuote,
} from "@/components/ui/icons";

export const navLinks = [
  { label: "Overview", href: "/dashboard" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Users", href: "/dashboard/users" },
  { label: "Subscriptions", href: "/dashboard/subscriptions" },
  { label: "Transactions", href: "/dashboard/transactions" },
  { label: "Reviews", href: "/dashboard/reviews" },
  { label: "Races", href: "/dashboard/races" },
  { label: "Education", href: "/dashboard/education" },
  { label: "Blog", href: "/dashboard/blog" },
];

export const navIcons: Record<string, React.ReactNode> = {
  Overview: <IconGrid />,
  Bookings: <IconCalendar />,
  Users: <IconUsers />,
  Subscriptions: <IconMembers />,
  Races: <IconFlag />,
  Education: <IconBook />,
  Blog: <IconBlog />,
  Transactions: <IconReceipt />,
  Reviews: <IconQuote />,
};
