"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  Users,
  Trophy,
  Menu,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload PDF", icon: Upload },
  { href: "/bancos", label: "Pacotes", icon: BookOpen },
  { href: "/alunos", label: "Usuários", icon: Users },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/pesquisas", label: "Pesquisas", icon: ClipboardList },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2 px-6 py-5">
      <img src="/logo.svg" alt="Kinase" className="h-8" />
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r border-border bg-[var(--sidebar-bg)] h-screen sticky top-0">
      <SidebarBrand />
      <Separator />
      <div className="mt-4 flex-1 overflow-y-auto">
        <NavLinks />
      </div>
      <div className="px-6 py-4 text-xs text-muted-foreground" suppressHydrationWarning>
        &copy; {new Date().getFullYear()} Kinase
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 w-9 lg:hidden cursor-pointer"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu de navegação</SheetTitle>
        </SheetHeader>
        <SidebarBrand />
        <Separator />
        <div className="mt-4">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
