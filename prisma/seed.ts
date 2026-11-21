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

  // Equipamentos de exemplo
  const matriz = await db.filial.upsert({ where: { nome: 'Matriz fictícia' }, update: {}, create: { nome: 'Matriz fictícia' } });
  const filial = await db.filial.upsert({ where: { nome: 'Filial fictícia' }, update: {}, create: { nome: 'Filial fictícia' } });

  await db.equipamento.createMany({
    data: [
      { nome: 'Notebook Dell Latitude 5400', patrimonio: 'EQ-001', filialId: matriz.id },
      { nome: 'Desktop HP ProDesk 400', patrimonio: 'EQ-002', filialId: matriz.id },
      { nome: 'Impressora Laser Brother HL-L2350DW', patrimonio: 'EQ-003', filialId: matriz.id },
      { nome: 'Switch Cisco SG250-08', patrimonio: 'EQ-004', filialId: filial.id },
      { nome: 'Workstation Lenovo ThinkStation P320', patrimonio: 'EQ-005', filialId: filial.id },
    ],
    skipDuplicates: true,
  });

  // Licenças de exemplo
  await db.licenca.createMany({
    data: [
      {
        nome: 'Microsoft Windows 11 Pro',
        tipo: 'SOFTWARE',
        fabricante: 'Microsoft',
        quantidadeAtual: 50,
        quantidadeMaxima: 50,
        vencimento: new Date('2026-12-31'),
        localizacao: 'Departamento de TI',
      },
      {
        nome: 'Microsoft Office 365 E3',
        tipo: 'SOFTWARE',
        fabricante: 'Microsoft',
        quantidadeAtual: 45,
        quantidadeMaxima: 50,
        vencimento: new Date('2025-06-15'),
        localizacao: 'Todos os setores',
      },
      {
        nome: 'Adobe Creative Cloud',
        tipo: 'SOFTWARE',
        fabricante: 'Adobe',
        quantidadeAtual: 15,
        quantidadeMaxima: 20,
        vencimento: new Date('2025-09-30'),
        localizacao: 'Design e Marketing',
      },
      {
        nome: 'Pack de Etiquetas - Largura 70mm',
        tipo: 'ETIQUETA',
        fabricante: 'Zebra',
        quantidadeAtual: 120,
        quantidadeMaxima: 500,
        vencimento: new Date('2027-01-15'),
        observacoes: 'Etiquetas para inventário de equipamentos',
      },
    ],
    skipDuplicates: true,
  });

  // Movimentações de exemplo
  const equipamentoId = (await db.equipamento.findUnique({ where: { patrimonio: 'EQ-004' } }))?.id;
  if (equipamentoId) {
    await db.movimentacao.create({
      data: { equipamentoId, origemId: matriz.id, destinoId: filial.id },
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
