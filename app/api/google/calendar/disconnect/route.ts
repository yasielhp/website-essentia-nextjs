import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");

  if (!serviceId) {
    return NextResponse.json(
      { error: "Missing service_id parameter" },
      { status: 400 },
    );
  }

  // TODO: Verify admin session before allowing disconnect

  try {
    const adminClient = getAdminClient();
    const { error } = await adminClient.database
      .from("service_configs")
      .delete()
      .eq("service_id", serviceId);

    if (error) {
      console.error("[google/calendar/disconnect] DB error:", error);
      return NextResponse.json(
        { error: "Failed to disconnect calendar" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[google/calendar/disconnect] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
