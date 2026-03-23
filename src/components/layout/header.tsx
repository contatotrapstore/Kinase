"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MobileSidebar } from "./sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, LogOut } from "lucide-react";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [initials, setInitials] = useState("...");
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        const localPart = user.email.split("@")[0];
        setInitials(localPart.slice(0, 2).toUpperCase());
      }
    };
    fetchUser();
  }, [supabase]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      await supabase.auth.signOut();
      window.location.replace("/login");
    } catch (error) {
      console.error("Erro ao sair:", error);
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card px-4 sm:px-6">
      <MobileSidebar />

      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="ml-auto relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-popover p-1 shadow-md z-50">
            {userEmail && (
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            )}
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push("/perfil");
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <User className="h-4 w-4" />
              Perfil
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
