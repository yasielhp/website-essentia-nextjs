import {
  IconGrid,
  IconCalendar,
  IconMembers,
  IconFlag,
  IconBook,
  IconReceipt,
  IconUsers,
  IconBlog,
  IconMail,
} from "@/components/ui/icons";

/**
 * `key` indexes both `navIcons` and the `dashboard.nav.*` messages, so the
 * label can be translated without the icon lookup breaking.
 */
export const navLinks = [
  { key: "overview", href: "/dashboard" },
  { key: "bookings", href: "/dashboard/bookings" },
  { key: "users", href: "/dashboard/users" },
  { key: "subscriptions", href: "/dashboard/subscriptions" },
  { key: "transactions", href: "/dashboard/transactions" },
  { key: "races", href: "/dashboard/races" },
  { key: "education", href: "/dashboard/education" },
  { key: "blog", href: "/dashboard/blog" },
  { key: "campaigns", href: "/dashboard/campaigns" },
];

export const navIcons: Record<string, React.ReactNode> = {
  overview: <IconGrid />,
  bookings: <IconCalendar />,
  users: <IconUsers />,
  subscriptions: <IconMembers />,
  races: <IconFlag />,
  education: <IconBook />,
  blog: <IconBlog />,
  transactions: <IconReceipt />,
  campaigns: <IconMail />,
};
