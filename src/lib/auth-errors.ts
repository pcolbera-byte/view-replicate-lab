// Traduz as mensagens do Supabase Auth para o usuário.
export function authErrorMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Seu e-mail ainda não foi confirmado. Abra o link enviado para sua caixa de entrada.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este e-mail já tem cadastro. Entre ou use “Esqueceu a senha?”.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Muitas tentativas seguidas. Aguarde um minuto e tente novamente.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled"))
    return "Novos cadastros estão desativados nas configurações de autenticação do projeto.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "E-mail inválido.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "A nova senha deve ser diferente da anterior.";
  if (m.includes("session") && m.includes("missing"))
    return "O link expirou ou já foi usado. Solicite um novo.";
  if (m.includes("database error saving new user"))
    return "Não foi possível criar a corretora para este usuário. Verifique se as migrações do banco foram aplicadas.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sem conexão com o servidor. Verifique sua internet.";
  return raw || "Não foi possível continuar. Tente novamente.";
}
