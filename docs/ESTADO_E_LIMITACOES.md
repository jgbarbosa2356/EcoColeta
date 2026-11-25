# Estado e limitações

Registro da entrega preparado em 25/11/2026. As condições de serviços externos podem mudar depois desta data.

## Evidência disponível

Os três dispositivos da TagoIO foram consultados com sucesso e apresentaram dados identificados para Entrada principal, Pátio e Cantina. Um dashboard chamado EcoColeta foi salvo com um medidor por dispositivo. Durante a conferência, seus últimos níveis eram 97%, 71% e 53,4%, respectivamente. São valores históricos de teste, não leituras atuais garantidas.

Três ações de push foram criadas, uma para cada ponto. A regra final é `nivel > 90 OU nivel = 90`. Um teste em 90% gerou uma notificação visível na TagoIO. Isso não comprova recebimento no iPhone.

O painel não preservou a condição de desbloqueio `nivel < 85` depois do salvamento. Para evitar mensagens repetidas em todas as leituras críticas e consumo da cota, as três ações foram deixadas inativas. O ajuste de desbloqueio e a reativação permanecem pendentes.

SMS e e-mail ainda precisam de provedor, configuração segura e comprovação de entrega. Não foram contratados créditos ou assinaturas.

## Versão publicada

Esta versão alinha o limite crítico do código do aplicativo e do firmware a 90%, conforme a regra solicitada. O projeto `.aia` foi reconstruído a partir dos arquivos publicados. As versões anteriores com limite de 95% não são a referência desta entrega.

Antes de demonstrar, importe este `.aia` e atualize o `sketch.ino` no Wokwi. A publicação de arquivos no GitHub, por si só, não altera os projetos já abertos no Wokwi, no Companion nem na TagoIO.

## Limitações técnicas

- Estimativa pela altura; superfícies irregulares e resíduos inclinados afetam o sensor.
- Sem confirmação manual/operacional de coleta: o histórico registra coletas prováveis.
- Comunicação do ESP32 virtual usa TLS sem validação de certificado. Não é configuração para produção.
- Sensores e publicações são processados sequencialmente; uma requisição lenta pode atrasar as demais.
- Até 16 eventos de coleta ficam na fila persistente de cada ponto; descartes são contabilizados.
- Perda de resposta após aceitação pode reenviar evento. O aplicativo deduplica eventos pelo identificador.
- Tokens são mantidos em memória e precisam ser reinformados depois de reiniciar.
- O protótipo foi desenvolvido para demonstração. A aceitação da simulação em substituição à placa física deve ser alinhada com o professor.

## Sobre o enunciado

O enunciado consultado pede dispositivo IoT, plataforma com dashboard e alertas SMS/e-mail, além de aplicativo com monitoramento e relatórios. Não especifica obrigatoriedade de slides. Enquanto SMS e e-mail não forem configurados e testados, essa parte da exigência não pode ser apresentada como concluída.
