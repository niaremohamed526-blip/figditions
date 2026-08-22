import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { motion } from "motion/react";
import { ArrowLeft, Check, X, ShieldCheck, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { MedmoWordmark } from "@/components/medmo-wordmark";
import medmoMark from "@/assets/medmo-mark.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";

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
  creer_depot_librairie: "Créer un dépôt en librairie",
  enregistrer_impression: "Enregistrer une impression",
  retour_depot_librairie: "Retour de dépôt vers l'entrepôt",
  changer_statut_manuscrit: "Changer le statut d'un manuscrit",
};

const INPUT_LABELS: Record<string, string> = {
  livre: "Livre",
  librairie: "Librairie",
  quantite: "Quantité",
  prix_unitaire_fcfa: "Prix unitaire",
  prix_catalogue_fcfa: "Prix catalogue",
  date: "Date",
  notes: "Notes",
  nom_complet: "Nom complet",
  email: "Email",
  telephone: "Téléphone",
  operateur: "Opérateur",
  numero_mobile_money: "Mobile Money",
  titre: "Titre",
  auteur: "Auteur",
  genre: "Genre",
  langue: "Langue",
  adresse: "Adresse",
  provenance: "Provenance",
  nouveau_statut: "Nouveau statut",
};

const SUGGESTIONS = [
  { emoji: "📊", text: "Fais le point sur mes stocks et dis-moi quoi réassortir" },
  { emoji: "💰", text: "Combien dois-je en royalties à mes auteurs ?" },
  { emoji: "⚠️", text: "Quelles sont mes alertes du moment ?" },
  { emoji: "📈", text: "Aide-moi à faire un plan pour développer ma maison d'édition ce mois-ci" },
];

const springIn = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring" as const, stiffness: 380, damping: 30 },
};

const VALUE_LABELS: Record<string, string> = {
  interne: "Depuis l'entrepôt",
  hors_stock: "Hors stock interne",
};

function formatInputValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (key.includes("fcfa") && typeof value === "number") {
    return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} FCFA`;
  }
  if (key === "provenance" && typeof value === "string") return VALUE_LABELS[value] ?? value;
  return String(value);
}

// --- Pièces jointes (images & PDF analysés par PR MEDMO) ---
const MAX_ATTACH_FILES = 3;
const MAX_ATTACH_SIZE = 2 * 1024 * 1024; // 2 Mo par fichier
// Budget TOTAL des pièces jointes en base64 (~2,8 Mo) : l'hébergeur plafonne
// la requête complète à ~4,5 Mo, historique de conversation inclus.
const MAX_ATTACH_TOTAL_CHARS = 3_600_000;

/** Traduit une erreur brute (serveur, réseau, hébergeur) en message clair pour l'utilisateur. */
function friendlyChatError(raw: string | undefined): string {
  const m = (raw ?? "").trim();
  const lower = m.toLowerCase();
  if (!m) return "Une erreur est survenue. Vérifiez votre connexion puis réessayez.";
  if (lower.includes("413") || lower.includes("too large") || lower.includes("trop lourds") || lower.includes("payload"))
    return "Les fichiers joints sont trop lourds pour être envoyés. Réduisez leur taille ou envoyez-les un par un.";
  if (lower.includes("429") || lower.includes("trop de demandes") || lower.includes("quota") || lower.includes("rate limit"))
    return "PR MEDMO reçoit trop de demandes en ce moment (limite du fournisseur IA). Patientez une minute puis réessayez.";
  if (lower.includes("crédits") || lower.includes("credits") || lower.includes("402"))
    return "Les crédits IA sont épuisés. Rechargez-les dans les paramètres de facturation.";
  if (lower.includes("gemini_api_key") || lower.includes("pas configuré") || lower.includes("api key") || lower.includes("401") || lower.includes("403"))
    return "Le service IA n'est pas configuré correctement sur le serveur (clé GEMINI_API_KEY manquante ou invalide).";
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("function_invocation"))
    return "La réponse a pris trop de temps et a été interrompue par l'hébergeur. Réessayez avec une demande plus courte.";
  if (lower.includes("non authentifié") || lower.includes("session invalide"))
    return "Votre session a expiré. Rechargez la page pour vous reconnecter.";
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("load failed"))
    return "Connexion interrompue. Vérifiez votre réseau puis réessayez.";
  // Message serveur lisible (nos réponses texte) : on l'affiche tel quel s'il est court.
  if (m.length <= 220 && !m.includes("<")) return m;
  return "Une erreur est survenue. Vérifiez votre connexion puis réessayez.";
}

/** Compresse une image côté navigateur (max 1600px, JPEG) pour rester sous la limite d'envoi. */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Bouton trombone du compositeur : sélection de fichiers + compression des images. */
function MedmoAttachButton({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = "";
    if (picked.length === 0) return;
    setPreparing(true);
    try {
      attachments.add(await Promise.all(picked.map(compressImage)));
    } finally {
      setPreparing(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept="image/*,application/pdf"
        aria-label="Joindre une image ou un PDF"
        onChange={(e) => void onPick(e)}
      />
      <PromptInputButton
        tooltip="Joindre une image ou un PDF à analyser"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || preparing}
        aria-label="Joindre un fichier"
        className="text-muted-foreground hover:text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10"
      >
        <Paperclip className={cn("size-4", preparing && "animate-pulse")} />
      </PromptInputButton>
    </>
  );
}

/** Vignettes des pièces jointes au-dessus du champ de saisie. */
function MedmoAttachmentChips() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <PromptInputHeader className="flex flex-wrap gap-2 px-2 pt-2">
      {attachments.files.map((f) => (
        <motion.div
          key={f.id}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="relative"
        >
          {f.mediaType?.startsWith("image/") ? (
            <img
              src={f.url}
              alt={f.filename ?? "image jointe"}
              className="h-14 w-14 rounded-lg border border-[color:var(--gold)]/40 object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-14 max-w-[180px] items-center gap-2 rounded-lg border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3">
              <FileText className="h-4 w-4 shrink-0 text-[color:var(--gold)]" />
              <span className="truncate text-xs font-medium">{f.filename ?? "document.pdf"}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => attachments.remove(f.id)}
            aria-label="Retirer ce fichier"
            className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-card p-0.5 shadow-sm hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      ))}
    </PromptInputHeader>
  );
}

/** PR MEDMO brand avatar — gold book mark on a deep disc, with an optional sonar pulse. */
function MedmoAvatar({ pulsing = false, size = "md" }: { pulsing?: boolean; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16" : "h-8 w-8";
  const imgDims = size === "lg" ? "h-10 w-10" : "h-5 w-5";
  return (
    <div className={cn("relative shrink-0", dims)}>
      {pulsing && (
        <motion.span
          className="absolute inset-0 rounded-full bg-[color:var(--gold)]/40"
          animate={{ scale: [1, 1.7], opacity: [0.55, 0] }}
          transition={{ duration: 1.3, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
        />
      )}
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center rounded-full",
          "bg-[radial-gradient(circle_at_35%_30%,#2b2110,#14100a_70%)]",
          "border border-[color:var(--gold)]/45 shadow-[0_0_18px_rgba(200,146,42,0.35)]",
        )}
      >
        <img src={medmoMark} alt="PR MEDMO" className={cn("object-contain", imgDims)} />
      </div>
    </div>
  );
}

/** Confirmation card for approval-gated actions (not covered by AI Elements primitives). */
function ApprovalCard({
  part,
  label,
  onRespond,
  disabled,
}: {
  part: any;
  label: string;
  onRespond: (r: { id: string; approved: boolean }) => void;
  disabled: boolean;
}) {
  const input = (part.input ?? {}) as Record<string, unknown>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="my-2 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 p-3.5 space-y-3"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--gold)]">
        <ShieldCheck className="h-4 w-4" /> {label} — confirmation requise
      </div>
      <div className="rounded-lg bg-background/60 border border-border px-3 py-2 text-xs space-y-1">
        {Object.entries(input)
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{INPUT_LABELS[k] ?? k}</span>
              <span className="font-medium text-right">{formatInputValue(k, v)}</span>
            </div>
          ))}
      </div>
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={disabled}
          onClick={() => onRespond({ id: part.approval.id, approved: true })}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white text-xs font-semibold px-3 py-2 hover:brightness-110 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Confirmer
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={disabled}
          onClick={() => onRespond({ id: part.approval.id, approved: false })}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold px-3 py-2 hover:bg-muted/40 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Annuler
        </motion.button>
      </div>
    </motion.div>
  );
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
  const name: string =
    typeof part.type === "string" && part.type.startsWith("tool-") ? part.type.slice(5) : "outil";
  const label = TOOL_LABELS[name] ?? name;
  const state: string = part.state ?? "";

  if (state === "approval-requested") {
    return (
      <ApprovalCard part={part} label={label} onRespond={addToolApprovalResponse} disabled={disabled} />
    );
  }

  const input = (part.input ?? {}) as Record<string, unknown>;
  const hasInput = Object.values(input).some((v) => v != null && v !== "");
  const resume = state === "output-available" ? (part.output as any)?.resume : undefined;

  return (
    <Tool defaultOpen={false} className="my-1.5 rounded-xl border-border bg-muted/20 text-xs">
      <ToolHeader type={part.type} state={part.state as any} title={label} className="p-2.5 text-xs" />
      <ToolContent className="space-y-3 px-3 pb-3 pt-0">
        {hasInput && (
          <div className="rounded-lg bg-background/60 border border-border px-3 py-2 space-y-1">
            {Object.entries(input)
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{INPUT_LABELS[k] ?? k}</span>
                  <span className="font-medium text-right">{formatInputValue(k, v)}</span>
                </div>
              ))}
          </div>
        )}
        {resume && <p className="text-foreground/90 leading-relaxed">{resume}</p>}
        {state === "output-error" && part.errorText && (
          <p className="text-red-400">{String(part.errorText)}</p>
        )}
      </ToolContent>
    </Tool>
  );
}

export function MedmoChat({
  threadId,
  initialMessages,
  compact = false,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  compact?: boolean;
}) {
  const composerRef = useRef<HTMLDivElement>(null);

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

  const { messages, sendMessage, regenerate, status, stop, addToolApprovalResponse, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => {
      window.dispatchEvent(new CustomEvent("medmo:threads-changed"));
    },
    onError: (e) => {
      toast.error(friendlyChatError(e.message));
    },
  });

  const busy = status === "submitted" || status === "streaming";

  // Focus management: on mount, on thread switch, after stream completion.
  useEffect(() => {
    composerRef.current?.querySelector("textarea")?.focus();
  }, [threadId]);
  useEffect(() => {
    if (status === "ready") composerRef.current?.querySelector("textarea")?.focus();
  }, [status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    void sendMessage({ text: t });
  };

  const handleSubmit = (msg: PromptInputMessage) => {
    const t = msg.text.trim();
    const files = msg.files ?? [];
    if (busy || (!t && files.length === 0)) return;
    // Budget total : au-delà, l'hébergeur rejette la requête avant le serveur.
    const totalChars = files.reduce((a, f) => a + (typeof f.url === "string" ? f.url.length : 0), 0);
    if (totalChars > MAX_ATTACH_TOTAL_CHARS) {
      toast.error("Les fichiers joints dépassent ~2,5 Mo au total. Envoyez-les un par un ou compressez-les.");
      return;
    }
    void sendMessage({
      text: t || "Analyse le(s) document(s) joint(s) et dis-moi ce qu'ils contiennent.",
      ...(files.length > 0 ? { files } : {}),
    });
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2.5 border-b border-border bg-sidebar/60">
        <Link
          to="/medmo"
          className="p-1.5 -ml-1 rounded-md hover:bg-sidebar-accent"
          aria-label="Retour aux conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <MedmoAvatar />
        <MedmoWordmark className="text-base" />
      </div>

      {/* Messages */}
      <Conversation className="bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(200,146,42,0.06),transparent)]">
        <ConversationContent className="px-3 md:px-6 py-4 gap-5">
          {isEmpty ? (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
              className="m-auto flex w-full max-w-lg flex-col items-center justify-center text-center gap-6 py-10"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, scale: 0.8 },
                  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 260, damping: 20 } },
                }}
                className="relative"
              >
                <motion.span
                  className="absolute inset-0 -m-4 rounded-full bg-[color:var(--gold)]/25 blur-2xl"
                  animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.12, 1] }}
                  transition={{ duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <motion.div
                  animate={{ y: [0, -7, 0] }}
                  transition={{ duration: 3.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                >
                  <MedmoAvatar size="lg" />
                </motion.div>
              </motion.div>
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
                }}
              >
                <h2 className="text-xl font-bold">
                  Bonjour, je suis <MedmoWordmark className="text-2xl align-baseline" /> 👋
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Votre copilote pour FIGDITIONS : je peux consulter vos données en direct, vous guider
                  pas à pas, enregistrer des actions pour vous et vous conseiller pour développer votre
                  maison d'édition. Joignez une image ou un PDF 📎 et je l'analyserai pour vous.
                </p>
              </motion.div>
              <div className="grid sm:grid-cols-2 gap-2 w-full">
                {SUGGESTIONS.map((s) => (
                  <motion.button
                    key={s.text}
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 24 } },
                    }}
                    whileHover={{ y: -3, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => send(s.text)}
                    className="text-left text-xs rounded-xl border border-border bg-card px-3.5 py-3 hover:border-[color:var(--gold)]/50 hover:bg-[color:var(--gold)]/5 hover:shadow-[0_6px_20px_rgba(200,146,42,0.12)] transition-colors"
                  >
                    <span className="mr-1.5">{s.emoji}</span>
                    {s.text}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">
              {messages.map((m) => {
                if (m.role === "user") {
                  const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
                  const files = m.parts.filter((p) => p.type === "file") as {
                    mediaType?: string;
                    url?: string;
                    filename?: string;
                  }[];
                  return (
                    <motion.div key={m.id} {...springIn} className="flex justify-end">
                      <Message from="user" className="max-w-[85%]">
                        <MessageContent className="group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md group-[.is-user]:bg-[linear-gradient(135deg,#C8922A,#A67420)] group-[.is-user]:text-white group-[.is-user]:shadow-[0_4px_16px_rgba(200,146,42,0.25)]">
                          {files.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {files.map((p, i) =>
                                p.mediaType?.startsWith("image/") && p.url ? (
                                  <img
                                    key={i}
                                    src={p.url}
                                    alt={p.filename ?? "image jointe"}
                                    className="max-h-40 rounded-lg border border-white/25"
                                  />
                                ) : (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span className="max-w-[160px] truncate">
                                      {p.filename ?? "document"}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                          {text && <span className="whitespace-pre-wrap">{text}</span>}
                        </MessageContent>
                      </Message>
                    </motion.div>
                  );
                }
                const isLast = m.id === messages[messages.length - 1]?.id;
                return (
                  <motion.div key={m.id} {...springIn} className="flex gap-2.5">
                    <MedmoAvatar pulsing={isLast && status === "streaming"} />
                    <Message from="assistant" className="flex-1 min-w-0 max-w-none">
                      <MessageContent>
                        {m.parts.map((p, i) => {
                          if (p.type === "text") {
                            return (
                              <MessageResponse key={i} className="medmo-md text-sm leading-relaxed">
                                {p.text}
                              </MessageResponse>
                            );
                          }
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
                      </MessageContent>
                    </Message>
                  </motion.div>
                );
              })}
              {status === "submitted" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5"
                >
                  <MedmoAvatar pulsing />
                  <Shimmer className="text-sm font-medium" duration={1.6}>
                    PR MEDMO réfléchit…
                  </Shimmer>
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span>{friendlyChatError(error.message)}</span>
                  <button
                    type="button"
                    onClick={() => void regenerate()}
                    className="shrink-0 rounded-lg border border-red-500/40 px-2.5 py-1 font-medium hover:bg-red-500/15 transition-colors"
                  >
                    Réessayer
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton className="border-[color:var(--gold)]/40 shadow-[0_4px_16px_rgba(200,146,42,0.2)]" />
      </Conversation>

      {/* Composer */}
      <div className="border-t border-border bg-sidebar/40 px-3 md:px-6 py-3">
        <motion.div
          ref={composerRef}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="max-w-3xl mx-auto"
        >
          <PromptInput
            onSubmit={handleSubmit}
            accept="image/*,application/pdf"
            multiple
            maxFiles={MAX_ATTACH_FILES}
            maxFileSize={MAX_ATTACH_SIZE}
            onError={(err) =>
              toast.error(
                err.code === "max_file_size"
                  ? "Fichier trop lourd : 2 Mo maximum par fichier (les images sont compressées automatiquement)."
                  : err.code === "max_files"
                    ? `Maximum ${MAX_ATTACH_FILES} fichiers à la fois.`
                    : "Format non pris en charge : images ou PDF uniquement.",
              )
            }
            className="rounded-2xl border-border bg-card shadow-lg transition-[box-shadow,border-color] duration-300 focus-within:border-[color:var(--gold)]/60 focus-within:shadow-[0_0_0_1px_rgba(200,146,42,0.4),0_10px_36px_rgba(200,146,42,0.14)]"
          >
            <MedmoAttachmentChips />
            <PromptInputTextarea
              placeholder="Demandez quelque chose à PR MEDMO… ou joignez une image/PDF 📎"
              className="min-h-[46px] text-sm"
            />
            <PromptInputFooter>
              <PromptInputTools>
                <MedmoAttachButton disabled={busy} />
              </PromptInputTools>
              <PromptInputSubmit
                status={status}
                onStop={stop}
                className="bg-[linear-gradient(135deg,#C8922A,#A67420)] text-white hover:brightness-110 shadow-md transition-transform hover:scale-105 active:scale-95"
                aria-label="Envoyer"
              />
            </PromptInputFooter>
          </PromptInput>
        </motion.div>
        <p className="max-w-3xl mx-auto text-[10px] text-muted-foreground mt-1.5 text-center">
          PR MEDMO peut se tromper — vérifiez les actions importantes avant de confirmer.
        </p>
      </div>
    </div>
  );
}
