import { useEffect, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/TaskDialog";
import { useAppStore, todayKey } from "@/store/useAppStore";
import { Task, TaskPriority } from "@/store/types";
import { useCustomOptions } from "@/hooks/use-custom-options";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { durationBetween } from "@/lib/timeline";
import { materializeRecurringTask } from "@/lib/tasks";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Mirrors the TAGS list in TaskDialog.tsx (and Agenda.tsx) — the same
// pre-existing duplication pattern in this codebase, not a new one.
const TAGS = ["Foco", "Trabalho", "Reunião", "Hábito", "Saúde", "Pessoal"];

interface ParsedVoiceTask {
  title: string;
  date: string | null;
  time: string | null;
  endTime: string | null;
  tags: string[];
  priority: TaskPriority | null;
}

/**
 * "Adicionar por voz": records one utterance via the browser's free
 * SpeechRecognition (src/hooks/use-voice-input.ts), sends the transcript to
 * the parse-voice-task Edge Function (Gemini's free tier — chosen over
 * Claude/OpenAI specifically because they have no lasting free API tier, see
 * the cost discussion this shipped from), and opens a normal TaskDialog
 * pre-filled with what it understood so the user reviews/edits before
 * saving. Never creates a task directly from the parse — a
 * misheard/mis-parsed field should be an easy edit, not a silent wrong task.
 */
export function VoiceTaskCapture() {
  const addTask = useAppStore((s) => s.addTask);
  const { options: knownTags } = useCustomOptions("lumen-custom-tags", TAGS);
  const { status, error, start, stop, setProcessing, setIdle, setFailed } = useVoiceInput();

  const [captureId, setCaptureId] = useState(0);
  const [parsed, setParsed] = useState<Partial<Task> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (status === "error" && error) toast.error(error);
  }, [status, error]);

  const handleTranscript = async (transcript: string) => {
    setProcessing();
    const { data, error: fnError } = await supabase.functions.invoke<ParsedVoiceTask>("parse-voice-task", {
      body: { transcript, today: todayKey(), knownTags },
    });
    if (fnError || !data) {
      setFailed("Não consegui entender. Tente de novo ou crie a tarefa manualmente.");
      return;
    }

    const duration =
      data.time && data.endTime ? durationBetween(data.time, data.endTime) ?? undefined : undefined;
    setParsed({
      title: data.title,
      date: data.date ?? undefined,
      time: data.time ?? undefined,
      tags: data.tags,
      priority: data.priority ?? undefined,
      duration,
    });
    // New key so TaskDialog's form state (which only reads `initial` once,
    // on mount) re-initializes from this capture instead of keeping whatever
    // was left over from a previous one.
    setCaptureId((n) => n + 1);
    setDialogOpen(true);
    setIdle();
  };

  if (status === "unsupported") return null;

  const listening = status === "listening";
  const processing = status === "processing";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={processing || dialogOpen}
        onClick={() => (listening ? stop() : start(handleTranscript))}
        title={listening ? "Toque para parar" : "Adicionar tarefa por voz"}
        className={cn(listening && "border-primary text-primary-glow")}
      >
        {processing ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Mic className={cn("mr-1 h-4 w-4", listening && "animate-pulse")} />
        )}
        {listening ? "Ouvindo…" : processing ? "Entendendo…" : "Por voz"}
      </Button>

      {parsed && (
        <TaskDialog
          key={captureId}
          title="Confirmar tarefa por voz"
          initial={parsed}
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setParsed(null);
          }}
          onSave={(v) => materializeRecurringTask(v).forEach(addTask)}
        />
      )}
    </>
  );
}
