import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs text-muted-foreground">From</Label>
      <Input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className={`h-9 w-[145px] ${!from ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
      />
      <Label className="text-xs text-muted-foreground">To</Label>
      <Input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className={`h-9 w-[145px] ${!to ? "[&::-webkit-datetime-edit]:text-transparent" : ""}`}
      />
    </div>
  );
}