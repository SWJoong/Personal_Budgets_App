import { TabBar } from "@/components/layout/TabBar";

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* pb-20 ensures content is not hidden behind the fixed TabBar */}
      <main className="flex-1">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
