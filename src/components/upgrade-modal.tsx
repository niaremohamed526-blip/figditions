import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UpgradeModal({
  open, onOpenChange, title, description,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <div className="mx-auto h-14 w-14 rounded-2xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] flex items-center justify-center mb-2">
            <Lock className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Plus tard</Button>
          <Link to="/parametres" hash="plan">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Sparkles className="h-4 w-4" /> Upgrader mon plan
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
