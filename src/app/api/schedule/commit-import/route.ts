import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fromIsoDateStr, todayIsoLocal } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

interface CommitImportTaskDetail {
  urutan: number;
  teks: string;
}

interface CommitImportSubScope {
  urutan: number;
  judul: string;
  details: CommitImportTaskDetail[];
}

interface CommitImportScheduleCell {
  tanggal: string; // YYYY-MM-DD
  status: string; // TARGET | ON_PROGRESS | DONE | DELAY
  warnaCustom?: string | null;
  catatan?: string | null;
  subScopeUrutan?: number | null;
}

interface CommitImportWorkItem {
  urutan: number;
  judul: string;
  jenis: string;
  pic?: string | null;
  deadline?: string | null;
  subScopes: CommitImportSubScope[];
  scheduleCells: CommitImportScheduleCell[];
}

interface CommitImportLane {
  laneNama: string;
  subjudul?: string;
  tanggalMulai: string; // YYYY-MM-DD
  jumlahHari: number;
  pic?: string | null;
  deadline?: string | null;
  workItems: CommitImportWorkItem[];
}

interface CommitImportPayload {
  targetMode: "NEW_PROJECT" | "EXISTING_PROJECT";
  existingProjectId?: string;
  newProject?: {
    kode?: string | null;
    nama: string;
    client: string;
    prioritas?: string;
    warna?: string;
    pic?: string | null;
    bolehParalel?: boolean;
    tanggalMulai?: string | null;
    deadline?: string | null;
  };
  lanes: CommitImportLane[];
  replaceExistingLanes?: boolean;
}

export async function POST(request: Request) {
  try {
    const body: CommitImportPayload = await request.json();

    if (!body || !Array.isArray(body.lanes) || body.lanes.length === 0) {
      return NextResponse.json(
        { error: "Data lane jadwal yang akan diimport tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (body.targetMode === "NEW_PROJECT") {
      if (!body.newProject?.nama?.trim()) {
        return NextResponse.json(
          { error: "Nama proyek baru wajib diisi." },
          { status: 400 }
        );
      }
    } else {
      if (!body.existingProjectId) {
        return NextResponse.json(
          { error: "Pilih proyek tujuan yang sudah ada terlebih dahulu." },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let projectId = body.existingProjectId ?? "";

      if (body.targetMode === "NEW_PROJECT") {
        const np = body.newProject!;
        const firstLaneDate = body.lanes[0]?.tanggalMulai || todayIsoLocal();

        const createdProject = await tx.project.create({
          data: {
            kode: np.kode?.trim() || null,
            nama: np.nama.trim(),
            client: np.client?.trim() || "Internal / Client",
            prioritas: np.prioritas || "SEDANG",
            warna: np.warna || "#2563eb",
            pic: np.pic?.trim() || null,
            status: "PLANNING",
            prStatus: "DRAFT",
            bolehParalel: !!np.bolehParalel,
            tanggalMulai: fromIsoDateStr(np.tanggalMulai || firstLaneDate),
            deadline: fromIsoDateStr(np.deadline),
          },
        });
        projectId = createdProject.id;
      } else {
        // Cek keberadaan proyek
        const proj = await tx.project.findUnique({
          where: { id: projectId },
        });
        if (!proj) {
          throw new Error("Proyek tujuan tidak ditemukan.");
        }
      }

      // Jika user memilih opsi hapus/gantikan lane yang ada
      if (body.replaceExistingLanes && body.targetMode === "EXISTING_PROJECT") {
        await tx.lane.deleteMany({
          where: { projectId },
        });
      }

      const existingLanesCount = await tx.lane.count({
        where: { projectId },
      });

      const createdLaneIds: string[] = [];

      for (let lIdx = 0; lIdx < body.lanes.length; lIdx++) {
        const l = body.lanes[lIdx];
        const jumlahHari = Math.max(1, l.jumlahHari || 6);

        const createdLane = await tx.lane.create({
          data: {
            projectId,
            urutan: existingLanesCount + lIdx + 1,
            nama: l.laneNama.trim() || `Lane ${existingLanesCount + lIdx + 1}`,
            subjudul: l.subjudul || "(Timeline Onsite & Commissioning)",
            tanggalMulai: fromIsoDateStr(l.tanggalMulai || todayIsoLocal())!,
            jumlahHari,
            pic: l.pic?.trim() || null,
            deadline: fromIsoDateStr(l.deadline),
          },
        });

        createdLaneIds.push(createdLane.id);

        for (let wiIdx = 0; wiIdx < l.workItems.length; wiIdx++) {
          const wi = l.workItems[wiIdx];

          const createdWi = await tx.workItem.create({
            data: {
              laneId: createdLane.id,
              urutan: wi.urutan || wiIdx + 1,
              judul: wi.judul.trim() || `Pekerjaan ${wiIdx + 1}`,
              jenis: wi.jenis || "COMMISSIONING",
              pic: wi.pic?.trim() || l.pic?.trim() || null,
              deadline: fromIsoDateStr(wi.deadline),
            },
          });

          // Simpan subScope dan simpan mapping urutan -> subScope.id
          const subScopeMap = new Map<number, string>();
          for (let ssIdx = 0; ssIdx < (wi.subScopes || []).length; ssIdx++) {
            const ss = wi.subScopes[ssIdx];
            const ssUrutan = ss.urutan || ssIdx + 1;
            const createdSs = await tx.subScope.create({
              data: {
                workItemId: createdWi.id,
                urutan: ssUrutan,
                judul: ss.judul || "-",
                details: {
                  create: (ss.details || []).map((det, detIdx) => ({
                    urutan: det.urutan || detIdx + 1,
                    teks: det.teks || "-",
                  })),
                },
              },
            });
            subScopeMap.set(ssUrutan, createdSs.id);
          }

          // Simpan scheduleCell dengan asosiasi subScopeId yang tepat
          for (const sc of wi.scheduleCells || []) {
            const assignedSubScopeId = sc.subScopeUrutan
              ? subScopeMap.get(sc.subScopeUrutan) || null
              : null;

            await tx.scheduleCell.create({
              data: {
                workItemId: createdWi.id,
                subScopeId: assignedSubScopeId,
                tanggal: fromIsoDateStr(sc.tanggal)!,
                status: sc.status || "TARGET",
                warnaCustom: sc.warnaCustom || null,
                catatan: sc.catatan?.trim() || null,
              },
            });
          }
        }
      }

      return {
        projectId,
        laneIds: createdLaneIds,
        firstLaneId: createdLaneIds[0] || null,
      };
    },
    {
      maxWait: 15000,
      timeout: 60000,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/schedule/commit-import error:", err);
    const msg =
      err instanceof Error ? err.message : "Gagal mengimpor schedule ke database.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
