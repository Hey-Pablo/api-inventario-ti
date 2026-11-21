-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'TECNICO', 'LEITURA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filial" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    CONSTRAINT "Filial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "patrimonio" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" TEXT NOT NULL,
    "equipamentoId" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "TipoLicenca" AS ENUM ('ETIQUETA', 'CASE', 'KIT_DOCUMENTACAO', 'SOFTWARE');

-- CreateTable
CREATE TABLE "Licenca" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoLicenca" NOT NULL,
    "fabricante" TEXT NOT NULL,
    "quantidadeAtual" INTEGER NOT NULL DEFAULT 0,
    "quantidadeMaxima" INTEGER NOT NULL,
    "vencimento" TIMESTAMP(3) DEFAULT NULL,
    "localizacao" TEXT DEFAULT NULL,
    "observacoes" TEXT DEFAULT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Licenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioFilial" (
    "id" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "equipamentosCount" INTEGER NOT NULL DEFAULT 0,
    "equipamentosValor" DECIMAL(65, 30) NOT NULL DEFAULT 0,
    "licencasCount" INTEGER NOT NULL DEFAULT 0,
    "licencasValor" DECIMAL(65, 30) NOT NULL DEFAULT 0,
    "movimentacoesLast7Days" INTEGER NOT NULL DEFAULT 0,
    "movimentacoesLast30Days" INTEGER NOT NULL DEFAULT 0,
    "resumo" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelatorioFilial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Filial_nome_key" ON "Filial"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Equipamento_patrimonio_key" ON "Equipamento"("patrimonio");

-- CreateIndex
CREATE UNIQUE INDEX "Licenca_nome_key" ON "Licenca"("nome");

-- AddForeignKey
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioFilial" ADD CONSTRAINT "RelatorioFilial_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
