"use client";

import { DesktopSidebar } from "./sidebar";
import { Header } from "./header";

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminShell({ children, title = "" }: AdminShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DesktopSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
