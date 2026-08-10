"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { ImageUpload } from "@/components/ui/image-upload";
import type { PageAction } from "./form-state";

type SidebarCardProps = {
  loading: boolean;
  imageUrl: string;
  dispatch: Dispatch<PageAction>;
};

export function SidebarCard({ loading, imageUrl, dispatch }: SidebarCardProps) {
  const t = useTranslations("dashboard.education.form");
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.coverImage")}
      </h2>
      {loading ? (
        <div className="bg-sand-100 h-36 animate-pulse rounded-xl" />
      ) : (
        <ImageUpload
          bucket="events"
          folder="education"
          value={imageUrl}
          onChange={(value) => dispatch({ type: "SET_IMAGE_URL", value })}
        />
      )}
    </div>
  );
}
