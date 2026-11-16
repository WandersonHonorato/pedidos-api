# Uso de IA

IA foi usada (permitido e esperado pelo enunciado). Ferramenta: **Claude (Anthropic)**, como assistente de código.
Os commits gerados com apoio de IA trazem o trailer `Co-Authored-By`.

## Como foi usada

| Etapa | Papel da IA | Papel do autor |
|---|---|---|
| Escolha do domínio | comparou pedidos × biblioteca × agenda | decidiu (pedidos) |
| Código e testes | gerou a primeira versão | revisou, rodou e validou cada etapa |
| Verificação | rodou lint, testes, coverage e k6 de verdade | conferiu os números publicados |
| Documentação | redigiu README, ADR, OpenAPI e desempenho | revisou e ajustou |

Nenhum número da documentação foi estimado: todos vêm de execução real (saída do Vitest e do k6, e histograma do `/metrics`).

## Prompts que importaram

1. **Escopo**
   > "Trabalho de Full Cycle — Projeto B: API de domínio único (pedidos, biblioteca ou agenda), um fluxo principal ponta a ponta, sem decomposição em módulos. Me informe o mais simples dos três."

   Resultado: **pedidos**, com fluxo criar → consultar → pagar. Agenda exigiria regra de conflito de horário; biblioteca, controle de disponibilidade e devolução.

2. **Requisitos M1–M4** (colado do enunciado)
   > "Compose que sobe com 1 comando, SOLID, 1 pattern justificado, testes unitários do domínio e 1 de integração, coverage mínimo declarado e respeitado, CI verde (install, lint, test), .env.example e segredos fora, logs estruturados, 1 métrica e 1 SLO, README do primeiro dia, 1 ADR, OpenAPI e smoke k6 com p95 medido. O trabalho tem que ser todo justificado e ter os commits."

   Resultado: a estrutura do repositório e a tabela "Nível" do README, que mapeia cada entregável ao arquivo correspondente.

3. **Critérios que derrubam nota** (usados como checklist de revisão)
   > "Escopo inflado e nada funcionando; CI vermelha; README que não deixa subir; segredos commitados; teste sem asserção e número sem medição."

   Efeitos concretos:
   - escopo mínimo: 3 endpoints de negócio e 1 tabela;
   - o compose **falha com mensagem clara** se o `.env` não existir, em vez de ter senha padrão no repositório;
   - todo teste verifica status **e** corpo;
   - o p95 publicado veio de execução real do k6, e foi conferido pelo histograma do servidor.

4. **Verificação adversarial**
   > "Rode a API contra Postgres real e tente quebrar o fluxo."

   Achado: `GET /pedidos/abc` (id que não é UUID) devolvia **500** no Postgres, mas 404 no repositório em memória, uma violação de LSP entre as implementações. Corrigido e registrado no [ADR 0001](adr/0001-repository-pattern.md).

## O que foi revisado manualmente

- Regras de domínio (centavos inteiros, ao menos 1 item, só paga se CRIADO)
- Que nenhum segredo está versionado (`git ls-files | grep .env` → só `.env.example`)
- Que o workflow da CI corresponde aos comandos do README
