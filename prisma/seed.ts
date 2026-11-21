import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const db = new PrismaClient();
async function main() {
  const senha = process.env.SEED_PASSWORD;
  if (!senha || senha.length < 12) throw new Error('Defina SEED_PASSWORD com ao menos 12 caracteres');
  const senhaHash = await bcrypt.hash(senha, 12);
  for (const [email, papel] of [['admin@example.com', 'ADMIN'], ['tecnico@example.com', 'TECNICO'], ['leitura@example.com', 'LEITURA']] as const) {
    await db.usuario.upsert({ where: { email }, update: { senhaHash, papel }, create: { email, senhaHash, papel } });
  }
  for (const nome of ['Matriz fictícia', 'Filial fictícia']) await db.filial.upsert({ where: { nome }, update: {}, create: { nome } });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
