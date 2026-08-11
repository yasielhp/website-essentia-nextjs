"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { programs, type Program } from "./data";

// ─── ProgramCard ──────────────────────────────────────────────

function ProgramCard({ program }: { program: Program }) {
  const t = useTranslations("experiences.programs");
  const tCommon = useTranslations("common");
  const title = t(`${program.key}.title`);
  const description = t(`${program.key}.description`);
  const className = "group relative h-80 overflow-hidden rounded-2xl md:h-96";

  const inner = (
    <>
      <Image
        src={program.img}
        alt={title}
        fill
        sizes="(max-width: 767px) 100vw, 50vw"
        className={[
          "object-cover",
          program.comingSoon
            ? "grayscale-[40%]"
            : "transition-transform duration-500 group-hover:scale-105",
        ].join(" ")}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgb(9 33 33 / 0.92), rgb(9 33 33 / 0.3), transparent)",
        }}
      />
      {program.comingSoon && (
        <div className="absolute top-4 left-4">
          <span className="bg-sand-100/90 text-petroleum-700 rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
            {tCommon("comingSoon")}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 p-6">
        <h3 className="font-body text-xl text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {description}
        </p>
      </div>
    </>
  );

  if (program.comingSoon) {
    return (
      <div data-card className={className}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={program.href} data-card className={className}>
      {inner}
    </Link>
  );
}

// ─── ProgramsSection ──────────────────────────────────────────

export default function ProgramsSection() {
  const t = useTranslations("experiences.programs");

  return (
    <section id="programs" className="bg-sand-50">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:pt-32 md:pb-16">
          <div className="flex flex-col gap-8">
            {/* ── Header ── */}
            <div>
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("heading")}
              </h2>
              <p className="text-petroleum-400 mt-2 leading-relaxed">
                {t("subheading")}
              </p>
            </div>

            {/* ── Grid ── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {programs.map((p) => (
                <ProgramCard key={p.href} program={p} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
