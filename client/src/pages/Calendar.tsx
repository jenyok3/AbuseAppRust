import InteractiveCalendar from "@/components/ui/visualize-booking";

export default function Calendar() {
  return (
    <div className="flex-1 min-h-0 overflow-hidden relative font-body text-white">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 h-full overflow-y-auto smooth-scroll custom-scrollbar px-3 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl py-4 lg:py-6">
          <InteractiveCalendar />
        </div>
      </main>
    </div>
  );
}
