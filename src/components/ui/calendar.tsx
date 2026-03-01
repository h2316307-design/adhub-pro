import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker";
import { format, setMonth, setYear } from "date-fns";
import { ar } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useNavigation();

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2024, i, 1);
    return { value: i.toString(), label: format(date, "LLLL", { locale: ar }) };
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => {
    const year = currentYear - 5 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const handleMonthChange = (value: string) => {
    const newDate = setMonth(displayMonth, parseInt(value));
    goToMonth(newDate);
  };

  const handleYearChange = (value: string) => {
    const newDate = setYear(displayMonth, parseInt(value));
    goToMonth(newDate);
  };

  return (
    <div className="flex items-center justify-between gap-1.5 px-1">
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 p-0 opacity-60 hover:opacity-100 shrink-0"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-1 flex-1 justify-center">
        <Select
          value={displayMonth.getMonth().toString()}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="h-7 w-auto min-w-[80px] text-xs font-semibold border-border/50 shadow-none focus:ring-1 focus:ring-primary/30 px-2 gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="pointer-events-auto max-h-60">
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value} className="text-xs">
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={displayMonth.getFullYear().toString()}
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="h-7 w-[72px] text-xs font-semibold border-border/50 shadow-none focus:ring-1 focus:ring-primary/30 px-2 gap-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="pointer-events-auto max-h-60">
            {years.map((year) => (
              <SelectItem key={year.value} value={year.value} className="text-xs">
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 p-0 opacity-60 hover:opacity-100 shrink-0"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaultMonth = props.defaultMonth || 
    (props.mode === "single" && (props as any).selected instanceof Date 
      ? (props as any).selected 
      : undefined);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      defaultMonth={defaultMonth}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
