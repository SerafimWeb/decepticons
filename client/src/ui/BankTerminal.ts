import { bankReplyText, type BankReply } from '../../../shared/bank/codes';
/** Terminal por eventos. A simulação permanece fora do DOM; textos dinâmicos usam textContent. */
export class BankTerminal {
  private readonly root = document.createElement('dialog');
  private readonly input = document.createElement('input');
  private readonly result = document.createElement('p');
  private readonly submit = document.createElement('button');
  private readonly boost = document.createElement("div");
  private shownSeconds = -1;
  private shownMultiplier = 1;
  private pending = false;
  private timeout = 0;
  get isOpen(): boolean { return this.root.open; }
  constructor(private readonly redeem: (code: string) => void, private readonly close: () => void) {
    this.boost.id = "bank-boost-status"; this.boost.hidden = true; document.body.append(this.boost);
    this.root.id = 'bank-terminal'; this.root.setAttribute('aria-labelledby', 'bank-terminal-title');
    this.root.innerHTML = '<div class="bank-terminal-kicker">V / V · SERVIÇOS AO PILOTO</div><h2 id="bank-terminal-title">BANCO VORCARIS</h2><p>Digite seu código de autorização para receber créditos ou reforços.</p>';
    const form = document.createElement('form'); const label = document.createElement('label'); label.textContent = 'CÓDIGO DE AUTORIZAÇÃO'; label.htmlFor = 'bank-code';
    this.input.id = 'bank-code'; this.input.name = 'code'; this.input.maxLength = 64; this.input.autocomplete = 'off'; this.input.placeholder = 'Digite o código'; this.input.required = true;
    this.submit.type = 'submit'; this.submit.textContent = 'RESGATAR';
    this.result.setAttribute('role', 'status'); this.result.setAttribute('aria-live', 'polite'); this.result.className = 'bank-terminal-result';
    form.append(label, this.input, this.submit); form.addEventListener('submit', (e) => { e.preventDefault(); if (this.pending) return; this.setPending(true); this.result.textContent = 'VALIDANDO AUTORIZAÇÃO…'; this.timeout = window.setTimeout(() => this.showMessage('Sem resposta. Tente novamente quando houver conexão.'), 8000); this.redeem(this.input.value); });
    const leave = document.createElement('button'); leave.type = 'button'; leave.textContent = 'VOLTAR AO COMBATE'; leave.className = 'bank-terminal-close'; leave.addEventListener('click', () => this.finish());
    this.root.addEventListener('cancel', (e) => { e.preventDefault(); this.finish(); });
    this.root.append(form, this.result, leave); document.body.append(this.root);
  }
  updateBoost(seconds: number, visible: boolean, multiplier: number): void {
    const value = Math.ceil(seconds); this.boost.hidden = value <= 0 || !visible;
    if (value !== this.shownSeconds || multiplier !== this.shownMultiplier) { this.shownSeconds = value; this.shownMultiplier = multiplier; this.boost.textContent = "VORCARIS · DANO +" + Math.round((multiplier - 1) * 100) + "% · " + value + " s"; }
  }
  open(credits: number, online: boolean): void {
    if (this.isOpen) return;
    this.result.textContent = 'SALDO: ' + credits.toLocaleString('pt-BR') + ' ₵ · ' + (online ? 'A arena continua ativa durante o atendimento.' : 'Combate pausado durante o atendimento.');
    this.input.value = ''; this.result.classList.remove('accepted'); this.setPending(false); this.root.showModal(); this.input.focus();
  }
  reply(reply: BankReply): void { this.showMessage(bankReplyText(reply)); this.result.classList.toggle('accepted', reply.status === 'ok'); }
  showMessage(message: string): void { window.clearTimeout(this.timeout); this.setPending(false); this.result.textContent = message; this.result.classList.remove('accepted'); }
  private setPending(pending: boolean): void { this.pending = pending; this.submit.disabled = pending; }
  private finish(): void { window.clearTimeout(this.timeout); this.root.close(); this.close(); }
}
