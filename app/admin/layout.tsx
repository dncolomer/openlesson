import { Navbar } from "@/components/Navbar";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminBackgroundStyle } from "@/components/admin/styles";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={adminBackgroundStyle}
    >
      <Navbar />
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
