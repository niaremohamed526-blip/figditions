// Maps Supabase auth error messages to French user-facing strings.
export function authErrorFr(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "Une erreur est survenue. Veuillez réessayer.";
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed"))
    return "Veuillez confirmer votre email avant de vous connecter.";
  if (m.includes("user already registered") || m.includes("already registered") || m.includes("user_already_exists"))
    return "Un compte existe déjà avec cet email.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit contenir au moins 6 caractères.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Trop de tentatives. Veuillez patienter quelques minutes.";
  if (m.includes("network") || m.includes("fetch"))
    return "Problème de connexion. Vérifiez votre réseau.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "Adresse email invalide.";
  if (m.includes("signup is disabled") || m.includes("signups not allowed"))
    return "Les inscriptions sont temporairement désactivées.";
  if (m.includes("user not found"))
    return "Aucun compte associé à cet email.";
  return message ?? "Une erreur est survenue.";
}
