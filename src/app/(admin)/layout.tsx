"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/upload": "Upload de PDF",
  "/bancos": "Pacotes",
  "/alunos": "Usuários",
  "/ranking": "Ranking",
  "/pesquisas": "Pesquisas",
  "/perfil": "Perfil",
};

function getTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return title;
    }
  }
  return "";
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = getTitle(pathname);

  return <AdminShell title={title}>{children}</AdminShell>;
}
