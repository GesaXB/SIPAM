import type { ReactNode } from "react";
import { SideNav } from "./side-nav";
import { logoutAction } from "@/lib/actions/session";
import type { Role, SessionUser } from "@/lib/auth";

const NAV: Record<Role, { href: string; label: string }[]> = {
  murid: [
    { href: "/murid", label: "Beranda" },
    { href: "/murid/presensi", label: "Presensi" },
    { href: "/murid/jadwal", label: "Jadwal" },
    { href: "/murid/tugas", label: "Tugas" },
    { href: "/murid/nilai", label: "Nilai" },
    { href: "/murid/pinjam", label: "Peminjaman" },
    { href: "/murid/notifikasi", label: "Pemberitahuan" },
  ],
  orangtua: [
    { href: "/orangtua", label: "Beranda" },
    { href: "/orangtua/presensi", label: "Presensi anak" },
    { href: "/orangtua/nilai", label: "Tugas dan nilai" },
    { href: "/orangtua/pesan", label: "Pesan sekolah" },
    { href: "/orangtua/catatan", label: "Catatan" },
    { href: "/orangtua/notifikasi", label: "Pemberitahuan" },
  ],
  guru: [
    { href: "/guru", label: "Beranda" },
    { href: "/guru/presensi", label: "Presensi kelas" },
    { href: "/guru/nilai", label: "Buku nilai" },
    { href: "/guru/pengumuman", label: "Catatan" },
    { href: "/guru/pesan", label: "Pesan orang tua" },
    { href: "/guru/notifikasi", label: "Pemberitahuan" },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  murid: "Murid",
  orangtua: "Orang tua",
  guru: "Guru",
};

export function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="border-b border-line bg-leaf-deep text-paper md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-4 py-4 md:px-5 md:py-6">
          <span className="grid h-10 w-10 place-items-center border border-paper/40 font-serif text-lg">SP</span>
          <div>
            <p className="font-serif text-xl leading-none">SIPAM</p>
            <p className="mt-1 text-xs text-paper/70">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <SideNav items={NAV[user.role]} />
        <div className="hidden px-4 py-5 md:block">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="mt-1 text-xs text-paper/70">{user.email}</p>
          <form action={logoutAction} className="mt-4">
            <button className="text-sm underline decoration-paper/40 underline-offset-4" type="submit">
              Keluar
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <p className="text-sm">{user.name}</p>
          <form action={logoutAction}>
            <button className="text-sm underline underline-offset-4" type="submit">
              Keluar
            </button>
          </form>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6 border-b border-brass/50 pb-4">
      <p className="text-xs font-medium tracking-[0.14em] text-brass uppercase">{kicker}</p>
      <h1 className="mt-1 font-serif text-3xl leading-tight text-ink">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{description}</p> : null}
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`border border-line bg-raised ${className}`}>{children}</section>;
}

const STATUS_CLASS = {
  hadir: "bg-leaf text-paper",
  izin: "bg-brass text-paper",
  sakit: "bg-sick text-paper",
  alpa: "bg-stamp text-paper",
} as const;

export function StatusMark({ status }: { status: keyof typeof STATUS_CLASS | null }) {
  if (!status) {
    return <span className="border border-line px-2 py-1 text-xs text-ink-soft">Belum</span>;
  }
  return <span className={`px-2 py-1 text-xs font-medium uppercase ${STATUS_CLASS[status]}`}>{status}</span>;
}
