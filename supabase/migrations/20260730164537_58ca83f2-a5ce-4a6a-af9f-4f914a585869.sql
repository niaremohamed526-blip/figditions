ALTER TABLE public.abonnements RENAME COLUMN paydunya_token TO payment_ref;
ALTER TABLE public.abonnements RENAME COLUMN paydunya_checkout_url TO checkout_url;
ALTER TABLE public.paiements RENAME COLUMN paydunya_token TO payment_ref;
ALTER TABLE public.paiements RENAME COLUMN paydunya_reference TO payment_reference;

ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'flutterwave';
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'flutterwave';

CREATE INDEX IF NOT EXISTS idx_abonnements_payment_ref ON public.abonnements(payment_ref);
CREATE INDEX IF NOT EXISTS idx_paiements_payment_ref ON public.paiements(payment_ref);