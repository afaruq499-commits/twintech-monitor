import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { projectSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = projectSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(d.kode !== undefined ? { kode: d.kode } : {}),
        ...(d.nama !== undefined ? { nama: d.nama } : {}),
        ...(d.client !== undefined ? { client: d.client } : {}),
        ...(d.komponenInti !== undefined
          ? { komponenInti: d.komponenInti || null }
          : {}),
        ...(d.deskripsi !== undefined ? { deskripsi: d.deskripsi || null } : {}),
        ...(d.tanggalMulai !== undefined
          ? { tanggalMulai: fromIsoDateStr(d.tanggalMulai) }
          : {}),
        ...(d.deadline !== undefined
          ? { deadline: fromIsoDateStr(d.deadline) }
          : {}),
        ...(d.prioritas !== undefined ? { prioritas: d.prioritas } : {}),
        ...(d.tipeProyek !== undefined ? { tipeProyek: d.tipeProyek } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.prStatus !== undefined ? { prStatus: d.prStatus } : {}),
        ...(d.catatan !== undefined ? { catatan: d.catatan || null } : {}),
        ...(d.pic !== undefined ? { pic: d.pic || null } : {}),
        ...(d.bolehParalel !== undefined ? { bolehParalel: d.bolehParalel } : {}),
        ...(d.warna !== undefined ? { warna: d.warna } : {}),
        ...(d.plcAddressesJson !== undefined
          ? { plcAddressesJson: d.plcAddressesJson || null }
          : {}),
        ...(d.gambarUrl !== undefined
          ? { gambarUrl: d.gambarUrl || null }
          : {}),
        ...(d.flowSequenceJson !== undefined
          ? { flowSequenceJson: d.flowSequenceJson || null }
          : {}),
        ...(d.wiringDiagramPdfUrl !== undefined
          ? { wiringDiagramPdfUrl: d.wiringDiagramPdfUrl || null }
          : {}),
        ...(d.wiringDiagramPdfName !== undefined
          ? { wiringDiagramPdfName: d.wiringDiagramPdfName || null }
          : {}),
        ...(d.plcProgramFileUrl !== undefined
          ? { plcProgramFileUrl: d.plcProgramFileUrl || null }
          : {}),
        ...(d.plcProgramFileName !== undefined
          ? { plcProgramFileName: d.plcProgramFileName || null }
          : {}),
        ...(d.plcProgramFileSize !== undefined
          ? { plcProgramFileSize: d.plcProgramFileSize ?? null }
          : {}),
        ...(d.hmiProgramFileUrl !== undefined
          ? { hmiProgramFileUrl: d.hmiProgramFileUrl || null }
          : {}),
        ...(d.hmiProgramFileName !== undefined
          ? { hmiProgramFileName: d.hmiProgramFileName || null }
          : {}),
        ...(d.hmiProgramFileSize !== undefined
          ? { hmiProgramFileSize: d.hmiProgramFileSize ?? null }
          : {}),
        ...(d.panelLayoutJson !== undefined
          ? { panelLayoutJson: d.panelLayoutJson || null }
          : {}),
        ...(d.fileChecklistJson !== undefined
          ? { fileChecklistJson: d.fileChecklistJson || null }
          : {}),
      },
    });

    return NextResponse.json({ project: updated });
  } catch (err) {
    console.error("PATCH /api/projects/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui proyek." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    // Hapus WorkItemComponent lebih dulu karena NoAction FK pada Component di SQL Server
    await prisma.$transaction([
      prisma.workItemComponent.deleteMany({
        where: { component: { projectId: id } },
      }),
      prisma.project.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus proyek." },
      { status: 500 }
    );
  }
}
