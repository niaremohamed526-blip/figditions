import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Accès discret à l'espace super administrateur (validation des paiements). */
const ADMIN_EMAIL = "figditions@gmail.com";
const ADMIN_CODE = "F!9@1092med.mo.gtr-34d!t!0ns";

export function AdminAccessGate({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // petit délai pour éviter le brute-force instantané
    setTimeout(() => {
      setBusy(false);
      if (email.trim().toLowerCase() === ADMIN_EMAIL && code === ADMIN_CODE) {
        onOpenChange(false);
        navigate({ to: "/admin/paiements" });
      } else {
        toast.error("Identifiants invalides");
      }
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[color:var(--gold)]" />
            Espace administrateur
          </DialogTitle>
          <DialogDescription>
            Réservé à FIGDITIONS. Saisissez vos identifiants d'accès.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-gate-email">Email</Label>
            <Input
              id="admin-gate-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="figditions@gmail.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-gate-code">Code d'accès</Label>
            <Input
              id="admin-gate-code"
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full min-h-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Accéder
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
