"use client";

export function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-petroleum-700 text-base font-semibold">
            {title}
          </h2>
          {description && (
            <p className="text-petroleum-400 mt-0.5 text-sm">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
