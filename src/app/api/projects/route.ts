import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { getProjectsOverview } from "@/lib/data-queries";
import { projectSchema } from "@/lib/validation/schemas";

export async function GET() {
  const projects = await getProjectsOverview();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data proyek tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const created = await prisma.project.create({
      data: {
        kode: d.kode,
        nama: d.nama,
        client: d.client,
        komponenInti: d.komponenInti || null,
        deskripsi: d.deskripsi || null,
        tanggalMulai: fromIsoDateStr(d.tanggalMulai),
        deadline: fromIsoDateStr(d.deadline),
        prioritas: d.prioritas,
        tipeProyek: d.tipeProyek,
        status: d.status,
        prStatus: d.prStatus,
        catatan: d.catatan || null,
        pic: d.pic || null,
        bolehParalel: d.bolehParalel,
        warna: d.warna,
      },
    });
    return NextResponse.json({ project: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan proyek baru." },
      { status: 500 }
    );
  }
}
