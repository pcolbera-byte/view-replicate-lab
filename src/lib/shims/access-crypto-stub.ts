// Substitui as dependências de criptografia do mdb-reader no navegador.
// Elas só são usadas em bancos Access protegidos por senha e puxam polyfills do Node
// (stream, process) que quebram no navegador. A base do Mais Corret não usa senha.
function naoSuportado(): never {
  throw new Error(
    "Bancos do Access protegidos por senha não são suportados. Remova a senha no Access e tente de novo.",
  );
}

export function createDecipheriv(): never {
  return naoSuportado();
}

export default { createDecipheriv };
