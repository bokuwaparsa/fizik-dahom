import { NextResponse } from "next/server";

// Static-friendly: this demo endpoint returns a fixed payload, so it can be
// prerendered during `STATIC_EXPORT=1 next build` (GitHub Pages) as well.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}