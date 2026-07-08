import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUT_PROGRESSION, STATUT_LABEL } from "@/components/status-badge";

export function StatusStepper({ statut }: { statut: string }) {
  const currentIdx = Math.max(0, STATUT_PROGRESSION.indexOf(statut));
  const total = STATUT_PROGRESSION.length;
  const lastIdx = total - 1;

  return (
    <div className="space-y-4">
      {/* Horizontal stepper — md+ */}
      <ol className="hidden md:flex items-start gap-1 overflow-x-auto">
        {STATUT_PROGRESSION.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "todo";
          const isPublish = i === lastIdx;
          const doneColor = isPublish ? "#22C55E" : "#C8922A";
          const currentColor = isPublish ? "#4ADE80" : "#E8B84B";
          const textDone = isPublish ? "text-green-500" : "text-[#C8922A]";
          const textCurrent = isPublish ? "text-green-400" : "text-[#E8B84B]";
          return (
            <li key={s} className="flex-1 flex flex-col items-center min-w-[64px]">
              <div className="flex items-center w-full">
                {/* left connector */}
                <span
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    i === 0 ? "opacity-0" : "",
                  )}
                  style={i <= currentIdx && i !== 0 ? { backgroundColor: doneColor } : { backgroundColor: "#1E3A5F" }}
                />
                <Circle state={state} isPublish={isPublish} />
                {/* right connector */}
                <span
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    i === total - 1 ? "opacity-0" : i < currentIdx ? `bg-[${doneColor}]` : "bg-[#1E3A5F]",
                  )}
                  style={i < currentIdx ? { backgroundColor: doneColor } : undefined}
                />
              </div>
              <span
                className={cn(
                  "mt-2 text-[11px] text-center leading-tight px-1 transition-colors",
                  state === "done" && `${textDone} font-medium`,
                  state === "current" && `${textCurrent} font-semibold`,
                  state === "todo" && "text-muted-foreground",
                )}
              >
                {STATUT_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Vertical stepper — mobile */}
      <ol className="md:hidden space-y-0">
        {STATUT_PROGRESSION.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "todo";
          const isPublish = i === lastIdx;
          const doneColor = isPublish ? "#22C55E" : "#C8922A";
          const currentColor = isPublish ? "#4ADE80" : "#E8B84B";
          const textDone = isPublish ? "text-green-500" : "text-[#C8922A]";
          const textCurrent = isPublish ? "text-green-400" : "text-[#E8B84B]";
          return (
            <li key={s} className="flex gap-3 items-start">
              <div className="flex flex-col items-center">
                <Circle state={state} isPublish={isPublish} />
                {i < total - 1 && (
                  <span
                    className={cn(
                      "w-0.5 flex-1 min-h-[24px] my-1 transition-colors",
                    )}
                    style={{ backgroundColor: i < currentIdx ? doneColor : "#1E3A5F" }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "pt-1 pb-4 text-sm transition-colors",
                  state === "done" && `${textDone} font-medium`,
                  state === "current" && `${textCurrent} font-semibold`,
                  state === "todo" && "text-muted-foreground",
                )}
              >
                {STATUT_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-center text-muted-foreground">
        Étape <span className="text-[#E8B84B] font-semibold">{currentIdx + 1}</span> sur {total}
      </p>
    </div>
  );
}

function Circle({ state, isPublish }: { state: "done" | "current" | "todo"; isPublish?: boolean }) {
  const doneColor = isPublish ? "#22C55E" : "#C8922A";
  const currentColor = isPublish ? "#4ADE80" : "#E8B84B";
  if (state === "done") {
    return (
      <span
        className="h-7 w-7 rounded-full text-white flex items-center justify-center shrink-0"
        style={{ backgroundColor: doneColor, boxShadow: `0 0 10px ${doneColor}80` }}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative h-7 w-7 shrink-0 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: `${currentColor}66` }} />
        <span className="relative h-7 w-7 rounded-full" style={{ backgroundColor: currentColor, boxShadow: `0 0 15px ${currentColor}b3` }} />
      </span>
    );
  }
  return (
    <span className="h-7 w-7 rounded-full border-2 border-[#1E3A5F] bg-background shrink-0" />
  );
}
