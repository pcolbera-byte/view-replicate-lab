import { onlyDigits } from "./format";

export function isValidCPF(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCNPJ(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const weights =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Retorna mensagem de erro ou null. Campo vazio é válido (obrigatoriedade é tratada à parte). */
export function validateDocument(value: string): string | null {
  const d = onlyDigits(value);
  if (!d) return null;
  if (d.length === 11) return isValidCPF(d) ? null : "CPF inválido";
  if (d.length === 14) return isValidCNPJ(d) ? null : "CNPJ inválido";
  return "Informe 11 dígitos (CPF) ou 14 (CNPJ)";
}

export function validatePhone(value: string): string | null {
  const d = onlyDigits(value);
  if (!d) return null;
  return d.length === 10 || d.length === 11 ? null : "Telefone com DDD: 10 ou 11 dígitos";
}

export function validatePlate(value: string): string | null {
  if (!value) return null;
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value.toUpperCase())
    ? null
    : "Placa no formato ABC1D23 ou ABC1234";
}

export function validateEmail(value: string): string | null {
  if (!value) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : "E-mail inválido";
}
