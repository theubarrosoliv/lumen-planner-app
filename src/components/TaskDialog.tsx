import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagMultiSelect } from "@/components/TagMultiSelect";
import { NotifyField } from "@/components/NotifyField";
import { WeekdaySelector } from "@/components/WeekdaySelector";
import { useCustomOptions } from "@/hooks/use-custom-options";
import { todayKey } from "@/store/useAppStore";
import { Task, NotifyLeadUnit, TaskPriority, TaskRecurrence } from "@/store/types";
import { itemTags } from "@/lib/tags";
import { durationBetween, endTimeOf } from "@/lib/timeline";
import { toast } from "sonner";

const TAGS = ["Foco", "Trabalho", "Reunião", "Hábito", "Saúde", "Pessoal"];

/**
 * Create/edit form for a Task. Lives here rather than inside Agenda because
 * the Cronograma (see ScheduleView) opens the very same dialog when a task
 * block is tapped — the task is viewed and edited in place, wherever it's
 * shown, instead of bouncing the user to another screen.
 */
export function TaskDialog({
  initial,
  onSave,
  trigger,
  title,
  open: openProp,
  onOpenChange,
}: {
  initial?: Partial<Task>;
  onSave: (t: {
    time: string;
    title: string;
    tags: string[];
    date: string;
    notes?: string;
    priority?: TaskPriority;
    recurrence?: TaskRecurrence;
    weekdays?: number[];
    intervalDays?: number;
    duration?: number;
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
  /** Omit for the normal click-a-trigger-to-open usage. Used without a
   * trigger by VoiceTaskCapture, which opens this programmatically once a
   * voice capture has been parsed — there's nothing to click beforehand. */
  trigger?: React.ReactNode;
  title: string;
  /** Controlled open state — only needed by callers that open this dialog
   * from code (see VoiceTaskCapture). Omit both to keep the normal
   * trigger-click-driven internal state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChange ?? (() => {}) : setInternalOpen;
  const [text, setText] = useState(initial?.title ?? "");
  const [time, setTime] = useState(initial?.time && initial.time !== "—" ? initial.time : "");
  const [tags, setTags] = useState<string[]>(initial ? itemTags(initial) : []);
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [priority, setPriority] = useState<TaskPriority | "none">(initial?.priority ?? "none");
  const [recurrence, setRecurrence] = useState<TaskRecurrence | "none">(initial?.recurrence ?? "none");
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [intervalDays, setIntervalDays] = useState<number | undefined>(initial?.intervalDays ?? 15);
  // The store keeps a `duration` in minutes, but people think in "15:00 to
  // 16:30", so the form works in end times and converts on the way in and out.
  const [endTime, setEndTime] = useState(endTimeOf(initial?.time, initial?.duration) ?? "");
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyLeadValue, setNotifyLeadValue] = useState<number | undefined>(initial?.notifyLeadValue);
  const [notifyLeadUnit, setNotifyLeadUnit] = useState<NotifyLeadUnit>(initial?.notifyLeadUnit ?? "minutes");
  const {
    options: tagOptions,
    custom: customTags,
    addOption: addTagOption,
    removeOption: removeTagOption,
    renameOption: renameTagOption,
  } = useCustomOptions("lumen-custom-tags", TAGS);

  const submit = () => {
    if (!text.trim()) {
      toast.error("Dê um título à tarefa.");
      return;
    }
    if (recurrence === "weekdays" && weekdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana.");
      return;
    }
    if (recurrence === "every_n_days" && (!intervalDays || intervalDays < 2)) {
      toast.error("Informe a cada quantos dias (mínimo 2).");
      return;
    }
    if (endTime && !time) {
      toast.error("Defina a hora de início antes da de término.");
      return;
    }
    if (endTime && durationBetween(time, endTime) === null) {
      toast.error("O término precisa ser depois do início.");
      return;
    }
    onSave({
      title: text.trim(),
      time: time || "—",
      tags,
      date,
      priority: priority === "none" ? undefined : priority,
      recurrence: recurrence === "none" ? undefined : recurrence,
      weekdays: recurrence === "weekdays" ? weekdays : undefined,
      intervalDays: recurrence === "every_n_days" ? intervalDays : undefined,
      duration: endTime ? (durationBetween(time, endTime) ?? undefined) : undefined,
      notify,
      notifyLeadValue,
      notifyLeadUnit,
    });
    setOpen(false);
    if (!initial) {
      setText("");
      setTime("");
      setTags([]);
      setPriority("none");
      setRecurrence("none");
      setWeekdays([]);
      setIntervalDays(15);
      setEndTime("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Título</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Prioridade
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority | "none")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem prioridade</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Começa às
                </Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value);
                    // Clearing the start would leave an end time stranded in a
                    // disabled field that then blocks saving.
                    if (!e.target.value) setEndTime("");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Termina às <span className="normal-case tracking-normal">(opc.)</span>
                </Label>
                <Input
                  type="time"
                  value={endTime}
                  disabled={!time}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            {!time && (
              <p className="text-[11px] text-muted-foreground">
                Defina a hora de início para poder marcar o término.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Repetir
            </Label>
            <Select
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as TaskRecurrence | "none")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não repetir</SelectItem>
                <SelectItem value="daily">Diariamente</SelectItem>
                <SelectItem value="weekly">Semanalmente</SelectItem>
                <SelectItem value="monthly">Mensalmente</SelectItem>
                <SelectItem value="weekdays">Dias da semana…</SelectItem>
                <SelectItem value="every_n_days">A cada X dias…</SelectItem>
              </SelectContent>
            </Select>
            {recurrence === "weekdays" && (
              <div className="pt-1">
                <WeekdaySelector value={weekdays} onChange={setWeekdays} />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  A tarefa se repete nos dias marcados — escolha mais de um para "N vezes por semana".
                </p>
              </div>
            )}
            {recurrence === "every_n_days" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm text-muted-foreground">A cada</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  step={1}
                  className="h-8 w-20"
                  value={intervalDays ?? ""}
                  onChange={(e) => setIntervalDays(e.target.value === "" ? undefined : Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tags</Label>
            <TagMultiSelect
              value={tags}
              onChange={setTags}
              options={tagOptions}
              onCreate={addTagOption}
              customOptions={customTags}
              onRemove={removeTagOption}
              onRename={renameTagOption}
            />
          </div>
          <NotifyField
            notify={notify}
            onNotifyChange={setNotify}
            leadValue={notifyLeadValue}
            leadUnit={notifyLeadUnit}
            onLeadValueChange={setNotifyLeadValue}
            onLeadUnitChange={setNotifyLeadUnit}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} className="bg-gradient-primary shadow-elegant">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
