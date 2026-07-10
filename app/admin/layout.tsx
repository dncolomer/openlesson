import { Navbar } from "@/components/Navbar";
import { AdminShell } from "@/components/admin/AdminShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Navbar />
      <AdminShell>{children}</AdminShell>
    </div>
  );
}