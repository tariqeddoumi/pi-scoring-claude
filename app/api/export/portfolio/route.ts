import { portfolioCsv } from "@/server/export";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const csv = await portfolioCsv();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="portefeuille_pi_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return new Response(`Export indisponible: ${(e as Error).message}`, { status: 503 });
  }
}
