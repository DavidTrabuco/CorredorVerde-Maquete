# Contrato da API — Corredor Verde

Este arquivo é a fonte da verdade entre os dois repositórios:

- **CorredorVerde-API** (C# / ASP.NET Core) implementa estes endpoints.
- **CorredorVerde-Maquete** (React) consome estes endpoints.

Se um lado mudar algo aqui, o outro precisa mudar junto.

Os IDs de requisito (RN, UC, RNF) são os do documento `1a_Entrega_Gestao_Dinamica_de_Trafego_maquete.docx` e do `requisitos.json`.

---

## Convenções

- **Prefixo:** todas as rotas começam com `/api/v1`, como no ShopFlow.
- **JSON:** os campos usam camelCase. Enums são enviados como **texto** (`JsonStringEnumConverter`), por exemplo `"Ambulancia"` e `"Verde"`.
- **Erros:** todo erro sai como **ProblemDetails** (RFC 9457), no mesmo formato do `GlobalExceptionHandler` do ShopFlow.

  ```json
  { "status": 409, "title": "Conflito", "detail": "AMB-01 e AMB-02 estão ocupadas. Espere uma delas terminar.", "instance": "/api/v1/ocorrencias" }
  ```
- **Tempo:** o tempo é **simulado**, em segundos desde o início da simulação (`tempoSeg`), e não a hora real.
- **Portas e CORS:** a API roda em `http://localhost:5080`, e a maquete em `http://localhost:5173` (porta padrão do Vite). A origem da maquete precisa estar liberada no CORS da API (`Cors:Origens` no appsettings).

## Enums

| Enum | Valores |
|---|---|
| `Eixo` | `NS` (Norte-Sul), `LO` (Leste-Oeste) |
| `Direcao` | `N`, `S`, `L`, `O` |
| `Luz` | `Verde`, `Amarelo`, `Vermelho`, `Piscante` |
| `TipoViatura` | `Ambulancia`, `Bombeiros` |
| `PapelViatura` | `Patrulha`, `Reserva` |
| `ModoViatura` | `Patrulha`, `Emergencia`, `Atendimento`, `Retorno`, `Reserva` |
| `StatusOcorrencia` | `ACaminho`, `EmAtendimento`, `ACaminhoHospital`, `Encerrada` |
| `TipoEvento` | `Info`, `Evento`, `Alerta`, `Erro`, `Api` |

---

## Leitura (polling da maquete)

### `GET /api/v1/malha`
É chamado uma vez, quando a maquete abre.
```json
{
  "colunas": 5,
  "linhas": 4,
  "cruzamentos": [ { "id": "C1", "coluna": 0, "linha": 0 } ],
  "hospitais": [ { "id": "H1", "nome": "Hospital Norte", "cruzamento": "C3" } ],
  "bases": [ { "nome": "Base do SAMU", "cruzamento": "C11", "tipo": "Ambulancia" } ]
}
```
Os IDs vão de `C1` a `C20`, linha por linha: `C1..C5` na linha 0 e `C16..C20` na linha 3. A conta é `id = linha * colunas + coluna + 1`.

### `GET /api/v1/estado`
É o endpoint principal do polling, chamado a cada **250 ms** (RNF08). Ele junta tudo numa resposta só.
```json
{
  "tempoSeg": 83.4,
  "pausado": false,
  "velocidade": 1,
  "semaforos": [ /* SemaforoResponse[] */ ],
  "viaturas": [ /* ViaturaResponse[] */ ],
  "ocorrencias": [ /* OcorrenciaResponse[] */ ]
}
```

Para quem preferir chamar separado, também existem `GET /api/v1/semaforos`, `GET /api/v1/viaturas` e `GET /api/v1/ocorrencias`, com os mesmos objetos.

**SemaforoResponse**
```json
{
  "cruzamento": "C7",
  "ns": "Verde",
  "lo": "Vermelho",
  "falha": false,
  "reservas": [ { "viaturaId": "AMB-01", "eixo": "NS" } ],
  "vencedor": "AMB-01"
}
```
O campo `vencedor` traz o ID da viatura que tem a prioridade no cruzamento (RN12), ou `null` quando não há reserva.

**ViaturaResponse**
```json
{
  "id": "AMB-02",
  "tipo": "Ambulancia",
  "papel": "Reserva",
  "base": "C11",
  "modo": "Emergencia",
  "cruzamento": "C11",
  "indoPara": "C16",
  "trecho": 1,
  "destino": "C16",
  "semRota": false,
  "rota": [ { "cruzamento": "C16", "eixo": "NS" } ],
  "previsao": [ "C16", "C17", "C18" ],
  "ocorrenciaId": "OC-002",
  "atendimentoRestanteSeg": 0,
  "hospital": "Hospital Sul"
}
```
- **`cruzamento`:** o último cruzamento por onde a viatura passou.
- **`indoPara`:** o próximo cruzamento, quando ela está andando numa rua; `null` quando está parada num cruzamento.
- **`rota`:** os cruzamentos que ainda faltam no trecho atual. Vem vazia fora da emergência e do retorno.
- **`previsao`:** o trecho 2 previsto, do local da ocorrência até o hospital. Só aparece no trecho 1 da ambulância e serve para a linha tracejada no mapa.

**OcorrenciaResponse**
```json
{
  "id": "OC-002",
  "cruzamento": "C16",
  "criticidade": 2,
  "tipo": "Ambulancia",
  "viaturaId": "AMB-02",
  "status": "ACaminho",
  "registradaEmSeg": 41.2,
  "encerradaEmSeg": null,
  "hospital": "Hospital Sul"
}
```

### `GET /api/v1/log?desde={seq}`
Devolve os eventos com `seq` maior que `desde`, em ordem crescente. Sem o parâmetro, devolve os 300 mais recentes (UC10, RN14).
```json
[ { "seq": 57, "tempoSeg": 41.2, "tags": ["RN15", "UC03"], "mensagem": "AMB-02 é a viatura livre mais perto de C16 (1 quarteirão; AMB-01 a 5 quarteirões), sai da reserva.", "tipo": "Evento" } ]
```

### `PUT` ou `DELETE /api/v1/log/{seq}`
Sempre responde **405**, porque o log não pode ser alterado (RNF05).

---

## Ações

### `POST /api/v1/ocorrencias` (UC03, RN04, RN15)
Requisição:
```json
{ "tipo": "Ambulancia", "cruzamento": "C16", "criticidade": 2 }
```

| Resposta | Quando |
|---|---|
| **201** com `OcorrenciaResponse` | A ocorrência foi registrada. O `viaturaId` mostra qual viatura foi escolhida: a livre mais perto, e em empate a da patrulha. |
| **400** | Tipo inválido, cruzamento inexistente ou criticidade fora de 1 a 3 (RNF04). |
| **409** | Nenhuma viatura livre do tipo pedido. |

### `POST /api/v1/viaturas/{id}/saida` (UC01, UC07)
A maquete chama esta rota quando a viatura **sai** de um cruzamento e entra numa rua.
```json
{ "de": "C11", "para": "C12" }
```

| Resposta | Quando |
|---|---|
| **204** | Saída registrada. Se a viatura estiver em emergência e `para` não for o próximo cruzamento da rota, a API recalcula a rota (RN10). |
| **400** | `de` e `para` não são vizinhos, ou um dos cruzamentos não existe. |
| **404** | Viatura inexistente. |
| **409** | A viatura está em atendimento. |

### `POST /api/v1/viaturas/{id}/chegada` (UC01, UC06)
A maquete chama esta rota quando a viatura **chega** ao centro de um cruzamento.
```json
{ "cruzamento": "C12" }
```
Responde **204**. Se a viatura estiver em emergência, o cruzamento sai da reserva e volta ao ciclo normal (RN08). Se ela chegou ao destino, começa o atendimento (RN09) ou termina o serviço (RN15).

### `GET /api/v1/cruzamentos/{id}/pode-atravessar?eixo=NS&viaturaId=AMB-01` (RN07, RN13)
A maquete pergunta antes de cruzar a faixa de parada.
```json
{ "pode": true, "cautela": false, "luz": "Verde" }
```
Com `luz: "Piscante"`, a resposta vem com `pode: true` e `cautela: true`. Nesse caso, a maquete para a viatura por `cautelaSeg` (1 s) e depois segue.

### `POST /api/v1/cruzamentos/{id}/falha` (UC09, RN13)
```json
{ "ativa": true }
```
Responde **204**, ou **400** se o cruzamento não existir.

### `POST /api/v1/simulacao/controle`
Equivale aos botões Pausar e Velocidade da maquete.
```json
{ "pausado": false, "velocidade": 2 }
```
Responde **204**. A `velocidade` aceita 1, 2 ou 4, e qualquer outro valor dá **400**. O relógio da simulação anda `velocidade × tempo real`.

### `POST /api/v1/simulacao/reiniciar`
Equivale ao botão Reiniciar. Volta tudo ao estado inicial: semáforos, viaturas nas bases, nenhuma ocorrência e o log zerado com o evento "Maquete pronta". Responde **204**.

O `GET /api/v1/estado` também devolve `"pausado": false` e `"velocidade": 1`.

---

## Quem faz o quê

| Responsabilidade | API (C#) | Maquete (React) |
|---|:---:|:---:|
| Ciclo dos semáforos, corredor, conflito, falha (RN01 a RN03, RN06, RN08, RN12, RN13) | ✔ | |
| Rotas, hospital mais próximo e despacho da viatura mais perto (RN04, RN05, RN15) | ✔ | |
| Tempo de atendimento, encerramento e retorno da reserva à base (RN09, RN11, RN15) | ✔ | |
| Log de eventos (RN14) | ✔ | |
| Relógio da simulação (`BackgroundService` com `TimeProvider`) | ✔ | |
| Desenho do mapa, animação e lado da pista | | ✔ |
| Patrulha: escolher uma rua ao acaso em cada cruzamento, sem dar meia-volta | | ✔ |
| Seguir a `rota` quando a viatura está em `Emergencia` ou `Retorno` | | ✔ |
| Perguntar `pode-atravessar` na faixa e avisar `saida` e `chegada` | | ✔ |
| Carros comuns (só animação, mas param no vermelho e no amarelo) | | ✔ |
| Controle manual da AMB-01 pelo teclado (setas ou WASD) | | ✔ |
