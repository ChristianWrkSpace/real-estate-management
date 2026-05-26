import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <main className="pb-28">{children}</main>
      <BottomNav
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
        }}
      />
    </div>
  );
}
