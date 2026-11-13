import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const laneId = typeof body?.laneId === "string" ? body.laneId : "";
    const templateId =
      typeof body?.templateId === "string" ? body.templateId : "";
    const customJudul =
      typeof body?.judul === "string" && body.judul.trim()
        ? body.judul.trim()
        : null;

    if (!laneId || !templateId) {
      return NextResponse.json(
        { error: "Pilih lane dan template pekerjaan." },
        { status: 400 }
      );
    }

    const tpl = await prisma.workTemplate.findUnique({
      where: { id: templateId },
      include: {
        subScopes: {
          orderBy: { urutan: "asc" },
          include: {
            details: { orderBy: { urutan: "asc" } },
          },
        },
      },
    });

    if (!tpl) {
      return NextResponse.json(
        { error: "Template pekerjaan tidak ditemukan." },
        { status: 404 }
      );
    }

    const count = await prisma.workItem.count({ where: { laneId } });
    const created = await prisma.workItem.create({
      data: {
        laneId,
        urutan: count + 1,
        judul: customJudul ?? tpl.nama,
        jenis: tpl.jenis,
        bolehParalel: tpl.bolehParalel,
        subScopes: {
          create: tpl.subScopes.map((ss) => ({
            urutan: ss.urutan,
            judul: ss.judul,
            details: {
              create: ss.details.map((d) => ({
                urutan: d.urutan,
                teks: d.teks,
              })),
            },
          })),
        },
      },
    });

    return NextResponse.json({ workItem: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/templates/apply error:", err);
    return NextResponse.json(
      { error: "Gagal menerapkan template ke lane." },
      { status: 500 }
    );
  }
}
