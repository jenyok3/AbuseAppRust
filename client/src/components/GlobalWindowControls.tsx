import { WindowControls } from "@/components/WindowControls";

type GlobalWindowControlsProps = {
  className?: string;
};

export function GlobalWindowControls({ className }: GlobalWindowControlsProps) {
  return (
    <>
      <WindowControls className={className} />
    </>
  );
}
