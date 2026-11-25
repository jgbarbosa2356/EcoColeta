# Verificação desta entrega

Data: 25/11/2026.

Os quatro comandos abaixo foram executados com sucesso sobre os arquivos desta entrega:

```bash
node testes/core_test.js
node testes/transport_test.js
python3 testes/aia_test.py
python3 testes/aia_bridge_test.py
```

Cobertura: calibração percentual, limites de estados, alerta crítico exatamente em 90%, rearme abaixo de 85%, deduplicação de eventos de coleta, prioridade de pontos, dados antigos, falha de sensor, CSV identificado e cadastro de pontos. Também foram conferidos o transporte com respostas atrasadas/erro HTTP/timeout, a estrutura do arquivo `.aia`, sua correspondência com os fontes e a ponte de callbacks com componentes simulados.

Os arquivos `.aia` e HTML autocontido foram gerados novamente a partir dos fontes publicados.

A versão anterior do firmware de três sensores foi compilada e executada no Wokwi, com leitura independente e registro de coleta provável. Nesta entrega a classificação crítica foi alterada de 95% para 90%; a compilação dessa revisão ainda deve ser conferida no Wokwi. Os testes acima não compilam código Arduino nem executam o Companion real.

Separadamente, foi confirmado o recebimento de dados dos três pontos na TagoIO, e um teste gerou push no painel. Essas conferências não validam o recebimento no telefone nem os canais SMS/e-mail. As condições de bloqueio/rearme da nuvem continuam pendentes e as regras ficaram pausadas.
