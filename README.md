# CorredorVerde-Maquete

Maquete digital em React do trabalho **A3 de Gestão e Qualidade de Software** (UNIFACS), no eixo **Trânsito**.

A maquete mostra uma cidade com 20 cruzamentos (C1 a C20). Duas ambulâncias e duas viaturas dos bombeiros patrulham as ruas. Quando o usuário registra uma emergência, a viatura livre mais perto sai e o sistema abre um **corredor verde** nos semáforos do caminho.

As regras de negócio **não ficam aqui**. Elas estão na **[CorredorVerde-API](https://github.com/DavidTrabuco/Corredor-Verde-API-)** (C# / ASP.NET Core). A maquete desenha, anima, captura o teclado e o mouse e conversa com a API pelo contrato de `docs/referencias/contrato-api.md`.

<!-- Print da tela: salve em docs/print-maquete.png e descomente a linha abaixo -->
<!-- ![Maquete do Corredor Verde](docs/print-maquete.png) -->

## Stack

| Parte | Tecnologia |
|---|---|
| Interface | React 19 + TypeScript |
| Build | Vite |
| Estilo | Tailwind CSS 4 (`@tailwindcss/vite`), com as classes em `styles.ts` de cada componente |
| Estado global | zustand (`src/store/`) |
| Desenho do mapa | Canvas 2D (`src/components/Mapa/`) |
| Qualidade | ESLint |
| Deploy | Dockerfile com nginx |

## Organização

```
src/
├── pages/MaquetePage.tsx   layout: controles | mapa + faixa de eventos | painel lateral
├── components/             um componente por pasta (index.tsx + styles.ts)
├── hooks/                  chamadas à API e laço de animação (useSimulacao, useViaturas, useEmergencia...)
├── store/                  estado global (zustand)
├── share/                  api.ts (único lugar que chama o fetch), tipos do contrato e constantes
└── utils/                  funções puras de geometria e movimento
```

## Como rodar

> **A API precisa estar rodando** em `http://localhost:5080`. Veja como subir no [repositório da API](https://github.com/DavidTrabuco/Corredor-Verde-API-) (`dotnet run --project CorredorVerde`).

```bash
cp .env.example .env
npm install
npm run dev
```

Abra `http://localhost:5173`.

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe a maquete em modo desenvolvimento |
| `npm run build` | Confere os tipos e gera a versão de produção em `dist/` |
| `npm run lint` | Roda o ESLint |
| `npm run preview` | Serve o `dist/` localmente |

## Testes e CI

Os testes automatizados das regras de negócio (RN01 a RN15) e o CI ficam no **[repositório da API](https://github.com/DavidTrabuco/Corredor-Verde-API-)**, em xUnit. A maquete não tem regra de negócio; o que depende da tela é conferido pelo roteiro manual abaixo.

## Roteiro de teste manual

Requisitos que dependem de olhar a tela. Com a API e a maquete rodando:

| Passo | Resultado esperado | Requisito |
|---|---|---|
| Observe um cruzamento sem emergência por 20 s | As faixas de parada mudam de cor (verde → amarelo → vermelho) em até 1 s depois da troca na API | RNF08 |
| Clique em “Emergência da ambulância” e depois num cruzamento | A ocorrência é registrada com **2 cliques** e o pino vermelho aparece no mapa | RNF09 |
| Registre uma emergência e simule uma falha | Rota, corredor, ocorrência e falha aparecem cada um com cor própria, e todas estão na legenda | RNF10 |
| Abra `http://localhost:5173` no Chrome, no Edge e no Firefox | A maquete abre e funciona igual nos três | RNF13 |

## Roteiro de demonstração

1. **Patrulha.** Abra a maquete e mostre as viaturas AMB-01 e BOM-01 patrulhando sozinhas, enquanto as de reserva ficam estacionadas nas bases (UC01).
2. **Emergência perto da base.** Clique em “Emergência da ambulância” e em C16. Sai a **AMB-02** (reserva), que está mais perto; o corredor verde abre na rota (RN04, RN06, RN15).
3. **Emergência longe da base.** Registre outra emergência de ambulância longe de C11 (por exemplo C5). Sai a viatura da patrulha (RN15).
4. **Desvio dirigindo a AMB-01.** Durante uma emergência, use as setas para tirar a AMB-01 da rota. A API recalcula o caminho e o corredor muda (RN10, UC07).
5. **Conflito com os bombeiros.** Registre uma emergência dos bombeiros cuja rota cruze a da ambulância. O anel tracejado mostra quem perdeu, e o log explica quem passa primeiro (RN12, UC08).
6. **Falha num cruzamento da rota.** Clique em “Simular falha” e num cruzamento da rota. Ele fica piscando, a rota desvia e a viatura espera 1 s nos piscantes (RN13, UC09).
7. **Aba Requisitos.** Abra o painel lateral e mostre a contagem de quantas vezes cada RN e UC apareceu no log (RN14, UC10).

## Docker

```bash
docker build -t corredorverde-maquete --build-arg VITE_API_URL=http://localhost:5080/api/v1 .
docker run -p 8080:80 corredorverde-maquete
```
