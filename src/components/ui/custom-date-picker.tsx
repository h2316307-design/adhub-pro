import * as React from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
  className,
  disabled = false,
}: CustomDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  const selectedDate = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-10 justify-start text-right font-medium rounded-lg border-2 border-border hover:border-primary/50 bg-background transition-all duration-200",
            !value && "text-muted-foreground",
            "hover:bg-accent/5",
            className
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4 text-primary shrink-0" />
          <span className="truncate">
            {value
              ? format(new Date(value), "dd MMMM yyyy", { locale: ar })
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-2 border-border shadow-2xl bg-popover z-[10000]"
        align="start"
        sideOffset={4}
      >
        <div className="p-1">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={ar}
            className="rounded-lg pointer-events-auto"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-semibold",
              nav: "space-x-1 flex items-center",
              nav_button: cn(
                "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-accent rounded-lg transition-all"
              ),
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-muted-foreground rounded-md w-9 font-medium text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: cn(
                "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-lg transition-all duration-200",
                "hover:bg-primary/20 hover:text-primary"
              ),
              day_range_end: "day-range-end",
              day_selected:
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-lg",
              day_today: "bg-accent text-accent-foreground font-bold ring-2 ring-primary/30",
              day_outside:
                "day-outside text-muted-foreground/40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
              day_disabled: "text-muted-foreground/30",
              day_range_middle:
                "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
