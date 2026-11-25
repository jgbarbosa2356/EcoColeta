# Configuração da TagoIO

## Dispositivos e painel

Crie três dispositivos Custom HTTPS na mesma região. Use nomes Entrada principal, Pátio e Cantina. Cada um deve ter um Device-Token próprio, informado somente em tempo de execução no ESP32 e no app. O firmware usa a região `us-e1`; para outra região, ajuste `API_BASE` e selecione a mesma região no aplicativo.

O firmware publica `nivel`, `distancia`, `situacao`, `sensor_ok`, `coletas_total`, `eventos_descartados` e eventos `coleta`, quando existentes. O percentual contém os metadados `ponto_id`, `ponto_nome` e `localizacao`.

Crie um dashboard normal com três medidores da variável `nivel`, cada qual apontando para seu dispositivo, escala de 0 a 100. Gráficos de `nivel` e tabelas de `coleta` podem complementar o painel.

## Push crítico

Crie uma ação por dispositivo, do tipo Variável, com a seguinte lógica:

```text
DISPARAR: nivel > 90 OU nivel = 90
DESBLOQUEAR: nivel < 85
AÇÃO: Push notification to myself
DISPARAR AO DESBLOQUEAR: desativado
```

O desbloqueio impede um aviso a cada leitura crítica. Depois de salvar, reabra a regra e confira que essa condição continua presente. Se ela desaparecer, não deixe a regra ativa continuamente. Essa falha de persistência foi observada no painel durante a preparação desta entrega.

O arquivo [acoes.exemplo.json](acoes.exemplo.json) contém modelos declarativos com identificadores fictícios. Não é um instalador automático. Substitua os IDs apenas na sua configuração privada. A configuração usa três ações; confira a cota vigente do seu plano antes de adicionar outros canais.

No iPhone, entre na conta correspondente no aplicativo oficial TagoIO e habilite as notificações. Teste com o EcoColeta fechado e confirme a chegada no telefone; uma notificação no painel não comprova essa entrega.

## SMS e e-mail

São integrações pendentes neste protótipo. Configure um provedor de SMS, como Twilio, e um serviço de e-mail, como SMTP/SendGrid, pelos mecanismos oferecidos pela TagoIO. Armazene credenciais em Secrets, nunca no GitHub, no JavaScript do app ou no firmware público.

Não basta preencher o destinatário: o provedor também precisa estar habilitado e permitir o envio. Planos de teste, números autorizados e créditos podem restringir a entrega. As ações extras também consomem recursos da conta. Valide cada canal separadamente e registre o recebimento antes de declará-lo funcional.

## Documentação oficial

- https://docs.tago.io/docs/tagoio/actions/trigger-by-variable
- https://docs.tago.io/docs/tagoio/actions/trigger-unlock
- https://docs.tago.io/docs/tagoio/actions/defining-actions
- https://docs.tago.io/docs/tagoio/security/secrets
