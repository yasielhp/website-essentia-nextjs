import { timingSafeEqual } from "node:crypto";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  bookableServices,
  manualTherapyTreatments,
} from "@/data/services-data";
import { getAvailableStartTimes } from "@/utils/calendar-helpers";
import { getAdminClient } from "@/lib/insforge-admin";

// ─── Helpers ──────────────────────────────────────────────────

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com";

type BusyInterval = { start: string; end: string };

const WRITE_SCOPE = "blog:write";

type ToolExtra = { authInfo?: { scopes: string[] } };

const text = (t: string, isError = false) => ({
  content: [{ type: "text" as const, text: t }],
  ...(isError ? { isError: true } : {}),
});

/** Write tools demand the bearer key; reads stay open. */
function writeDenied(extra: ToolExtra) {
  return extra.authInfo?.scopes.includes(WRITE_SCOPE)
    ? null
    : text(
        "Unauthorized: this tool needs the header `Authorization: Bearer <MCP_API_KEY>`.",
        true,
      );
}

function keyMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const slugSchema = (max: number) =>
  z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(max);

// ─── MCP handler ──────────────────────────────────────────────

const handler = createMcpHandler(
  (server) => {
    // ── Tool 1: list_services ──────────────────────────────────
    server.registerTool(
      "list_services",
      {
        title: "List Services",
        description:
          "List all available services and treatments at Essentia Wellness Club, including prices, durations, and descriptions.",
      },
      async () => {
        type ServiceEntry = {
          id: string;
          category: string;
          title: string;
          description: string;
          durations: string[];
          priceCenter?: string;
          priceSuite?: string;
        };

        const services: ServiceEntry[] = bookableServices.map((s) => ({
          id: s.id,
          category: s.category,
          title: s.title,
          description: s.description,
          durations: s.durations,
        }));

        const manualTreatments: ServiceEntry[] = manualTherapyTreatments.map(
          (t) => ({
            id: `manual-therapies:${t.id}`,
            category: "wellness",
            title: t.title,
            description: t.description,
            durations: t.durations,
            priceCenter: t.priceCenter,
            priceSuite: t.priceSuite,
          }),
        );

        const text = [...services, ...manualTreatments]
          .map((s) => {
            const price = s.priceCenter
              ? `Price: ${s.priceCenter} (at centre)${s.priceSuite ? ` / ${s.priceSuite} (in-suite)` : ""}`
              : "";
            return [
              `**${s.title}** (${s.category}) — ID: ${s.id}`,
              `Duration: ${s.durations.join(", ")}`,
              price,
              s.description,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n---\n\n");

        return { content: [{ type: "text" as const, text }] };
      },
    );

    // ── Tool 2: get_availability ───────────────────────────────
    server.registerTool(
      "get_availability",
      {
        title: "Get Availability",
        description:
          "Check available time slots for a specific service on a given date. Returns HH:MM time slots.",
        inputSchema: {
          service_id: z
            .string()
            .describe(
              "Service ID from list_services (e.g. 'contrast-therapy', 'manual-therapies')",
            ),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .describe("Date in YYYY-MM-DD format"),
          duration_minutes: z
            .number()
            .int()
            .positive()
            .optional()
            .describe(
              "Session duration in minutes — required for services with variable durations",
            ),
        },
      },
      async ({ service_id, date, duration_minutes }) => {
        try {
          const res = await fetch(
            `${siteUrl}/api/google/calendar/freebusy?service_id=${service_id}&date=${date}`,
          );

          if (!res.ok) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Could not fetch availability for ${service_id} on ${date}. Please call +34 634 09 12 95 or email info@essentiawellnessclub.com.`,
                },
              ],
            };
          }

          const { busy } = (await res.json()) as { busy: BusyInterval[] };

          const service = bookableServices.find((s) => s.id === service_id);
          const fallbackDuration = service
            ? parseInt(service.durations[0], 10) || 60
            : 60;
          const duration = duration_minutes ?? fallbackDuration;
          const available = getAvailableStartTimes(date, duration, busy ?? []);

          if (available.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No available slots for ${service_id} on ${date}. Please try a different date or contact us.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: `Available slots for ${service_id} on ${date} (${duration} min):\n\n${available.join(", ")}`,
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: "Unable to check availability. Please contact us at +34 634 09 12 95 or info@essentiawellnessclub.com.",
              },
            ],
          };
        }
      },
    );

    // ── Blog: categories and drafts ────────────────────────────
    // Writes only ever create drafts. Nothing here publishes: a person
    // reviews and publishes from /dashboard/blog. Images cannot be uploaded
    // through MCP; they are added from the post's page in the dashboard.
    server.registerTool(
      "list_blog_categories",
      {
        title: "List Blog Categories",
        description:
          "List the blog categories (id, English and Spanish name and slug). Use the id as category_id in create_blog_draft.",
      },
      async () => {
        const { data, error } = await getAdminClient()
          .database.from("blog_categories")
          .select("id, name, name_es, slug, slug_es")
          .order("name");
        if (error) return text("Could not read the categories.", true);
        return text(JSON.stringify(data ?? [], null, 2));
      },
    );

    server.registerTool(
      "create_blog_category",
      {
        title: "Create Blog Category",
        description:
          "Create a blog category. Requires the MCP API key. Slugs are lowercase-with-hyphens and unique.",
        inputSchema: {
          name: z.string().trim().min(1).max(80),
          name_es: z.string().trim().min(1).max(80),
          slug: slugSchema(80),
          slug_es: slugSchema(80),
        },
      },
      async (input, extra) => {
        const denied = writeDenied(extra as ToolExtra);
        if (denied) return denied;
        const { data, error } = await getAdminClient()
          .database.from("blog_categories")
          .insert(input)
          .select("id")
          .single();
        if (error || !data) {
          return text(
            `Could not create the category: ${error?.message ?? "unknown error"}`,
            true,
          );
        }
        return text(`Category created. id: ${data.id}`);
      },
    );

    server.registerTool(
      "create_blog_draft",
      {
        title: "Create Blog Draft",
        description:
          "Create a blog post as a DRAFT (never published) in English and Spanish. Requires the MCP API key. Returns the id and the dashboard URL where a person reviews, uploads the cover image (images cannot be uploaded through this tool; cover_image_url only accepts an already-hosted image) and publishes. Slugs are lowercase-with-hyphens and unique.",
        inputSchema: {
          title: z.string().trim().min(1).max(200),
          title_es: z.string().trim().min(1).max(200),
          slug: slugSchema(120),
          slug_es: slugSchema(120),
          excerpt: z.string().trim().min(1).max(500),
          excerpt_es: z.string().trim().min(1).max(500),
          content: z.string().trim().min(1).max(60000),
          content_es: z.string().trim().min(1).max(60000),
          category_id: z.string().uuid(),
          seo_title: z.string().trim().max(65),
          seo_description: z.string().trim().max(155),
          seo_title_es: z.string().trim().max(65),
          seo_description_es: z.string().trim().max(155),
          cover_image_url: z.string().url().max(1000).optional(),
        },
      },
      async (input, extra) => {
        const denied = writeDenied(extra as ToolExtra);
        if (denied) return denied;
        const { cover_image_url, ...rest } = input;
        const { data, error } = await getAdminClient()
          .database.from("blog_posts")
          .insert({
            ...rest,
            cover_image_url: cover_image_url ?? null,
            seo_og_image_url: cover_image_url ?? null,
            status: "draft",
            published_at: null,
            author_id: null,
          })
          .select("id")
          .single();
        if (error || !data) {
          return text(
            `Could not create the draft: ${error?.message ?? "unknown error"}`,
            true,
          );
        }
        return text(
          `Draft created (not published). id: ${data.id}\nReview: ${siteUrl}/dashboard/blog/${data.id}`,
        );
      },
    );

    server.registerTool(
      "list_blog_drafts",
      {
        title: "List Blog Drafts",
        description:
          "List the 20 most recent blog drafts. Requires the MCP API key: drafts are unpublished work.",
      },
      async (extra) => {
        const denied = writeDenied(extra as ToolExtra);
        if (denied) return denied;
        const { data, error } = await getAdminClient()
          .database.from("blog_posts")
          .select("id, title, slug, created_at")
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) return text("Could not read the drafts.", true);
        return text(JSON.stringify(data ?? [], null, 2));
      },
    );

    // Tool 3 was `create_booking`. Online booking is off while the studio is
    // between premises — only staff and partners book, from the dashboard — so
    // the tool is gone rather than left announced and refusing. The two tools
    // above are read-only; an agent now hands the person the contact page.
    // The old body is in git history for this file.
  },
  {
    // `basePath` and `maxDuration` were dropped in mcp-handler 2: the handler
    // is served wherever it is mounted, and each request is its own
    // invocation. The route is unchanged — `/api/mcp` — because the
    // `[transport]` segment still supplies the `mcp` part.
    verboseLogs: false,
  },
);

// Auth is optional at the transport: the read tools stay open to anyone.
// A request carrying the right key gets the `blog:write` scope, which the
// write tools check; a wrong or missing key just never gets it.
const authedHandler = withMcpAuth(
  handler,
  (_req, bearerToken) => {
    const expected = process.env.MCP_API_KEY;
    if (!expected || !bearerToken || !keyMatches(bearerToken, expected)) {
      return undefined;
    }
    return {
      token: bearerToken,
      clientId: "mcp-api-key",
      scopes: [WRITE_SCOPE],
    };
  },
  { required: false },
);

export { authedHandler as GET, authedHandler as POST };
