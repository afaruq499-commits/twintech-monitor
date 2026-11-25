"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import type { CatalogComponentDTO } from "@/lib/catalog-queries";
import {
  searchCatalogComponents,
  splitHighlightSegments,
} from "@/lib/catalog-search";
import { formatRupiah } from "@/lib/date-utils";
import { formatCatalogItemForPr } from "@/lib/pr-catalog-default";

interface FloatingCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

export interface CatalogAutocompleteInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onSelectCatalogItem: (item: CatalogComponentDTO) => void;
  catalog: CatalogComponentDTO[];
  preferField: "partType" | "partName";
  placeholder?: string;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
  limit?: number;
}

export function HighlightedText({
  text,
  tokens,
}: {
  text: string;
  tokens: string[];
}) {
  const segments = useMemo(
    () => splitHighlightSegments(text, tokens),
    [text, tokens]
  );

  return (
    <>
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <mark
            key={i}
            className="bg-amber-200 text-slate-950 font-extrabold rounded-xs px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

export function CatalogAutocompleteInput({
  value,
  onChange,
  onSelectCatalogItem,
  catalog,
  preferField,
  placeholder,
  className = "",
  required,
  autoFocus,
  limit = 20,
}: CatalogAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [forceBrowseAll, setForceBrowseAll] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState<FloatingCoords | null>(null);

  const trimmedQuery = value.trim();

  const searchResult = useMemo(() => {
    return searchCatalogComponents(catalog, trimmedQuery, {
      limit,
      preferField,
    });
  }, [catalog, trimmedQuery, limit, preferField]);

  const { matches, totalMatches, tokens } = searchResult;

  const shouldShowPopup =
    isOpen &&
    catalog.length > 0 &&
    (trimmedQuery.length >= 1 || forceBrowseAll);

  const safeHighlightedIndex =
    matches.length > 0 ? Math.min(highlightedIndex, matches.length - 1) : 0;

  const updateCoords = useCallback(() => {
    const el = inputRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // Tutup jika input sudah di-scroll jauh keluar layar
    if (rect.bottom < -24 || rect.top > window.innerHeight + 24) {
      setIsOpen(false);
      return;
    }

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const desiredWidth = Math.min(Math.max(rect.width, 460), viewportW - 24);
    const left = Math.max(
      12,
      Math.min(rect.left, viewportW - desiredWidth - 12)
    );

    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    if (spaceBelow >= 230 || spaceBelow >= spaceAbove) {
      setCoords({
        top: rect.bottom + 6,
        left,
        width: desiredWidth,
        maxHeight: Math.min(310, Math.max(150, spaceBelow - 46)),
      });
    } else {
      setCoords({
        bottom: viewportH - rect.top + 6,
        left,
        width: desiredWidth,
        maxHeight: Math.min(310, Math.max(150, spaceAbove - 46)),
      });
    }
  }, []);

  // Sinkronkan posisi saat scroll horizontal/vertikal atau resize window
  useEffect(() => {
    if (!shouldShowPopup) return;
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [shouldShowPopup, updateCoords]);

  // Tutup saat klik di luar input & dropdown (aman saat user drag scrollbar dropdown)
  useEffect(() => {
    if (!shouldShowPopup) return;
    function handleOutsideMouseDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (inputRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
      setForceBrowseAll(false);
    }
    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
    };
  }, [shouldShowPopup]);

  // Pastikan opsi yang disorot keyboard selalu terlihat di dalam area scroll
  useEffect(() => {
    if (!shouldShowPopup || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-ac-idx="${safeHighlightedIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [safeHighlightedIndex, shouldShowPopup]);

  function openPopup(browseEvenIfEmpty = false) {
    updateCoords();
    setIsOpen(true);
    if (browseEvenIfEmpty) {
      setForceBrowseAll(true);
    }
  }

  function handleSelect(item: CatalogComponentDTO) {
    onSelectCatalogItem(item);
    setIsOpen(false);
    setForceBrowseAll(false);
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          if (value.trim().length >= 1) {
            setHighlightedIndex(0);
            openPopup(false);
          }
        }}
        onClick={() => {
          if (value.trim().length >= 1) {
            openPopup(false);
          }
        }}
        onChange={(e) => {
          const nextVal = e.target.value;
          onChange(nextVal);
          setHighlightedIndex(0);
          if (nextVal.trim().length >= 1) {
            openPopup(false);
          } else {
            setForceBrowseAll(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!shouldShowPopup) {
              setHighlightedIndex(0);
              openPopup(true);
            } else if (matches.length > 0) {
              setHighlightedIndex((prev) => (prev + 1) % matches.length);
            }
          } else if (e.key === "ArrowUp") {
            if (shouldShowPopup && matches.length > 0) {
              e.preventDefault();
              setHighlightedIndex(
                (prev) => (prev - 1 + matches.length) % matches.length
              );
            }
          } else if (e.key === "Enter") {
            if (shouldShowPopup && matches[safeHighlightedIndex]) {
              e.preventDefault();
              handleSelect(matches[safeHighlightedIndex]);
            }
          } else if (e.key === "Escape") {
            if (shouldShowPopup) {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
              setForceBrowseAll(false);
            }
          } else if (e.key === "Tab") {
            setIsOpen(false);
            setForceBrowseAll(false);
          }
        }}
        className={`${className} pr-7`}
      />

      {/* Tombol kecil pembuka daftar pilihan katalog */}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
          if (shouldShowPopup) {
            setIsOpen(false);
            setForceBrowseAll(false);
          } else {
            setHighlightedIndex(0);
            openPopup(true);
          }
        }}
        title="Lihat pilihan dari katalog komponen"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 cursor-pointer"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {shouldShowPopup &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              zIndex: 9999,
            }}
            className="rounded-xl bg-white border-2 border-blue-500/80 shadow-2xl overflow-hidden"
          >
            {/* Header Info Pencarian */}
            <div className="px-3 py-2 bg-slate-900 text-white flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold flex items-center gap-1.5 truncate">
                <Search className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                {trimmedQuery ? (
                  <span>
                    Pilihan untuk{" "}
                    <span className="text-amber-300">
                      &ldquo;{trimmedQuery}&rdquo;
                    </span>{" "}
                    ({totalMatches} cocok)
                  </span>
                ) : (
                  <span>
                    Daftar Katalog Komponen ({catalog.length} tersedia)
                  </span>
                )}
              </span>
              <span className="text-slate-300 shrink-0 hidden sm:inline">
                ↑↓ Pilih • Enter / Klik
              </span>
            </div>

            {/* Daftar Pilihan Sesuai Key Search */}
            {matches.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-slate-600 bg-slate-50">
                Tidak ada komponen di katalog yang cocok dengan{" "}
                <strong className="text-slate-900">
                  &ldquo;{trimmedQuery}&rdquo;
                </strong>
                . Silakan lanjut ketik manual (nanti bisa klik{" "}
                <em>Simpan ke Katalog</em>).
              </div>
            ) : (
              <div
                ref={listRef}
                style={{ maxHeight: coords.maxHeight }}
                className="overflow-y-auto divide-y divide-slate-100"
              >
                {matches.map((sug, idx) => {
                  const prFields = formatCatalogItemForPr(sug);
                  const isActive = idx === safeHighlightedIndex;

                  return (
                    <button
                      key={sug.id}
                      type="button"
                      data-ac-idx={idx}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(sug);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 transition cursor-pointer block ${
                        isActive
                          ? "bg-blue-50/95 ring-1 ring-inset ring-blue-200"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug">
                          {preferField === "partName" ? (
                            <HighlightedText
                              text={prFields.partName}
                              tokens={tokens}
                            />
                          ) : (
                            <HighlightedText
                              text={prFields.partType}
                              tokens={tokens}
                            />
                          )}
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[11px]">
                          {formatRupiah(sug.estimasiHarga)} / {prFields.unit}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-xs text-slate-700">
                        <span className="font-semibold">
                          {preferField === "partName" ? (
                            <HighlightedText
                              text={prFields.partType}
                              tokens={tokens}
                            />
                          ) : (
                            <HighlightedText
                              text={prFields.partName}
                              tokens={tokens}
                            />
                          )}
                        </span>
                        {prFields.merek && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                            <HighlightedText
                              text={prFields.merek}
                              tokens={tokens}
                            />
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                          <HighlightedText
                            text={sug.kategori}
                            tokens={tokens}
                          />
                        </span>
                      </div>

                      {sug.spesifikasi && (
                        <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                          <HighlightedText
                            text={sug.spesifikasi}
                            tokens={tokens}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
                {totalMatches > matches.length && (
                  <div className="px-3.5 py-2 text-[11px] text-center text-slate-500 bg-slate-50 font-semibold">
                    Menampilkan {matches.length} teratas dari {totalMatches}{" "}
                    komponen yang cocok — ketik lebih spesifik untuk
                    menyaring.
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
