/* =====================================================================
   LÓGICA DE REFERÊNCIA — Corredor Verde (playground em JavaScript)
   ---------------------------------------------------------------------
   Este arquivo é o MAPA para a API em C#. Ele já funciona e passa nos
   20 testes do array TESTES (no fim do arquivo).

   - A classe `Sistema` contém todas as regras de negócio (RN01 a RN15).
     Os comentários indicam qual regra cada trecho implementa.
   - `criarApi` mostra as rotas e os códigos HTTP (sem o prefixo /api/v1).
   - `criarMotorista` é o "motorista simulado" usado nos testes.
   - `TESTES` são os cenários que devem virar testes xUnit.

   ATENÇÃO: os nomes aqui são internos (no, indo, enums em MAIÚSCULAS).
   O formato oficial dos dados está em contrato-api.md.
   Para rodar sozinho: node -e "globalThis.REQS=require('./requisitos.json');require('./logica-referencia.js');console.log(Logica.rodarTestes().map(t=>(t.ok?'PASS ':'FAIL ')+t.nome).join('\n'))"
   ===================================================================== */
/* =====================================================================
   CAMADA "BACKEND" — é isto que vocês vão escrever em C# (ASP.NET Core).
   Cada classe/função abaixo corresponde a uma entidade, regra ou endpoint.
   ===================================================================== */
(function (raiz) {
  const REQS = raiz.REQS;

  // appsettings.json (RNF12)
  const CONFIG_PADRAO = Object.assign({
    colunas: REQS.malha.colunas,
    linhas: REQS.malha.linhas
  }, REQS.config);

  const DIRS = {
    N: { dx: 0, dy: -1, eixo: 'NS' },
    S: { dx: 0, dy: 1, eixo: 'NS' },
    L: { dx: 1, dy: 0, eixo: 'LO' },
    O: { dx: -1, dy: 0, eixo: 'LO' }
  };
  const OPOSTO = { N: 'S', S: 'N', L: 'O', O: 'L' };
  const NOME_EIXO = { NS: 'Norte-Sul', LO: 'Leste-Oeste' };

  // TimeProvider: nos testes o relógio é avançado sem esperar de verdade
  class Relogio {
    constructor() { this.agora = 0; }
    avancar(seg) { this.agora += seg; }
  }

  class ErroApi extends Error {
    constructor(status, mensagem) { super(mensagem); this.status = status; }
  }

  class Sistema {
    constructor(config) {
      this.cfg = Object.assign({}, CONFIG_PADRAO, config || {});
      this.relogio = new Relogio();
      this.cruzamentos = new Map();
      for (let lin = 0; lin < this.cfg.linhas; lin++) {
        for (let col = 0; col < this.cfg.colunas; col++) {
          const id = this.idDe(col, lin);
          // fases defasadas para a malha não trocar toda de uma vez
          const defasagem = ((col * 3 + lin * 5) % 10);
          this.cruzamentos.set(id, {
            id, col, lin,
            semaforo: { eixo: (col + lin) % 2 === 0 ? 'NS' : 'LO', estado: 'VERDE', desde: -defasagem, falha: false },
            reservas: []
          });
        }
      }
      this.hospitais = REQS.malha.hospitais.filter(h => this.cruzamentos.has(h.no));
      this.viaturas = new Map();
      this.bases = REQS.malha.bases;
      for (const b of REQS.malha.viaturas) {
        const no = this.cruzamentos.has(b.base) ? b.base : this.idDe(0, 0);
        this.viaturas.set(b.id, {
          id: b.id, tipo: b.tipo, papel: b.papel, base: no, no, indo: null,
          modo: b.papel === 'RESERVA' ? 'RESERVA' : 'PATRULHA', ocorrencia: null, trecho: 0, destino: null,
          rota: [], previsao: [], semRota: false, atendimentoAte: null, proximaTentativa: 0
        });
      }
      this.ocorrencias = [];
      this.seqOcorrencia = 0;
      this.log = [];
      this.seqLog = 0;
      this.contagem = {};
      this.jaLogado = new Set();
    }

    get t() { return this.relogio.agora; }
    idDe(col, lin) { return 'C' + (lin * this.cfg.colunas + col + 1); }

    // ---------- log de eventos (RN14) ----------
    registrar(tags, mensagem, tipo) {
      const e = { seq: ++this.seqLog, t: this.t, tags, mensagem, tipo: tipo || 'evento' };
      this.log.push(e);
      if (this.log.length > 3000) this.log.splice(0, this.log.length - 3000);
      for (const tag of tags) this.contar(tag);
      if (tipo !== 'api' && tags.some(x => x !== 'API')) this.contar('RN14');
      return e;
    }
    contar(tag, n) { this.contagem[tag] = (this.contagem[tag] || 0) + (n || 1); }

    // ---------- malha ----------
    cruzamento(id) {
      const c = this.cruzamentos.get(id);
      if (!c) throw new ErroApi(400, `Cruzamento ${id} não existe na malha.`);
      return c;
    }
    vizinho(id, dir) {
      const c = this.cruzamento(id), d = DIRS[dir];
      const col = c.col + d.dx, lin = c.lin + d.dy;
      if (col < 0 || lin < 0 || col >= this.cfg.colunas || lin >= this.cfg.linhas) return null;
      return this.idDe(col, lin);
    }
    direcaoEntre(a, b) {
      for (const d of ['N', 'L', 'S', 'O']) if (this.vizinho(a, d) === b) return d;
      return null;
    }

    // ---------- semáforos (RN01, RN02, RN03, RN13) ----------
    luz(id, eixo) {
      const s = this.cruzamento(id).semaforo;
      if (s.falha) return 'PISCANTE';
      return s.eixo === eixo ? s.estado : 'VERMELHO';
    }
    vencedor(c) {
      if (!c.reservas.length) return null;
      return c.reservas.slice().sort((a, b) => a.criticidade - b.criticidade || a.ordem - b.ordem)[0];
    }
    trocarFase(s) {
      s.eixo = s.eixo === 'NS' ? 'LO' : 'NS';
      s.estado = 'VERDE';
      s.desde = this.t;
      this.contar('UC02');
      this.contar('RN01');
    }
    atualizarSemaforo(c) {
      const s = c.semaforo, cfg = this.cfg, t = this.t, eps = 1e-9;
      if (s.falha) return;
      const w = this.vencedor(c);
      if (w) {
        if (s.eixo === w.eixo) {
          // amarelo da direção do corredor volta ao verde: ninguém perde o verde, RN02 continua valendo
          if (s.estado === 'AMARELO') { s.estado = 'VERDE'; s.desde = t; }
          return;
        }
        if (s.estado === 'VERDE') { s.estado = 'AMARELO'; s.desde = t; this.contar('RN02'); return; }
        if (t - s.desde >= cfg.amareloSeg - eps) this.trocarFase(s);
        return;
      }
      if (s.estado === 'VERDE' && t - s.desde >= cfg.verdeSeg - eps) {
        s.estado = 'AMARELO'; s.desde = t; this.contar('RN02');
      } else if (s.estado === 'AMARELO' && t - s.desde >= cfg.amareloSeg - eps) {
        this.trocarFase(s); this.contar('RN03');
      }
    }

    // RN07: só atravessa com verde; com falha passa com cautela (RN13)
    podeAtravessar(id, eixo, viaturaId) {
      const l = this.luz(id, eixo);
      if (l === 'VERDE') return { pode: true, luz: l };
      if (l === 'PISCANTE') return { pode: true, cautela: true, luz: l };
      const chave = `espera:${viaturaId}:${id}`;
      const vEsp = viaturaId ? this.viaturas.get(viaturaId) : null;
      if (!vEsp || vEsp.modo !== 'EMERGENCIA') { this.contar('RN07'); return { pode: false, luz: l }; }
      if (!this.jaLogado.has(chave)) {
        this.jaLogado.add(chave);
        this.registrar(['RN07', 'UC01'], `${viaturaId} parou na faixa de ${id}: ${l.toLowerCase()} para ${NOME_EIXO[eixo]}. Espera o verde.`);
      }
      return { pode: false, luz: l };
    }

    // ---------- rotas (RN05) ----------
    menorCaminho(origem, destino) {
      this.cruzamento(origem); this.cruzamento(destino);
      if (origem === destino) return [];
      const anterior = new Map([[origem, null]]);
      const fila = [origem];
      while (fila.length) {
        const atual = fila.shift();
        for (const d of ['N', 'L', 'S', 'O']) {
          const v = this.vizinho(atual, d);
          if (!v || anterior.has(v)) continue;
          if (v !== destino && this.cruzamentos.get(v).semaforo.falha) continue;
          anterior.set(v, atual);
          if (v === destino) {
            const caminho = [];
            for (let x = destino; x !== origem; x = anterior.get(x)) caminho.unshift(x);
            return caminho;
          }
          fila.push(v);
        }
      }
      return null;
    }
    montarRota(origem, caminho) {
      const rota = [];
      let ant = origem;
      for (const no of caminho) {
        rota.push({ no, eixo: DIRS[this.direcaoEntre(ant, no)].eixo });
        ant = no;
      }
      return rota;
    }
    hospitalMaisProximo(no) {
      let melhor = null;
      for (const h of this.hospitais) {
        const c = this.menorCaminho(no, h.no);
        if (c && (!melhor || c.length < melhor.dist)) melhor = { hospital: h, dist: c.length };
      }
      return melhor ? melhor.hospital : null;
    }

    // ---------- ocorrências (UC03) ----------
    registrarOcorrencia(dados) {
      dados = dados || {};
      if (dados.tipo !== 'AMBULANCIA' && dados.tipo !== 'BOMBEIROS') throw new ErroApi(400, `Tipo de viatura ${dados.tipo} inválido: use AMBULANCIA ou BOMBEIROS.`);
      this.cruzamento(dados.cruzamento);
      const crit = Number(dados.criticidade);
      if (!Number.isInteger(crit) || crit < 1 || crit > 3) throw new ErroApi(400, `Criticidade ${dados.criticidade} inválida: use 1, 2 ou 3.`);
      const escolha = this.escolherViatura(dados.tipo, dados.cruzamento);
      if (!escolha) {
        const nomes = [...this.viaturas.values()].filter(x => x.tipo === dados.tipo).map(x => x.id).join(' e ');
        throw new ErroApi(409, `${nomes} estão ocupadas. Espere uma delas terminar.`);
      }
      const v = escolha.viatura;
      const q = n => n === Infinity ? 'sem caminho' : `${n} ${n === 1 ? 'quarteirão' : 'quarteirões'}`;
      const outras = escolha.outras.map(o => `${o.viatura.id} a ${q(o.dist)}`).join(', ');
      const saida = v.modo === 'RESERVA' ? ', sai da reserva' : v.modo === 'RETORNO' ? ', estava voltando à base' : '';
      this.registrar(['RN15', 'UC03'], `${v.id} é a viatura livre mais perto de ${dados.cruzamento} (${q(escolha.dist)}${outras ? '; ' + outras : ''})${saida}.`);
      if (v.modo === 'RETORNO') v.rota = [];
      v.semRota = false;

      const oc = {
        id: 'OC-' + String(++this.seqOcorrencia).padStart(3, '0'),
        no: dados.cruzamento, criticidade: crit, viaturaId: v.id, ordem: this.seqOcorrencia,
        status: 'A_CAMINHO', registradaEm: this.t, hospital: null
      };
      this.ocorrencias.push(oc);
      v.modo = 'EMERGENCIA'; v.ocorrencia = oc; v.trecho = 1; v.destino = oc.no;
      if (v.tipo === 'AMBULANCIA') {
        oc.hospital = this.hospitalMaisProximo(oc.no);
        const c = oc.hospital ? this.menorCaminho(oc.no, oc.hospital.no) : null;
        v.previsao = c ? [oc.no].concat(c) : [];
        this.registrar(['UC03', 'RN04'], `${oc.id} registrada em ${oc.no} (criticidade ${crit}) para ${v.id}. Trechos: ${v.indo || v.no} → ${oc.no} → ${oc.hospital ? oc.hospital.nome : 'sem hospital alcançável'}.`);
      } else {
        v.previsao = [];
        this.registrar(['UC03', 'RN11'], `${oc.id} registrada em ${oc.no} (criticidade ${crit}) para ${v.id}. Bombeiros vão só até o local.`);
      }
      this.iniciarTrecho(v);
      return oc;
    }

    // RN15: vai a viatura livre mais perto do local; em empate, a da patrulha
    escolherViatura(tipo, destino) {
      const livres = [...this.viaturas.values()].filter(v => v.tipo === tipo && ['PATRULHA', 'RESERVA', 'RETORNO'].includes(v.modo));
      if (!livres.length) return null;
      const lista = livres.map(v => {
        const c = this.menorCaminho(v.indo || v.no, destino);
        return { viatura: v, dist: c === null ? Infinity : c.length + (v.indo ? 1 : 0) };
      }).sort((a, b) => a.dist - b.dist || (a.viatura.papel === 'PATRULHA' ? -1 : 1) - (b.viatura.papel === 'PATRULHA' ? -1 : 1) || a.viatura.id.localeCompare(b.viatura.id));
      return { viatura: lista[0].viatura, dist: lista[0].dist, outras: lista.slice(1) };
    }

    // RN15: a reserva volta para a base sem corredor
    iniciarRetorno(v) {
      v.modo = 'RETORNO'; v.ocorrencia = null; v.trecho = 0; v.destino = v.base; v.previsao = []; v.atendimentoAte = null;
      const origem = v.indo || v.no;
      if (!v.indo && v.no === v.base) { this.chegouNaBase(v); return; }
      const caminho = this.menorCaminho(origem, v.base);
      if (caminho === null) { v.semRota = true; v.rota = []; v.proximaTentativa = this.t + 1; return; }
      v.semRota = false;
      let rota = [];
      if (v.indo) rota.push({ no: v.indo, eixo: DIRS[this.direcaoEntre(v.no, v.indo)].eixo });
      v.rota = rota.concat(this.montarRota(origem, caminho));
    }
    // "à Base do SAMU" / "ao Quartel dos Bombeiros"
    nomeBase(v, prep) {
      const base = this.bases.find(b => b.no === v.base);
      const nome = base ? base.nome : 'base ' + v.base;
      const masc = /^Quartel/.test(nome);
      const formas = { a: masc ? 'ao' : 'à', por: masc ? 'pelo' : 'pela', para: masc ? 'para o' : 'para a' };
      return `${formas[prep]} ${nome}`;
    }
    chegouNaBase(v) {
      v.rota = []; v.destino = null; v.semRota = false; v.no = v.base; v.indo = null;
      if (v.papel === 'RESERVA') {
        v.modo = 'RESERVA';
        this.registrar(['RN15'], `${v.id} chegou ${this.nomeBase(v, 'a')} e ficou de reserva.`);
      } else {
        this.voltarAPatrulha(v);
        this.registrar(['RN15'], `${v.id} passou ${this.nomeBase(v, 'por')} e voltou a patrulhar.`);
      }
    }
    terminarServico(v) {
      if (v.papel === 'RESERVA') {
        this.registrar(['RN15', 'UC05'], `${v.id} é de reserva: terminou o serviço e volta ${this.nomeBase(v, 'para')}, sem corredor verde.`);
        this.iniciarRetorno(v);
      } else {
        this.voltarAPatrulha(v);
        this.registrar(['RN15', 'UC05'], `${v.id} terminou o serviço e volta a patrulhar a partir de ${v.indo || v.no}.`);
      }
    }

    // ---------- corredor verde (RN05, RN06) ----------
    iniciarTrecho(v) {
      const origem = v.indo || v.no;
      const caminho = this.menorCaminho(origem, v.destino);
      if (caminho === null) {
        v.semRota = true; v.rota = []; v.proximaTentativa = this.t + 1;
        const chave = `semrota:${v.id}:${v.destino}:${v.trecho}`;
        if (!this.jaLogado.has(chave)) {
          this.jaLogado.add(chave);
          this.registrar(['RN13', 'RNF03', 'UC04'], `Sem caminho de ${origem} até ${v.destino}: semáforos em falha bloqueiam a passagem. ${v.id} foi avisada e aguarda.`, 'alerta');
        }
        return;
      }
      v.semRota = false;
      let rota = [];
      if (v.indo) rota.push({ no: v.indo, eixo: DIRS[this.direcaoEntre(v.no, v.indo)].eixo });
      rota = rota.concat(this.montarRota(origem, caminho));
      v.rota = rota;
      if (!rota.length) { this.chegouAoDestino(v); return; }
      const oc = v.ocorrencia;
      for (const r of rota) {
        const c = this.cruzamentos.get(r.no);
        c.reservas.push({ viaturaId: v.id, ocorrenciaId: oc.id, eixo: r.eixo, criticidade: oc.criticidade, ordem: oc.ordem });
      }
      this.contar('RN05');
      this.registrar(['RN06', 'UC04'], `Corredor verde aberto para ${v.id} (trecho ${v.trecho}, ${rota.length} cruzamento${rota.length > 1 ? 's' : ''}): ${rota.map(r => r.no).join(' → ')}.`);
      for (const r of rota) {
        const c = this.cruzamentos.get(r.no);
        this.verificarConflito(c);
        this.atualizarSemaforo(c);
      }
    }

    // RN12
    verificarConflito(c) {
      if (c.reservas.length < 2) return;
      const w = this.vencedor(c);
      for (const r of c.reservas) {
        if (r.eixo === w.eixo) continue;
        const chave = `conflito:${c.id}:${w.ocorrenciaId}:${r.ocorrenciaId}`;
        if (this.jaLogado.has(chave)) continue;
        this.jaLogado.add(chave);
        const motivo = w.criticidade < r.criticidade
          ? `criticidade ${w.criticidade} vence ${r.criticidade}`
          : `mesma criticidade (${w.criticidade}); ${w.ocorrenciaId} foi registrada primeiro`;
        this.registrar(['RN12', 'UC08'], `Conflito em ${c.id}: ${w.viaturaId} (${NOME_EIXO[w.eixo]}) passa antes de ${r.viaturaId} (${NOME_EIXO[r.eixo]}), ${motivo}.`, 'alerta');
      }
    }

    liberar(c, viaturaId) {
      const antes = c.reservas.length;
      c.reservas = c.reservas.filter(r => r.viaturaId !== viaturaId);
      if (c.reservas.length === antes) return false;
      if (!c.reservas.length) c.semaforo.desde = this.t;
      this.atualizarSemaforo(c);
      return true;
    }
    liberarTodas(v) {
      const liberados = [];
      for (const c of this.cruzamentos.values()) if (this.liberar(c, v.id)) liberados.push(c.id);
      return liberados;
    }

    // ---------- posição da viatura (UC01, UC06, UC07) ----------
    saida(viaturaId, de, para) {
      const v = this.viaturas.get(viaturaId);
      if (!v) throw new ErroApi(404, `Viatura ${viaturaId} não existe.`);
      this.cruzamento(de); this.cruzamento(para);
      if (!this.direcaoEntre(de, para)) throw new ErroApi(400, `${de} e ${para} não são vizinhos.`);
      if (v.modo === 'ATENDIMENTO') throw new ErroApi(409, `${v.id} está em atendimento.`);
      v.no = de; v.indo = para;
      if (v.modo === 'RETORNO') {
        if (v.semRota || (v.rota.length && v.rota[0].no !== para)) this.iniciarRetorno(v);
        return v;
      }
      if (v.modo !== 'EMERGENCIA') return v;
      if (v.semRota) { this.iniciarTrecho(v); return v; }
      if (v.rota.length && v.rota[0].no !== para) {
        const antes = v.rota.map(r => r.no);
        this.registrar(['RN10', 'UC07'], `${v.id} saiu da rota em ${de} (foi para ${para}, a rota pedia ${antes[0]}). Recalculando o trecho.`, 'alerta');
        this.liberarTodas(v);
        this.iniciarTrecho(v);
        const depois = new Set(v.rota.map(r => r.no));
        const soltos = antes.filter(n => !depois.has(n));
        if (soltos.length) this.registrar(['RN10', 'RN08'], `Saíram do trajeto e voltaram ao ciclo normal: ${soltos.join(', ')}.`);
      }
      return v;
    }

    chegada(viaturaId, no) {
      const v = this.viaturas.get(viaturaId);
      if (!v) throw new ErroApi(404, `Viatura ${viaturaId} não existe.`);
      this.cruzamento(no);
      v.no = no; v.indo = null;
      this.jaLogado.delete(`espera:${v.id}:${no}`);
      this.contar('UC01');
      if (v.modo === 'RETORNO') {
        if (v.rota.length && v.rota[0].no === no) v.rota.shift();
        if (no === v.base) this.chegouNaBase(v);
        else if (!v.rota.length || v.semRota) this.iniciarRetorno(v);
        return v;
      }
      if (v.modo !== 'EMERGENCIA') return v;
      if (v.rota.length && v.rota[0].no === no) {
        v.rota.shift();
        if (this.liberar(this.cruzamentos.get(no), v.id)) {
          this.registrar(['RN08', 'UC06'], `${v.id} passou por ${no}: cruzamento liberado, volta ao ciclo normal.`);
        }
      } else if (no !== v.destino && !v.semRota) {
        this.registrar(['RN10', 'UC07'], `${v.id} chegou a ${no}, fora da rota. Recalculando o trecho.`, 'alerta');
        this.liberarTodas(v);
        this.iniciarTrecho(v);
      }
      if (v.modo === 'EMERGENCIA' && no === v.destino && !v.rota.length) this.chegouAoDestino(v);
      return v;
    }

    // ---------- atendimento e hospital (RN09, RN11) ----------
    chegouAoDestino(v) {
      const oc = v.ocorrencia;
      this.liberarTodas(v);
      v.rota = [];
      if (v.trecho === 1) {
        v.modo = 'ATENDIMENTO';
        v.atendimentoAte = this.t + this.cfg.atendimentoSeg;
        oc.status = 'EM_ATENDIMENTO';
        this.registrar(['RN09', 'UC05'], `${v.id} chegou ao local de ${oc.id} (${oc.no}). Atendimento de ${this.cfg.atendimentoSeg} s.`);
      } else {
        oc.status = 'ENCERRADA';
        oc.encerradaEm = this.t;
        this.registrar(['RN09', 'UC05'], `${v.id} chegou ao ${oc.hospital.nome} (${oc.hospital.no}). ${oc.id} encerrada.`);
        this.terminarServico(v);
      }
    }
    voltarAPatrulha(v) {
      v.modo = 'PATRULHA'; v.ocorrencia = null; v.trecho = 0; v.destino = null;
      v.rota = []; v.previsao = []; v.semRota = false; v.atendimentoAte = null;
    }
    fimDoAtendimento(v) {
      const oc = v.ocorrencia;
      if (v.tipo !== 'AMBULANCIA') {
        oc.status = 'ENCERRADA';
        oc.encerradaEm = this.t;
        this.registrar(['RN11', 'UC05'], `${v.id} encerrou ${oc.id} no local. Bombeiros não seguem ao hospital.`);
        this.terminarServico(v);
        return;
      }
      oc.hospital = this.hospitalMaisProximo(oc.no) || oc.hospital || this.hospitais[0];
      oc.status = 'A_CAMINHO_HOSPITAL';
      v.modo = 'EMERGENCIA'; v.trecho = 2; v.destino = oc.hospital.no; v.previsao = [];
      this.registrar(['RN09', 'RN04', 'UC05'], `Atendimento de ${oc.id} concluído. ${v.id} segue ao ${oc.hospital.nome}, o hospital mais próximo.`);
      this.iniciarTrecho(v);
    }

    // ---------- falhas (UC09, RN13) ----------
    definirFalha(id, ativa) {
      const c = this.cruzamento(id);
      const s = c.semaforo;
      if (!!ativa === s.falha) return c;
      if (ativa) {
        s.falha = true;
        this.registrar(['RN13', 'UC09'], `Semáforo de ${id} em falha: amarelo piscante. Veículos param e seguem com cautela.`, 'alerta');
        for (const v of this.viaturas.values()) {
          if (v.modo === 'RETORNO' && v.rota.some(r => r.no === id && r.no !== v.base) && v.indo !== id) { this.iniciarRetorno(v); continue; }
          if (v.modo !== 'EMERGENCIA') continue;
          if (!v.rota.some(r => r.no === id && r.no !== v.destino)) continue;
          if (v.indo === id) continue; // já está entrando nele
          this.registrar(['RN13', 'RN05', 'UC09'], `A rota de ${v.id} passava por ${id}. Recalculando para desviar.`);
          this.liberarTodas(v);
          this.iniciarTrecho(v);
        }
      } else {
        s.falha = false; s.eixo = 'NS'; s.estado = 'VERDE'; s.desde = this.t;
        this.registrar(['RN13', 'UC09'], `Falha de ${id} desligada: o ciclo normal recomeça.`);
        this.atualizarSemaforo(c);
        for (const v of this.viaturas.values()) {
          if (v.modo === 'EMERGENCIA' && v.semRota) this.iniciarTrecho(v);
          if (v.modo === 'RETORNO' && v.semRota) this.iniciarRetorno(v);
        }
      }
      return c;
    }

    // ---------- temporizador (UC02, UC05) ----------
    tick(dt) {
      this.relogio.avancar(dt);
      for (const c of this.cruzamentos.values()) this.atualizarSemaforo(c);
      for (const v of this.viaturas.values()) {
        if (v.modo === 'ATENDIMENTO' && this.t >= v.atendimentoAte - 1e-9) this.fimDoAtendimento(v);
        else if (v.modo === 'EMERGENCIA' && v.semRota && this.t >= v.proximaTentativa) this.iniciarTrecho(v);
        else if (v.modo === 'RETORNO' && v.semRota && this.t >= v.proximaTentativa) this.iniciarRetorno(v);
      }
    }

    // ---------- leituras para a maquete ----------
    estadoSemaforos() {
      return [...this.cruzamentos.values()].map(c => {
        const w = this.vencedor(c);
        return {
          id: c.id, col: c.col, lin: c.lin, falha: c.semaforo.falha,
          NS: this.luz(c.id, 'NS'), LO: this.luz(c.id, 'LO'),
          reservas: c.reservas.map(r => ({ viaturaId: r.viaturaId, eixo: r.eixo })),
          vencedor: w ? w.viaturaId : null
        };
      });
    }
    estadoViaturas() {
      return [...this.viaturas.values()].map(v => ({
        id: v.id, tipo: v.tipo, papel: v.papel, base: v.base, modo: v.modo, no: v.no, indo: v.indo, trecho: v.trecho,
        destino: v.destino, semRota: v.semRota, rota: v.rota.map(r => ({ no: r.no, eixo: r.eixo })),
        previsao: v.previsao.slice(), ocorrenciaId: v.ocorrencia ? v.ocorrencia.id : null,
        atendimentoRestante: v.modo === 'ATENDIMENTO' ? Math.max(0, v.atendimentoAte - this.t) : 0,
        hospital: v.ocorrencia && v.ocorrencia.hospital ? v.ocorrencia.hospital.nome : null
      }));
    }

    // apoio para testes (equivale a montar o cenário no xUnit)
    posicionar(viaturaId, no) {
      const v = this.viaturas.get(viaturaId);
      this.cruzamento(no);
      v.no = no; v.indo = null;
    }
  }

  /* ---------------- API (controllers do ASP.NET Core) ---------------- */
  function criarApi(sis) {
    const rotas = [
      ['GET', /^\/api\/malha$/, () => ({
        colunas: sis.cfg.colunas, linhas: sis.cfg.linhas, hospitais: sis.hospitais,
        cruzamentos: [...sis.cruzamentos.values()].map(c => ({ id: c.id, col: c.col, lin: c.lin }))
      })],
      ['GET', /^\/api\/semaforos$/, () => sis.estadoSemaforos()],
      ['GET', /^\/api\/viaturas$/, () => sis.estadoViaturas()],
      ['GET', /^\/api\/ocorrencias$/, () => sis.ocorrencias.map(o => Object.assign({}, o, { hospital: o.hospital ? o.hospital.nome : null }))],
      ['GET', /^\/api\/cruzamentos\/(C\d+)\/pode-atravessar$/, (m, b) => sis.podeAtravessar(m[1], b.eixo, b.viaturaId)],
      ['GET', /^\/api\/log$/, () => sis.log.slice()],
      ['POST', /^\/api\/ocorrencias$/, (m, b) => {
        const oc = sis.registrarOcorrencia(b);
        return Object.assign({}, oc, { hospital: oc.hospital ? oc.hospital.nome : null });
      }, 201],
      ['POST', /^\/api\/viaturas\/([A-Z]+-\d+)\/saida$/, (m, b) => { sis.saida(m[1], b.de, b.para); return { ok: true }; }],
      ['POST', /^\/api\/viaturas\/([A-Z]+-\d+)\/chegada$/, (m, b) => { sis.chegada(m[1], b.cruzamento); return { ok: true }; }],
      ['POST', /^\/api\/cruzamentos\/(C\d+)\/falha$/, (m, b) => { sis.definirFalha(m[1], !!b.ativa); return { ok: true }; }]
    ];
    const tagsApi = path =>
      /saida|chegada/.test(path) ? ['API', 'UC01'] :
      /ocorrencias/.test(path) ? ['API', 'UC03'] :
      /falha/.test(path) ? ['API', 'UC09'] : ['API'];

    return {
      registrarChamadas: true,
      request(metodo, caminho, corpo) {
        corpo = corpo || {};
        if (/^\/api\/log/.test(caminho) && metodo !== 'GET') {
          // RNF05: o log não tem edição nem exclusão
          if (this.registrarChamadas) sis.registrar(['API', 'RNF05'], `${metodo} ${caminho} → 405: o log de eventos não pode ser alterado.`, 'api');
          else sis.contar('RNF05');
          return { status: 405, corpo: { erro: 'O log de eventos é somente leitura.' } };
        }
        for (const [m, re, fn, ok] of rotas) {
          if (m !== metodo) continue;
          const achou = caminho.match(re);
          if (!achou) continue;
          try {
            const r = fn(achou, corpo);
            if (metodo === 'POST' && this.registrarChamadas) sis.registrar(tagsApi(caminho), `${metodo} ${caminho} ${JSON.stringify(corpo)} → ${ok || 200}`, 'api');
            return { status: ok || 200, corpo: r };
          } catch (e) {
            if (!(e instanceof ErroApi)) throw e;
            sis.registrar(['API', 'RNF04'], `${metodo} ${caminho} ${JSON.stringify(corpo)} → ${e.status}: ${e.message}`, 'erro');
            return { status: e.status, corpo: { erro: e.message } };
          }
        }
        return { status: 404, corpo: { erro: `Rota ${metodo} ${caminho} não existe.` } };
      },
      get(c, b) { return this.request('GET', c, b); },
      post(c, b) { return this.request('POST', c, b); }
    };
  }

  /* ---------------- motorista simulado (usado nos testes) ---------------- */
  // Faz a viatura seguir a rota obedecendo os semáforos, como o piloto automático da maquete.
  function criarMotorista(sis, viaturaId, segPorQuadra) {
    const v = sis.viaturas.get(viaturaId);
    const st = { para: null, falta: 0, cautela: 0 };
    return function passo(dt) {
      if ((v.modo !== 'EMERGENCIA' && v.modo !== 'RETORNO') || v.semRota) { st.para = null; return; }
      if (!st.para) {
        if (!v.rota.length) return;
        st.para = v.rota[0].no; st.falta = segPorQuadra; st.cautela = 0;
        sis.saida(v.id, v.no, st.para);
        st.para = v.indo; // pode ter mudado
        return;
      }
      if (st.falta > 0) { st.falta -= dt; return; }
      const eixo = DIRS[sis.direcaoEntre(v.no, st.para)].eixo;
      const r = sis.podeAtravessar(st.para, eixo, v.id);
      if (!r.pode) return;
      if (r.cautela && st.cautela < sis.cfg.cautelaSeg) { st.cautela += dt; return; }
      const alvo = st.para; st.para = null;
      sis.chegada(v.id, alvo);
    };
  }

  /* ---------------- TESTES (viram métodos [Fact] no xUnit) ---------------- */
  function rng(semente) {
    let s = semente >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function afirmar(cond, msg) { if (!cond) throw new Error(msg); }
  function avancar(sis, seg, passos) {
    const dt = 0.1;
    for (let i = 0; i < Math.round(seg / dt); i++) { sis.tick(dt); if (passos) passos.forEach(p => p(dt)); }
  }
  function sistemaDeTeste(cfg) {
    const sis = new Sistema(cfg);
    const api = criarApi(sis);
    api.registrarChamadas = false;
    return { sis, api };
  }

  let cacheSimulacao = null;
  function simulacaoDeUmaHora() {
    if (cacheSimulacao) return cacheSimulacao;
    const { sis, api } = sistemaDeTeste();
    const sorteio = rng(42);
    const ids = [...sis.cruzamentos.keys()];
    const motoristas = ['AMB-01', 'AMB-02', 'BOM-01', 'BOM-02'].map(id => criarMotorista(sis, id, 1.4));
    const anterior = new Map();
    const res = { verdeDuplo: 0, semAmarelo: 0, amareloCurto: 0, excecao: null, ocorrencias: 0, encerradas: 0, falhas: 0, desvios: 0, ticks: 0 };
    const inicioAmarelo = new Map();
    const dt = 0.1;
    try {
      for (let i = 0; i < 36000; i++) {
        sis.tick(dt);
        motoristas.forEach(m => m(dt));
        res.ticks++;
        if (i % 120 === 0) {
          for (const tipo of ['AMBULANCIA', 'BOMBEIROS']) {
            if (sorteio() < 0.8) {
              const r = api.post('/api/ocorrencias', { tipo, cruzamento: ids[Math.floor(sorteio() * ids.length)], criticidade: 1 + Math.floor(sorteio() * 3) });
              if (r.status === 201) res.ocorrencias++;
            }
          }
        }
        if (i % 450 === 0) {
          const alvo = ids[Math.floor(sorteio() * ids.length)];
          const c = sis.cruzamentos.get(alvo);
          api.post(`/api/cruzamentos/${alvo}/falha`, { ativa: !c.semaforo.falha });
          res.falhas++;
        }
        if (i % 900 === 450) {
          const v = sis.viaturas.get('AMB-01');
          if (v.modo === 'EMERGENCIA' && !v.indo && v.rota.length) {
            const errado = ['N', 'L', 'S', 'O'].map(d => sis.vizinho(v.no, d)).find(n => n && n !== v.rota[0].no);
            if (errado) { sis.saida('AMB-01', v.no, errado); res.desvios++; }
          }
        }
        for (const c of sis.cruzamentos.values()) {
          const ns = sis.luz(c.id, 'NS'), lo = sis.luz(c.id, 'LO');
          if (ns === 'VERDE' && lo === 'VERDE') res.verdeDuplo++;
          for (const [eixo, luz] of [['NS', ns], ['LO', lo]]) {
            const k = c.id + eixo, ant = anterior.get(k);
            if (luz === 'AMARELO' && ant !== 'AMARELO') inicioAmarelo.set(k, sis.t);
            if (ant === 'VERDE' && luz === 'VERMELHO') res.semAmarelo++;
            if (ant === 'AMARELO' && luz === 'VERMELHO' && sis.t - inicioAmarelo.get(k) < sis.cfg.amareloSeg - 1e-6) res.amareloCurto++;
            anterior.set(k, luz);
          }
        }
      }
    } catch (e) { res.excecao = e.message; }
    res.encerradas = sis.ocorrencias.filter(o => o.status === 'ENCERRADA').length;
    cacheSimulacao = res;
    return res;
  }

  const TESTES = [
    {
      nome: 'RN01_DuasDirecoesNuncaFicamVerdesJuntas', reqs: ['RN01', 'RNF01', 'UC02'],
      rodar() {
        const r = simulacaoDeUmaHora();
        afirmar(!r.excecao, 'A simulação lançou exceção: ' + r.excecao);
        afirmar(r.verdeDuplo === 0, `${r.verdeDuplo} instantes com verde nas duas direções.`);
        return `0 verdes simultâneos em ${r.ticks.toLocaleString('pt-BR')} ticks × 20 cruzamentos, com ${r.ocorrencias} ocorrências, ${r.falhas} falhas e ${r.desvios} desvios.`;
      }
    },
    {
      nome: 'RN02_VerdeSoViraVermelhoDepoisDe2sDeAmarelo', reqs: ['RN02', 'RNF01'],
      rodar() {
        const r = simulacaoDeUmaHora();
        afirmar(r.semAmarelo === 0, `${r.semAmarelo} trocas de verde direto para vermelho.`);
        afirmar(r.amareloCurto === 0, `${r.amareloCurto} amarelos com menos de 2 s.`);
        return 'Nenhuma troca pulou o amarelo e nenhum amarelo durou menos de 2 s em 1 hora simulada.';
      }
    },
    {
      nome: 'RN03_CicloNormalTem8sDeVerdeE2sDeAmarelo', reqs: ['RN03', 'UC02'],
      rodar() {
        const { sis } = sistemaDeTeste();
        const s = sis.cruzamentos.get('C1').semaforo;
        s.eixo = 'NS'; s.estado = 'VERDE'; s.desde = 0;
        const trocas = [];
        let ant = 'NS:VERDE';
        for (let i = 0; i < 300; i++) {
          sis.tick(0.1);
          const atual = s.eixo + ':' + s.estado;
          if (atual !== ant) { trocas.push([atual, +sis.t.toFixed(1)]); ant = atual; }
        }
        const esperado = [['NS:AMARELO', 8], ['LO:VERDE', 10], ['LO:AMARELO', 18]];
        afirmar(trocas.length >= 3, 'O ciclo não trocou de fase.');
        esperado.forEach((e, i) => afirmar(trocas[i][0] === e[0] && Math.abs(trocas[i][1] - e[1]) < 0.11, `Troca ${i + 1}: esperado ${e[0]} em ${e[1]} s, veio ${trocas[i][0]} em ${trocas[i][1]} s.`));
        return 'C1: NS verde até 8 s, amarelo até 10 s, então LO verde até 18 s.';
      }
    },
    {
      nome: 'RN04_RotaTemDoisTrechosEVaiAoHospitalMaisProximo', reqs: ['RN04', 'UC03'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        const r = api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C14', criticidade: 2 });
        afirmar(r.status === 201, 'Registro falhou: ' + JSON.stringify(r.corpo));
        const v = sis.viaturas.get('AMB-01');
        afirmar(v.rota[v.rota.length - 1].no === 'C14', 'O trecho 1 não termina no local da ocorrência.');
        afirmar(r.corpo.hospital === 'Hospital Sul', `Esperado Hospital Sul (2 quarteirões de C14), veio ${r.corpo.hospital}.`);
        afirmar(v.previsao[v.previsao.length - 1] === 'C18', 'O trecho 2 previsto não termina no hospital.');
        return `Trecho 1: C11 → … → C14. Trecho 2 previsto: ${v.previsao.join(' → ')} (Hospital Sul).`;
      }
    },
    {
      nome: 'RN05_TrechoSegueOMenorCaminhoEmQuarteiroes', reqs: ['RN05'],
      rodar() {
        const { sis } = sistemaDeTeste();
        const ids = [...sis.cruzamentos.keys()];
        let n = 0;
        for (const a of ids) for (const b of ids) {
          const c = sis.menorCaminho(a, b);
          const ca = sis.cruzamentos.get(a), cb = sis.cruzamentos.get(b);
          const manhattan = Math.abs(ca.col - cb.col) + Math.abs(ca.lin - cb.lin);
          afirmar(c.length === manhattan, `${a}→${b}: ${c.length} quarteirões, menor é ${manhattan}.`);
          n++;
        }
        sis.definirFalha('C12', true);
        const desvio = sis.menorCaminho('C11', 'C13');
        afirmar(!desvio.includes('C12'), 'A rota passou por semáforo em falha.');
        return `${n} pares de cruzamentos com o menor caminho; com C12 em falha, C11→C13 vira ${desvio.join(' → ')}.`;
      }
    },
    {
      nome: 'RN06_CorredorAbreTodosOsCruzamentosEmAte2s', reqs: ['RN06', 'UC04', 'RNF06'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C5', criticidade: 1 });
        const rota = sis.viaturas.get('AMB-01').rota;
        avancar(sis, 2.0);
        const fechados = rota.filter(r => sis.luz(r.no, r.eixo) !== 'VERDE');
        afirmar(!fechados.length, `Ainda não verdes após 2 s: ${fechados.map(r => r.no).join(', ')}.`);
        return `Os ${rota.length} cruzamentos do trecho (${rota.map(r => r.no).join(' → ')}) estavam verdes em até 2 s.`;
      }
    },
    {
      nome: 'RN07_NinguemAtravessaComVermelhoOuAmarelo', reqs: ['RN07', 'UC01'],
      rodar() {
        const { sis } = sistemaDeTeste();
        const s = sis.cruzamentos.get('C7').semaforo;
        s.eixo = 'NS'; s.estado = 'VERDE';
        afirmar(sis.podeAtravessar('C7', 'NS', 'AMB-01').pode, 'Bloqueou com verde.');
        afirmar(!sis.podeAtravessar('C7', 'LO', 'AMB-01').pode, 'Liberou com vermelho.');
        s.estado = 'AMARELO';
        afirmar(!sis.podeAtravessar('C7', 'NS', 'AMB-01').pode, 'Liberou com amarelo.');
        return 'Verde libera; vermelho e amarelo seguram a viatura na faixa.';
      }
    },
    {
      nome: 'RN08_CruzamentoVoltaAoCicloDepoisDaPassagem', reqs: ['RN08', 'UC06'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C15', criticidade: 1 });
        avancar(sis, 2);
        api.post('/api/viaturas/AMB-01/saida', { de: 'C11', para: 'C12' });
        api.post('/api/viaturas/AMB-01/chegada', { cruzamento: 'C12' });
        const c = sis.cruzamentos.get('C12');
        afirmar(c.reservas.length === 0, 'C12 continua reservado depois da passagem.');
        const antes = c.semaforo.eixo;
        avancar(sis, sis.cfg.verdeSeg + sis.cfg.amareloSeg + 0.2);
        afirmar(c.semaforo.eixo !== antes, 'C12 não voltou a alternar as fases.');
        return 'C12 perdeu a reserva na passagem e alternou de fase após 10 s.';
      }
    },
    {
      nome: 'RN09_Atendimento4sDepoisHospitalEEncerra', reqs: ['RN09', 'UC05', 'RN06'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        const r = api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C9', criticidade: 1 });
        const oc = sis.ocorrencias[0];
        const motorista = criarMotorista(sis, 'AMB-01', 1.4);
        let chegouEm = null, saiuEm = null;
        for (let i = 0; i < 1200 && oc.status !== 'ENCERRADA'; i++) {
          sis.tick(0.1); motorista(0.1);
          if (oc.status === 'EM_ATENDIMENTO' && chegouEm === null) chegouEm = sis.t;
          if (oc.status === 'A_CAMINHO_HOSPITAL' && saiuEm === null) saiuEm = sis.t;
        }
        afirmar(r.status === 201, 'Registro falhou.');
        afirmar(chegouEm !== null, 'A ambulância não chegou ao local.');
        afirmar(Math.abs(saiuEm - chegouEm - 4) < 0.15, `Atendimento durou ${(saiuEm - chegouEm).toFixed(1)} s.`);
        afirmar(oc.status === 'ENCERRADA', 'A ocorrência não foi encerrada no hospital.');
        afirmar(sis.viaturas.get('AMB-01').modo === 'PATRULHA', 'Depois do hospital a ambulância da patrulha não voltou a patrulhar.');
        return `Chegou ao local em ${chegouEm.toFixed(1)} s, atendeu 4 s, encerrou no ${oc.hospital.nome} em ${oc.encerradaEm.toFixed(1)} s e voltou a patrulhar.`;
      }
    },
    {
      nome: 'RN10_DesvioRecalculaRotaELiberaCruzamentos', reqs: ['RN10', 'UC07'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C15', criticidade: 1 });
        api.post('/api/viaturas/AMB-01/saida', { de: 'C11', para: 'C6' });
        const v = sis.viaturas.get('AMB-01');
        afirmar(v.rota[0].no === 'C6', 'A nova rota não começa no cruzamento para onde a viatura foi.');
        afirmar(v.rota[v.rota.length - 1].no === 'C15', 'A nova rota não chega ao destino.');
        const presos = ['C12', 'C13', 'C14'].filter(id => !v.rota.some(r => r.no === id) && sis.cruzamentos.get(id).reservas.length);
        afirmar(!presos.length, `Continuam reservados: ${presos.join(', ')}.`);
        return `Nova rota: ${v.rota.map(r => r.no).join(' → ')}. Cruzamentos fora do trajeto foram liberados.`;
      }
    },
    {
      nome: 'RN11_BombeirosNaoSeguemAoHospital', reqs: ['RN11', 'UC05'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        api.post('/api/ocorrencias', { tipo: 'BOMBEIROS', cruzamento: 'C19', criticidade: 2 });
        const m = criarMotorista(sis, 'BOM-01', 1.4);
        const oc = sis.ocorrencias[0];
        for (let i = 0; i < 400 && oc.status !== 'ENCERRADA'; i++) { sis.tick(0.1); m(0.1); }
        afirmar(oc.status === 'ENCERRADA', 'A ocorrência dos bombeiros não foi encerrada.');
        afirmar(sis.viaturas.get('BOM-01').no === 'C19', 'Os bombeiros saíram do local.');
        afirmar(!oc.hospital, 'Os bombeiros receberam hospital de destino.');
        afirmar(sis.viaturas.get('BOM-01').modo === 'PATRULHA', 'Os bombeiros da patrulha não voltaram a patrulhar.');
        return 'BOM-01 encerrou a ocorrência em C19, sem trecho até hospital, e voltou a patrulhar dali.';
      }
    },
    {
      nome: 'RN12_ConflitoPrioridadePorCriticidadeEOrdem', reqs: ['RN12', 'UC08'],
      rodar() {
        // AMB-01 vai de C11 a C15 (Leste-Oeste por C13); BOM-01 vai de C18 a C3 (Norte-Sul por C13)
        let { sis, api } = sistemaDeTeste();
        sis.posicionar('BOM-01', 'C18');
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C15', criticidade: 2 });
        api.post('/api/ocorrencias', { tipo: 'BOMBEIROS', cruzamento: 'C3', criticidade: 1 });
        avancar(sis, 2);
        afirmar(sis.luz('C13', 'NS') === 'VERDE' && sis.luz('C13', 'LO') === 'VERMELHO', 'C13 não abriu para a criticidade 1.');
        ({ sis, api } = sistemaDeTeste());
        sis.posicionar('BOM-01', 'C18');
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C15', criticidade: 2 });
        api.post('/api/ocorrencias', { tipo: 'BOMBEIROS', cruzamento: 'C3', criticidade: 2 });
        avancar(sis, 2);
        afirmar(sis.luz('C13', 'LO') === 'VERDE', 'Em empate, C13 não abriu para a ocorrência registrada primeiro.');
        return 'Criticidade 1 venceu a 2 em C13; no empate, venceu a registrada primeiro.';
      }
    },
    {
      nome: 'RN13_FalhaFicaPiscanteERotaDesvia', reqs: ['RN13', 'UC09', 'RNF03'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C15', criticidade: 1 });
        api.post('/api/cruzamentos/C13/falha', { ativa: true });
        const v = sis.viaturas.get('AMB-01');
        afirmar(sis.luz('C13', 'NS') === 'PISCANTE', 'C13 não ficou piscante.');
        afirmar(!v.rota.some(r => r.no === 'C13'), 'A rota não desviou de C13.');
        ['C10', 'C20', 'C14'].forEach(id => api.post(`/api/cruzamentos/${id}/falha`, { ativa: true }));
        afirmar(v.semRota, 'Com C15 cercado, a viatura deveria ficar sem rota.');
        avancar(sis, 5);
        api.post('/api/cruzamentos/C14/falha', { ativa: false });
        afirmar(!v.semRota && v.rota.length, 'Ao desligar a falha, a rota não voltou.');
        return 'C13 piscante e evitado; com C15 cercado a viatura aguardou sem erro e retomou quando C14 voltou.';
      }
    },
    {
      nome: 'RN14_EventosImportantesVaoParaOLog', reqs: ['RN14', 'UC10'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        sis.posicionar('BOM-01', 'C18');
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C15', criticidade: 2 });
        api.post('/api/ocorrencias', { tipo: 'BOMBEIROS', cruzamento: 'C3', criticidade: 1 });
        api.post('/api/viaturas/AMB-01/saida', { de: 'C11', para: 'C6' });
        api.post('/api/cruzamentos/C20/falha', { ativa: true });
        const tem = tag => sis.log.some(e => e.tags.includes(tag));
        const faltam = ['UC03', 'RN06', 'RN10', 'RN12', 'RN13'].filter(t => !tem(t));
        afirmar(!faltam.length, 'Sem registro no log: ' + faltam.join(', '));
        return `${sis.log.length} eventos: ocorrência, corredor, desvio, conflito e falha registrados.`;
      }
    },
    {
      nome: 'RN15_VaiAViaturaMaisPertoPatrulhaContinuaReservaVoltaParaBase', reqs: ['RN15', 'UC03', 'UC05'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        sis.posicionar('AMB-01', 'C5');
        sis.posicionar('BOM-01', 'C1');
        const a = api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C16', criticidade: 2 });
        afirmar(a.corpo.viaturaId === 'AMB-02', `C16 fica a 1 quarteirão da Base do SAMU: esperado AMB-02, veio ${a.corpo.viaturaId}.`);
        const b = api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C4', criticidade: 2 });
        afirmar(b.corpo.viaturaId === 'AMB-01', 'C4 fica perto da AMB-01 (patrulha), mas ela não foi.');
        const c = api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C1', criticidade: 2 });
        afirmar(c.status === 409, 'Sem ambulância livre, o pedido foi aceito.');
        const d = api.post('/api/ocorrencias', { tipo: 'BOMBEIROS', cruzamento: 'C2', criticidade: 2 });
        afirmar(d.corpo.viaturaId === 'BOM-01', 'C2 fica perto dos bombeiros da patrulha (C1), mas eles não foram.');
        const e = api.post('/api/ocorrencias', { tipo: 'BOMBEIROS', cruzamento: 'C19', criticidade: 2 });
        afirmar(e.corpo.viaturaId === 'BOM-02', 'C19 fica perto do quartel, mas a reserva não saiu.');
        const ids = ['AMB-01', 'AMB-02', 'BOM-01', 'BOM-02'];
        const ms = ids.map(id => criarMotorista(sis, id, 1.4));
        const v = Object.fromEntries(ids.map(id => [id, sis.viaturas.get(id)]));
        let corredorNaVolta = false;
        for (let i = 0; i < 4000; i++) {
          sis.tick(0.1); ms.forEach(m => m(0.1));
          for (const x of Object.values(v)) if (x.modo === 'RETORNO' && [...sis.cruzamentos.values()].some(c => c.reservas.some(r => r.viaturaId === x.id))) corredorNaVolta = true;
          if (v['AMB-02'].modo === 'RESERVA' && v['BOM-02'].modo === 'RESERVA' && v['AMB-01'].modo === 'PATRULHA' && v['BOM-01'].modo === 'PATRULHA') break;
        }
        afirmar(v['AMB-01'].modo === 'PATRULHA' && v['AMB-01'].no !== 'C11', 'A AMB-01 deveria voltar a patrulhar de onde terminou, sem ir à base.');
        afirmar(v['BOM-01'].modo === 'PATRULHA' && v['BOM-01'].no === 'C2', 'O BOM-01 deveria voltar a patrulhar a partir de C2.');
        afirmar(v['AMB-02'].modo === 'RESERVA' && v['AMB-02'].no === 'C11', 'A AMB-02 não voltou à Base do SAMU.');
        afirmar(v['BOM-02'].modo === 'RESERVA' && v['BOM-02'].no === 'C20', 'A BOM-02 não voltou ao quartel.');
        afirmar(!corredorNaVolta, 'A volta para a base abriu corredor verde.');
        return `Patrulha mais perto atendeu C4 e C2 e voltou a patrulhar (AMB-01 em ${v['AMB-01'].no}, BOM-01 em C2); reservas atenderam C16 e C19 e voltaram às bases; sem ambulância livre → 409.`;
      }
    },
    {
      nome: 'RNF02_SimulacaoDe1HoraSemErro', reqs: ['RNF02', 'RNF01'],
      rodar() {
        const r = simulacaoDeUmaHora();
        afirmar(!r.excecao, 'Exceção: ' + r.excecao);
        afirmar(r.encerradas > 0, 'Nenhuma ocorrência chegou ao fim.');
        return `3.600 s simulados: ${r.ocorrencias} ocorrências (${r.encerradas} encerradas), ${r.falhas} trocas de falha, ${r.desvios} desvios, sem exceção.`;
      }
    },
    {
      nome: 'RNF04_ApiRecusaDadosInvalidos', reqs: ['RNF04', 'UC03'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        const casos = [
          [{ tipo: 'AMBULANCIA', cruzamento: 'C99', criticidade: 1 }, 400],
          [{ tipo: 'AMBULANCIA', cruzamento: 'C5', criticidade: 7 }, 400],
          [{ tipo: 'HELICOPTERO', cruzamento: 'C5', criticidade: 1 }, 400]
        ];
        for (const [corpo, esperado] of casos) {
          const r = api.post('/api/ocorrencias', corpo);
          afirmar(r.status === esperado, `${JSON.stringify(corpo)}: esperado ${esperado}, veio ${r.status}.`);
        }
        afirmar(sis.ocorrencias.length === 0, 'Pedido inválido criou ocorrência.');
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C5', criticidade: 1 });
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C6', criticidade: 1 });
        const ocupada = api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C7', criticidade: 1 });
        afirmar(ocupada.status === 409, 'Com as duas ambulâncias ocupadas, o terceiro pedido foi aceito.');
        const pulo = api.post('/api/viaturas/AMB-01/saida', { de: 'C11', para: 'C20' });
        afirmar(pulo.status === 400, 'Aceitou saída para cruzamento que não é vizinho.');
        afirmar(sis.ocorrencias.length === 2, 'O estado mudou com dados inválidos.');
        return 'Cruzamento inexistente, criticidade 7 e tipo HELICOPTERO → 400; sem ambulância livre → 409; salto entre cruzamentos → 400.';
      }
    },
    {
      nome: 'RNF05_LogNaoPodeSerAlteradoNemApagado', reqs: ['RNF05'],
      rodar() {
        const { sis, api } = sistemaDeTeste();
        api.post('/api/ocorrencias', { tipo: 'AMBULANCIA', cruzamento: 'C5', criticidade: 1 });
        const n = sis.log.length;
        const put = api.request('PUT', '/api/log/1', { mensagem: 'x' });
        const del = api.request('DELETE', '/api/log/1');
        afirmar(put.status === 405 && del.status === 405, `PUT ${put.status}, DELETE ${del.status}.`);
        afirmar(sis.log.length === n && sis.log[0].mensagem !== 'x', 'O log mudou.');
        return 'PUT e DELETE em /api/log → 405; o log ficou igual.';
      }
    },
    {
      nome: 'RNF07_RotaCalculadaEmAte50ms', reqs: ['RNF07', 'RN05'],
      rodar() {
        const { sis } = sistemaDeTeste();
        const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
        let pior = 0;
        for (let i = 0; i < 400; i++) {
          const t0 = agora();
          sis.menorCaminho('C1', 'C20');
          pior = Math.max(pior, agora() - t0);
        }
        afirmar(pior <= 50, `Pior caso ${pior.toFixed(2)} ms.`);
        return `400 cálculos de C1 a C20; pior caso ${pior.toFixed(2)} ms.`;
      }
    },
    {
      nome: 'RNF12_TemposVemDaConfiguracao', reqs: ['RNF12', 'RN03'],
      rodar() {
        const { sis } = sistemaDeTeste({ verdeSeg: 5, amareloSeg: 1 });
        const s = sis.cruzamentos.get('C1').semaforo;
        s.eixo = 'NS'; s.estado = 'VERDE'; s.desde = 0;
        avancar(sis, 5.0);
        afirmar(s.estado === 'AMARELO', 'Com verdeSeg = 5 o amarelo não começou em 5 s.');
        avancar(sis, 1.0);
        afirmar(s.eixo === 'LO' && s.estado === 'VERDE', 'Com amareloSeg = 1 a troca não ocorreu em 1 s.');
        return 'Com verdeSeg = 5 e amareloSeg = 1, o ciclo seguiu os novos tempos sem mudar código.';
      }
    }
  ];

  function rodarTestes() {
    cacheSimulacao = null;
    const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    return TESTES.map(t => {
      const t0 = agora();
      try {
        const detalhe = t.rodar();
        return { nome: t.nome, reqs: t.reqs, ok: true, detalhe, ms: agora() - t0 };
      } catch (e) {
        return { nome: t.nome, reqs: t.reqs, ok: false, detalhe: e.message, ms: agora() - t0 };
      }
    });
  }

  raiz.Logica = { Sistema, criarApi, rodarTestes, DIRS, OPOSTO, NOME_EIXO, ErroApi };
})(typeof window !== 'undefined' ? window : globalThis);
