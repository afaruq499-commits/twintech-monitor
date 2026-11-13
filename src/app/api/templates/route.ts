import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { workTemplateSchema } from "@/lib/validation/schemas";

export async function GET() {
  const templates = await prisma.workTemplate.findMany({
    include: {
      subScopes: {
        orderBy: { urutan: "asc" },
        include: {
          details: { orderBy: { urutan: "asc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = workTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data template tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const created = await prisma.workTemplate.create({
      data: {
        nama: d.nama,
        jenis: d.jenis,
        bolehParalel: d.bolehParalel,
        deskripsi: d.deskripsi || null,
        subScopes: {
          create: d.subScopes.map((ss, ssIdx) => ({
            urutan: ssIdx + 1,
            judul: ss.judul,
            details: {
              create: ss.details.map((teks, detIdx) => ({
                urutan: detIdx + 1,
                teks,
              })),
            },
          })),
        },
      },
    });
    return NextResponse.json({ template: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/templates error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan template pekerjaan." },
      { status: 500 }
    );
  }
}
