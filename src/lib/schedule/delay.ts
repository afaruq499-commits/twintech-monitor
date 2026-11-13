import type { ScheduleCellStatus } from "@/lib/constants";

export interface DelayCandidateCell {
  id: string;
  workItemId: string;
  workItemJudul: string;
  laneId: string;
  laneNama: string;
  projectId: string;
  projectNama: string;
  tanggal: string; // YYYY-MM-DD
  status: ScheduleCellStatus;
  delayDikonfirmasi: boolean;
}

/**
 * Cari sel jadwal yang tanggalnya sudah lewat (< todayIso) namun status masih TARGET atau ON_PROGRESS
 * dan belum diabaikan/dikonfirmasi user.
 */
export function findProposedDelays(
  cells: DelayCandidateCell[],
  todayIso: string
): DelayCandidateCell[] {
  return cells
    .filter(
      (c) =>
        c.tanggal < todayIso &&
        (c.status === "TARGET" || c.status === "ON_PROGRESS") &&
        !c.delayDikonfirmasi
    )
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}
