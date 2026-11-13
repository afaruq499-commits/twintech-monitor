import { describe, expect, it } from "vitest";
import { isTanggalMerah, laneDatesIso } from "../src/lib/date-utils";

describe("isTanggalMerah", () => {
  it("mendeteksi hari Sabtu dan Minggu sebagai tanggal merah", () => {
    // 2026-10-31 adalah hari Sabtu
    const sabtu = isTanggalMerah("2026-10-31");
    expect(sabtu.isRed).toBe(true);
    expect(sabtu.isSaturday).toBe(true);
    expect(sabtu.isWeekend).toBe(true);
    expect(sabtu.keterangan).toContain("Sabtu");

    // 2026-11-01 adalah hari Minggu
    const res1 = isTanggalMerah("2026-11-01");
    expect(res1.isRed).toBe(true);
    expect(res1.isSunday).toBe(true);
    expect(res1.isWeekend).toBe(true);
    expect(res1.keterangan).toContain("Minggu");

    // 2026-11-07 adalah hari Sabtu
    const sabtu2 = isTanggalMerah("2026-11-07");
    expect(sabtu2.isRed).toBe(true);
    expect(sabtu2.isSaturday).toBe(true);

    // 2026-11-08 adalah hari Minggu
    const res2 = isTanggalMerah("2026-11-08");
    expect(res2.isRed).toBe(true);
    expect(res2.isSunday).toBe(true);
  });

  it("mendeteksi libur nasional tetap", () => {
    // 17 Agustus (Hari Kemerdekaan RI)
    const kemerdekaan = isTanggalMerah("2026-08-17");
    expect(kemerdekaan.isRed).toBe(true);
    expect(kemerdekaan.isHoliday).toBe(true);
    expect(kemerdekaan.keterangan).toContain("Kemerdekaan");

    // 1 Mei (Hari Buruh)
    const buruh = isTanggalMerah("2026-05-01");
    expect(buruh.isRed).toBe(true);
    expect(buruh.isHoliday).toBe(true);
    expect(buruh.keterangan).toContain("Buruh");

    // 25 Desember (Natal)
    const natal = isTanggalMerah("2026-12-25");
    expect(natal.isRed).toBe(true);
    expect(natal.isHoliday).toBe(true);
    expect(natal.keterangan).toContain("Natal");
  });

  it("mendeteksi libur nasional keagamaan / SKB (Idul Fitri, Nyepi, Waisak, dll)", () => {
    // Idul Fitri 2026: 2026-03-20
    const idulFitri = isTanggalMerah("2026-03-20");
    expect(idulFitri.isRed).toBe(true);
    expect(idulFitri.isHoliday).toBe(true);
    expect(idulFitri.keterangan).toContain("Idul Fitri");
  });

  it("hari kerja biasa bukan tanggal merah baik sebagai string maupun objek Date lokal", () => {
    // 2026-10-30 adalah hari Jumat biasa
    const jumat = isTanggalMerah("2026-10-30");
    expect(jumat.isRed).toBe(false);
    expect(jumat.isSunday).toBe(false);
    expect(jumat.isHoliday).toBe(false);

    // 2026-11-02 adalah hari Senin biasa (sebagai string)
    const seninStr = isTanggalMerah("2026-11-02");
    expect(seninStr.isRed).toBe(false);

    // 2026-11-02 adalah hari Senin biasa (sebagai Date object lokal dari FullCalendar)
    const seninDate = new Date(2026, 10, 2); // Bulan 10 = November di JS Date
    const seninRes = isTanggalMerah(seninDate);
    expect(seninRes.isRed).toBe(false);
    expect(seninRes.isSunday).toBe(false);
    expect(seninRes.isSaturday).toBe(false);

    // Hari Minggu sebagai Date object lokal tetap merah
    const mingguDate = new Date(2026, 10, 1);
    const mingguRes = isTanggalMerah(mingguDate);
    expect(mingguRes.isRed).toBe(true);
    expect(mingguRes.isSunday).toBe(true);

    // Hari Sabtu sebagai Date object lokal tetap merah
    const sabtuDate = new Date(2026, 9, 31);
    const sabtuRes = isTanggalMerah(sabtuDate);
    expect(sabtuRes.isRed).toBe(true);
    expect(sabtuRes.isSaturday).toBe(true);
  });

  it("laneDatesIso mendukung tanggal kustom per kolom day", () => {
    const dates = laneDatesIso("2026-10-29", 4, ["2026-10-29", "2026-11-02", "2026-11-05"]);
    expect(dates).toEqual(["2026-10-29", "2026-11-02", "2026-11-05", "2026-11-01"]);
  });
});
