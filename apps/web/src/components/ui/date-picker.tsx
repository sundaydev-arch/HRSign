"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Inclusive upper bound for selectable days (yyyy-MM-dd). */
  max?: string;
  /** Inclusive lower bound for selectable days (yyyy-MM-dd). */
  min?: string;
}

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

/** Popover calendar that stores `yyyy-MM-dd` strings (API-friendly). */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  clearLabel,
  disabled,
  className,
  max,
  min,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseYmd(value);
  const maxDate = parseYmd(max ?? "");
  const minDate = parseYmd(min ?? "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 font-normal shadow-sm hover:bg-card",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-50" />
          <span className="truncate">{selected ? format(selected, "yyyy-MM-dd") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={
            minDate || maxDate
              ? [
                  ...(minDate ? [{ before: minDate }] : []),
                  ...(maxDate ? [{ after: maxDate }] : []),
                ]
              : undefined
          }
          onSelect={(day) => {
            onChange(day ? format(day, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
        />
        {value && clearLabel ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {clearLabel}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
