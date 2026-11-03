import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { revalidateBlogPaths } from "@/lib/blog-revalidate";
import { json, defineTool, fail, text, type ToolServer } from "@/lib/mcp/tool";
import { pagingShape, rangeOf, searchTerm } from "@/lib/mcp/paging";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.essentiawellnessclub.com";

const slugSchema = (max: number) =>
  z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(max);

/** The fields of a post that can be written, with their limits. Publishing is not among them. */
const postFields = {
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
  seo_og_image_url: z.string().url().max(1000),
  cover_image_url: z.string().url().max(1000),
};

const POST_COLUMNS =
  "id, title, title_es, slug, slug_es, excerpt, excerpt_es, content, content_es, category_id, status, published_at, created_at, updated_at, seo_title, seo_description, seo_title_es, seo_description_es, seo_og_image_url, cover_image_url";

const db = () => getAdminClient().database;

async function categoryExists(id: string): Promise<boolean> {
  const { data } = await db()
    .from("blog_categories")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return Boolean(data);
}

/** Whether another post already uses either slug (a slug can clash across languages too). */
async function slugTaken(
  slugs: string[],
  exceptId?: string,
): Promise<string | null> {
  for (const slug of slugs) {
    // The slugs are validated to `[a-z0-9-]`, so they are safe inside the filter.
    let query = db()
      .from("blog_posts")
      .select("id")
      .or(`slug.eq.${slug},slug_es.eq.${slug}`)
      .limit(1);
    if (exceptId) query = query.neq("id", exceptId);
    const { data } = await query;
    if (((data ?? []) as unknown[]).length > 0) return slug;
  }
  return null;
}

/**
 * The blog: read everything, write drafts and edits. Nothing here publishes —
 * `status` and `published_at` are not inputs anywhere — so a person always
 * reviews and publishes from /dashboard/blog. Images cannot be uploaded through
 * MCP; they are added from the post's page in the dashboard.
 */
export function registerBlogTools(server: ToolServer): void {
  defineTool(
    server,
    "list_blog_categories",
    {
      title: "List Blog Categories",
      description:
        "List the blog categories (id, English and Spanish name and slug). Use the id as category_id when creating or updating a post.",
    },
    async () => {
      const { data, error } = await db()
        .from("blog_categories")
        .select("id, name, name_es, slug, slug_es")
        .order("name");
      if (error) return fail("Could not read the categories.");
      return json(data ?? []);
    },
  );

  defineTool(
    server,
    "create_blog_category",
    {
      title: "Create Blog Category",
      description:
        "Create a blog category. Requires the blog:write scope. Slugs are lowercase-with-hyphens and unique.",
      needsWrite: true,
      inputSchema: {
        name: z.string().trim().min(1).max(80),
        name_es: z.string().trim().min(1).max(80),
        slug: slugSchema(80),
        slug_es: slugSchema(80),
      },
    },
    async (input) => {
      const { data, error } = await db()
        .from("blog_categories")
        .insert(input)
        .select("id")
        .single();
      if (error || !data) {
        return fail(
          `Could not create the category: ${error?.message ?? "unknown error"}`,
        );
      }
      revalidateBlogPaths();
      return text(`Category created. id: ${data.id}`);
    },
  );

  defineTool(
    server,
    "update_blog_category",
    {
      title: "Update Blog Category",
      description:
        "Change a blog category's name, Spanish name or slugs. Send only what changes. Requires the blog:write scope.",
      needsWrite: true,
      inputSchema: {
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        name_es: z.string().trim().min(1).max(80).optional(),
        slug: slugSchema(80).optional(),
        slug_es: slugSchema(80).optional(),
      },
    },
    async ({ id, ...changes }) => {
      if (Object.keys(changes).length === 0) {
        return fail("Nothing to change: send at least one field.");
      }
      const { data, error } = await db()
        .from("blog_categories")
        .update(changes)
        .eq("id", id)
        .select("id");
      if (error) return fail(`Could not update the category: ${error.message}`);
      if (((data ?? []) as unknown[]).length === 0) {
        return fail("No category has that id.");
      }
      revalidateBlogPaths();
      return text("Category updated.");
    },
  );

  defineTool(
    server,
    "list_blog_posts",
    {
      title: "List Blog Posts",
      description:
        "List blog posts, newest edit first: id, titles, slugs, status, category, published and updated dates. Filter by status (draft, published or all) and by a word in the title. Use get_blog_post for the full text.",
      inputSchema: {
        status: z.enum(["draft", "published", "all"]).default("all"),
        q: z.string().max(80).optional().describe("A word in either title."),
        ...pagingShape,
      },
    },
    async ({ status, q, limit, offset }) => {
      let query = db()
        .from("blog_posts")
        .select(
          "id, title, title_es, slug, slug_es, status, published_at, updated_at, category_id, blog_categories(name, name_es)",
        );
      if (status !== "all") query = query.eq("status", status);
      const term = q ? searchTerm(q) : "";
      if (term)
        query = query.or(`title.ilike.*${term}*,title_es.ilike.*${term}*`);
      const [from, to] = rangeOf(limit, offset);
      const { data, error } = await query
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) return fail("Could not read the posts.");
      return json(
        ((data ?? []) as unknown as Record<string, unknown>[]).map((p) => {
          const { blog_categories, ...rest } = p;
          return { ...rest, category: blog_categories };
        }),
      );
    },
  );

  defineTool(
    server,
    "get_blog_post",
    {
      title: "Get Blog Post",
      description:
        "Read one blog post completely — both languages, the body and the SEO fields — by id or by slug (English or Spanish).",
      inputSchema: {
        id: z.string().uuid().optional(),
        slug: slugSchema(120).optional(),
      },
    },
    async ({ id, slug }) => {
      if (!id && !slug) return fail("Give an id or a slug.");
      let query = db().from("blog_posts").select(POST_COLUMNS);
      query = id
        ? query.eq("id", id)
        : query.or(`slug.eq.${slug},slug_es.eq.${slug}`);
      const { data, error } = await query.limit(1);
      if (error) return fail("Could not read the post.");
      const post = ((data ?? []) as unknown[])[0];
      return post ? json(post) : fail("No post matches.");
    },
  );

  defineTool(
    server,
    "create_blog_draft",
    {
      title: "Create Blog Draft",
      description:
        "Create a blog post as a DRAFT (never published) in English and Spanish. Requires the blog:write scope. category_id must be an existing category. Returns the id and the dashboard URL where a person reviews, uploads the cover image (images cannot be uploaded through this tool; cover_image_url and seo_og_image_url only accept an already-hosted image) and publishes. Slugs are lowercase-with-hyphens and unique.",
      needsWrite: true,
      inputSchema: {
        ...postFields,
        seo_og_image_url: postFields.seo_og_image_url.optional(),
        cover_image_url: postFields.cover_image_url.optional(),
      },
    },
    async (input, auth) => {
      if (!(await categoryExists(input.category_id))) {
        return fail(
          "category_id does not match any category (see list_blog_categories).",
        );
      }
      const taken = await slugTaken([input.slug, input.slug_es]);
      if (taken)
        return fail(`The slug "${taken}" is already used by another post.`);

      const { cover_image_url, seo_og_image_url, ...rest } = input;
      const { data, error } = await db()
        .from("blog_posts")
        .insert({
          ...rest,
          cover_image_url: cover_image_url ?? null,
          seo_og_image_url: seo_og_image_url ?? cover_image_url ?? null,
          status: "draft",
          published_at: null,
          // The draft belongs to the person who connected the assistant.
          author_id: auth.userId,
        })
        .select("id")
        .single();
      if (error || !data) {
        return fail(
          `Could not create the draft: ${error?.message ?? "unknown error"}`,
        );
      }
      revalidateBlogPaths(input.slug, input.slug_es);
      return text(
        `Draft created (not published). id: ${data.id}\nReview: ${siteUrl}/dashboard/blog/${data.id}`,
      );
    },
  );

  defineTool(
    server,
    "update_blog_post",
    {
      title: "Update Blog Post",
      description:
        "Change fields of an existing post (draft or published). Send only what changes. It never publishes, unpublishes or changes the publication date: that stays a manual step in the dashboard. Requires the blog:write scope.",
      needsWrite: true,
      inputSchema: {
        id: z.string().uuid(),
        ...(Object.fromEntries(
          Object.entries(postFields).map(([k, v]) => [k, v.optional()]),
        ) as {
          [K in keyof typeof postFields]: z.ZodOptional<(typeof postFields)[K]>;
        }),
      },
    },
    async ({ id, ...changes }) => {
      const entries = Object.entries(changes).filter(
        ([, v]) => v !== undefined,
      );
      if (entries.length === 0) {
        return fail("Nothing to change: send at least one field.");
      }
      const patch = Object.fromEntries(entries) as Record<string, string>;

      const { data: existing } = await db()
        .from("blog_posts")
        .select("slug, slug_es")
        .eq("id", id)
        .maybeSingle();
      const before = existing as {
        slug: string;
        slug_es: string | null;
      } | null;
      if (!before) return fail("No post has that id.");

      if (patch.category_id && !(await categoryExists(patch.category_id))) {
        return fail(
          "category_id does not match any category (see list_blog_categories).",
        );
      }
      const slugs = [patch.slug, patch.slug_es].filter((s): s is string =>
        Boolean(s),
      );
      const taken = await slugTaken(slugs, id);
      if (taken)
        return fail(`The slug "${taken}" is already used by another post.`);

      const { error } = await db()
        .from("blog_posts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return fail(`Could not update the post: ${error.message}`);

      // Both the old addresses and the new ones: either may be cached.
      revalidateBlogPaths(before.slug, before.slug_es ?? undefined);
      if (patch.slug || patch.slug_es) {
        revalidateBlogPaths(
          patch.slug ?? before.slug,
          patch.slug_es ?? before.slug_es ?? undefined,
        );
      }
      return text(`Post updated. Review: ${siteUrl}/dashboard/blog/${id}`);
    },
  );

  defineTool(
    server,
    "list_blog_drafts",
    {
      title: "List Blog Drafts",
      description:
        "List the 20 most recent blog drafts. Requires the blog:write scope: drafts are unpublished work. For more, use list_blog_posts with status=draft.",
      needsWrite: true,
    },
    async () => {
      const { data, error } = await db()
        .from("blog_posts")
        .select("id, title, slug, created_at")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return fail("Could not read the drafts.");
      return json(data ?? []);
    },
  );
}
