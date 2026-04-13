import { IconChevronDown, IconWorld } from "@components/ui/icons";

export default function LanguageSelector() {
  return (
    <div className="border-petroleum-500 flex cursor-pointer gap-1 rounded-full border px-3 py-1 text-sm">
      <IconWorld />
      <span className="mt-0.5"> English</span>
      <IconChevronDown />
    </div>
  );
}
