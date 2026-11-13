import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr } from "@/lib/date-utils";
import { workItemSchema } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = workItemSchema.omit({ laneId: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data pekerjaan tidak valid" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Ambil sub-scopes dan details yang ada saat ini
      const existingSubScopes = await tx.subScope.findMany({
        where: { workItemId: id },
        orderBy: { urutan: "asc" },
        include: {
          details: {
            orderBy: { urutan: "asc" },
          },
        },
      });

      // 2. Perbarui sub-scopes secara in-place agar ID tidak berubah
      // sehingga ScheduleCell (warna pada kalender) tetap terhubung & tidak kena foreign key error!
      const newSubScopesInput = d.subScopes;

      for (let i = 0; i < newSubScopesInput.length; i++) {
        const inputSs = newSubScopesInput[i];
        const existingSs = existingSubScopes[i];

        if (existingSs) {
          // Update SubScope yang sudah ada
          await tx.subScope.update({
            where: { id: existingSs.id },
            data: {
              urutan: i + 1,
              judul: inputSs.judul,
            },
          });

          // Update TaskDetail di bawah SubScope ini
          const existingDetails = existingSs.details;
          const inputDetails = inputSs.details;

          for (let j = 0; j < inputDetails.length; j++) {
            const inputTeks = inputDetails[j];
            const existingDet = existingDetails[j];

            if (existingDet) {
              // Update detail yang sudah ada
              await tx.taskDetail.update({
                where: { id: existingDet.id },
                data: {
                  urutan: j + 1,
                  teks: inputTeks,
                },
              });
            } else {
              // Tambah detail baru
              await tx.taskDetail.create({
                data: {
                  subScopeId: existingSs.id,
                  urutan: j + 1,
                  teks: inputTeks,
                },
              });
            }
          }

          // Jika ada detail lama yang dihapus oleh user:
          if (existingDetails.length > inputDetails.length) {
            const surplusDetails = existingDetails.slice(inputDetails.length);
            const surplusDetIds = surplusDetails.map((det) => det.id);

            // Bersihkan relasi di ScheduleCell sebelum menghapus detail
            await tx.scheduleCell.deleteMany({
              where: { taskDetailId: { in: surplusDetIds } },
            });
            await tx.taskDetail.deleteMany({
              where: { id: { in: surplusDetIds } },
            });
          }
        } else {
          // Buat SubScope baru jika jumlah subScope bertambah
          await tx.subScope.create({
            data: {
              workItemId: id,
              urutan: i + 1,
              judul: inputSs.judul,
              details: {
                create: inputSs.details.map((teks, detIdx) => ({
                  urutan: detIdx + 1,
                  teks,
                })),
              },
            },
          });
        }
      }

      // Jika ada SubScope lama yang dihapus oleh user:
      if (existingSubScopes.length > newSubScopesInput.length) {
        const surplusSubScopes = existingSubScopes.slice(newSubScopesInput.length);
        const surplusSsIds = surplusSubScopes.map((ss) => ss.id);
        const surplusDetIds = surplusSubScopes.flatMap((ss) =>
          ss.details.map((d) => d.id)
        );

        // Bersihkan ScheduleCell terkait sebelum menghapus sub-scope
        if (surplusDetIds.length > 0) {
          await tx.scheduleCell.deleteMany({
            where: { taskDetailId: { in: surplusDetIds } },
          });
          await tx.taskDetail.deleteMany({
            where: { id: { in: surplusDetIds } },
          });
        }
        await tx.scheduleCell.deleteMany({
          where: { subScopeId: { in: surplusSsIds } },
        });
        await tx.subScope.deleteMany({
          where: { id: { in: surplusSsIds } },
        });
      }

      // 3. Perbarui komponen terkait
      await tx.workItemComponent.deleteMany({ where: { workItemId: id } });
      if (d.componentIds.length > 0) {
        await tx.workItemComponent.createMany({
          data: d.componentIds.map((componentId) => ({
            workItemId: id,
            componentId,
          })),
        });
      }

      // 4. Perbarui data utama WorkItem
      return tx.workItem.update({
        where: { id },
        data: {
          judul: d.judul,
          jenis: d.jenis,
          bolehParalel: d.bolehParalel,
          pic: d.pic || null,
          deadline: fromIsoDateStr(d.deadline),
        },
      });
    });

    return NextResponse.json({ workItem: updated });
  } catch (err) {
    console.error("PATCH /api/work-items/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui pekerjaan: " + (err instanceof Error ? err.message : String(err)) },
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
    await prisma.$transaction(async (tx) => {
      await tx.scheduleCell.deleteMany({ where: { workItemId: id } });
      await tx.workItemComponent.deleteMany({ where: { workItemId: id } });
      await tx.taskDetail.deleteMany({ where: { subScope: { workItemId: id } } });
      await tx.subScope.deleteMany({ where: { workItemId: id } });
      await tx.workItem.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/work-items/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus pekerjaan: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
