import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, SendHorizonal, Square, ArrowLeft, Check, X, Loader2, Wrench, CircleCheck, CircleX, Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TOOL_LABELS: Record<string, string> = {
  vue_ensemble: "Vue d'ensemble",
  consulter_stocks: "Consultation des stocks",
  consulter_ventes: "Analyse des ventes",
  consulter_royalties: "Calcul des royalties",
  consulter_alertes: "Recherche d'alertes",
  consulter_manuscrits: "Consultation des manuscrits",
  creer_auteur: "Créer un auteur",
  creer_manuscrit: "Créer un manuscrit",
  enregistrer_vente_libre: "Enregistrer une vente libre",
  enregistrer_vente_librairie: "Enregistrer une vente en librairie",
};

const INPUT_LABELS: Record<string, string> = {
  livre: "Livre", librairie: "Librairie", quantite: "Quantité",
  prix_unitaire_fcfa: "Prix unitaire", prix_catalogue_fcfa: "Prix catalogue",
  date: "Date", notes: "Notes", nom_complet: "Nom complet", email: "Email",
  telephone: "Téléphone", operateur: "Opérateur", numero_mobile_money: "Mobile Money",
  titre: "Titre", auteur: "Auteur", genre: "Genre", langue: "Langue",
};

const SUGGESTIONS = [
  { emoji: "📊", text: "Fais le point sur mes stocks et dis-moi quoi réassortir" },
  { emoji: "💰", text: "Combien dois-je en royalties à mes auteurs ?" },
  { emoji: "⚠️", text: "Quelles sont mes alertes du moment ?" },
  { emoji: "📈", text: "Aide-moi à faire un plan pour développer ma maison d'édition ce mois-ci" },
];

function formatInputValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (key.includes("fcfa") && typeof value === "number") {
    return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} FCFA`;
  }
  return String(value);
}

function ToolPartView({
  part,
  addToolApprovalResponse,
  disabled,
}: {
  part: any;
  addToolApprovalResponse: (r: { id: string; approved: boolean }) => void;
  disabled: boolean;
}) {
  const name: string = typeof part.type === "string" && part.type.startsWith("tool-") ? part.type.slice(5) : "outil";
  const label = TOOL_LABELS[name] ?? name;
  const state: string = part.state ?? "";

  if (state === "approval-requested") {
    const input = (part.input ?? {}) as Record<string, unknown>;
    return (
      <div className="my-2 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-3.5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--gold)]">
          <Wrench className="h-4 w-4" /> {label} — confirmation requise
        </div>
        <div className="rounded-lg bg-background/60 border border-border px-3 py-2 text-xs space-y-1">
          {Object.entries(input).filter(([, v]) => v != null && v !== "").map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{INPUT_LABELS[k] ?? k}</span>
              <span className="font-medium text-right">{formatInputValue(k, v)}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            disabled={disabled}
            onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: true })}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white text-xs font-semibold px-3 py-2 hover:brightness-110 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Confirmer
          </button>
          <button
            disabled={disabled}
            onClick={() => addToolApprovalResponse({ id: part.approval.id, approved: false })}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold px-3 py-2 hover:bg-muted/40 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Annuler
          </button>
        </div>
      </div>
    );
  }

  let icon = <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  let text = `${label}…`;
  let cls = "text-muted-foreground";
  if (state === "output-available") {
    icon = <CircleCheck className="h-3.5 w-3.5 text-emerald-400" />;
    const resume = (part.output as any)?.resume;
    text = resume ?? `${label} — terminé`;
    if (resume) cls = "text-foreground";
  } else if (state === "output-denied") {
    icon = <Ban className="h-3.5 w-3.5 text-muted-foreground" />;
    text = `${label} — action annulée`;
  } else if (state === "output-error") {
    icon = <CircleX className="h-3.5 w-3.5 text-red-400" />;
    text = `${label} — erreur`;
    cls = "text-red-400";
  }
  return (
    <div className={cn("my-1.5 flex items-start gap-2 text-xs rounded-lg border border-border bg-muted/20 px-3 py-2", cls)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{text}</span>
    </div>
  );
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="medmo-md text-sm leading-relaxed">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

export function MedmoChat({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const headers: Record<string, string> = {};
          if (data.session) headers["Authorization"] = `Bearer ${data.session.access_token}`;
          return headers;
        },
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, addToolApprovalResponse, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => {
      window.dispatchEvent(new CustomEvent("medmo:threads-changed"));
    },
    onError: (e) => {
      toast.error(e.message || "PR MEDMO a rencontré une erreur. Réessayez.");
    },
  });

  const busy = status === "submitted" || status === "streaming";

  // Focus management: on mount, after send, after stream completes.
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void sendMessage({ text: t });
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2.5 border-b border-border bg-sidebar/60">
        <Link to="/medmo" className="p-1.5 -ml-1 rounded-md hover:bg-sidebar-accent" aria-label="Retour aux conversations">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-7 w-7 rounded-full bg-[linear-gradient(135deg,#C8922A,#A67420)] flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="text-sm font-semibold">PR MEDMO</div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-10">
            <div className="h-16 w-16 rounded-2xl bg-[linear-gradient(135deg,#C8922A,#A67420)] shadow-[0_0_40px_rgba(200,146,42,0.35)] flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Bonjour, je suis PR MEDMO 👋</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Votre copilote pour FIGDITIONS : je peux consulter vos données en direct, vous guider pas à pas,
                enregistrer des actions pour vous et vous conseiller pour développer votre maison d'édition.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="text-left text-xs rounded-xl border border-border bg-card px-3.5 py-3 hover:border-[color:var(--gold)]/50 hover:bg-[color:var(--gold)]/5 transition-colors"
                >
                  <span className="mr-1.5">{s.emoji}</span>{s.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m) => {
              if (m.role === "user") {
                const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white px-4 py-2.5 text-sm whitespace-pre-wrap">
                      {text}
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} className="flex gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-[linear-gradient(135deg,#C8922A,#A67420)] flex items-center justify-center mt-0.5">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
                    {m.parts.map((p, i) => {
                      if (p.type === "text") return <AssistantText key={i} text={p.text} />;
                      if (typeof p.type === "string" && p.type.startsWith("tool-")) {
                        return (
                          <ToolPartView
                            key={i}
                            part={p}
                            disabled={busy}
                            addToolApprovalResponse={addToolApprovalResponse}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
            {status === "submitted" && (
              <div className="flex gap-2.5">
                <div className="h-8 w-8 shrink-0 rounded-full bg-[linear-gradient(135deg,#C8922A,#A67420)] flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3.5 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--gold)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-[color:var(--gold)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-[color:var(--gold)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs px-4 py-3">
                Une erreur est survenue. Vérifiez votre connexion puis réessayez d'envoyer votre message.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-sidebar/40 px-3 md:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Demandez quelque chose à PR MEDMO…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-[color:var(--gold)]/60 placeholder:text-muted-foreground min-h-[46px]"
          />
          {busy ? (
            <button
              onClick={() => stop()}
              className="h-[46px] w-[46px] shrink-0 rounded-xl border border-border bg-card flex items-center justify-center hover:bg-muted/40"
              aria-label="Arrêter la réponse"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="h-[46px] w-[46px] shrink-0 rounded-xl bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white flex items-center justify-center hover:brightness-110 disabled:opacity-40 shadow-lg"
              aria-label="Envoyer"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="max-w-3xl mx-auto text-[10px] text-muted-foreground mt-1.5 text-center">
          PR MEDMO peut se tromper — vérifiez les actions importantes avant de confirmer.
        </p>
      </div>
    </div>
  );
}
