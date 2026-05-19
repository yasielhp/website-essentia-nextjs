import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";
import { bookableServices } from "@/data/services-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("service_id");

  if (!serviceId) {
    return NextResponse.json(
      { error: "Missing service_id parameter" },
      { status: 400 },
    );
  }

  // Validate that the service exists
  const serviceExists = bookableServices.some((s) => s.id === serviceId);
  if (!serviceExists) {
    return NextResponse.json(
      { error: `Unknown service: ${serviceId}` },
      { status: 400 },
    );
  }

  // TODO: Add admin session verification here before allowing OAuth flow

  const authUrl = getGoogleAuthUrl(serviceId);
  return NextResponse.redirect(authUrl);
}
