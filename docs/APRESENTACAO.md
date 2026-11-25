# Roteiro de apresentação

Fala sugerida para aproximadamente quatro minutos, com demonstração em seguida. Ajuste os nomes dos integrantes caso o trabalho seja em grupo.

## Abertura

“Boa noite, professor e colegas. Nosso projeto é o EcoColeta, um protótipo de Internet das Coisas para monitorar lixeiras em diferentes pontos. A proposta é identificar quais estão próximas de encher e ajudar a organizar a prioridade da coleta.”

## Problema e solução

“Em uma escola, por exemplo, a lixeira da cantina pode encher mais rápido que a do pátio. Se a verificação for feita apenas em horários fixos, um ponto pode transbordar enquanto outro continua quase vazio. Por isso, organizamos o sistema em três locais: Entrada principal, Pátio e Cantina.”

## Funcionamento

“No Wokwi, usamos um ESP32 e três sensores ultrassônicos. Cada sensor mede a distância entre a parte superior da lixeira e a superfície dos resíduos. Com uma calibração de vazio e cheio, o programa transforma essa distância em um percentual estimado. Quanto menor a distância, maior o preenchimento.”

“O ESP32 envia os dados por Wi-Fi para a TagoIO. Cada lixeira tem seu próprio dispositivo e token, então os dados ficam separados. A plataforma armazena as leituras e apresenta um dashboard com três medidores.”

## Aplicativo

“O aplicativo foi montado no MIT App Inventor e consulta os dados da nuvem. Ele mostra o nível de cada ponto, prioriza os que precisam de atenção e permite consultar histórico e relatórios. O nível é considerado normal abaixo de 80%, em atenção de 80% a menos de 90% e crítico a partir de 90%.”

“O histórico também registra coletas prováveis quando o nível cai de pelo menos 50% para até 20% durante três leituras válidas. Essa inferência não comprova uma coleta real, mas demonstra uma forma de acompanhar a mudança de estado.”

## Validação e pendências

“Confirmamos o envio de dados dos três pontos e criamos o painel na nuvem. O teste de alerta crítico gerou uma notificação na TagoIO. O recebimento no iPhone ainda precisa ser confirmado. As regras estão pausadas porque o desbloqueio contra mensagens repetidas não ficou salvo corretamente no painel. SMS e e-mail também dependem de configuração dos provedores e de testes de entrega.”

## Encerramento

“O resultado demonstrado é a integração de sensores simulados, processamento no ESP32, armazenamento em nuvem e consulta por um aplicativo. Como evolução, precisamos concluir os canais externos de alerta e validar a solução com hardware físico, certificado TLS e calibração em uma lixeira real.”

## Demonstração

1. Mostre o circuito com um ESP32 e três sensores.
2. Mantenha dois sensores em 40 cm e altere apenas um para 8 cm.
3. Mostre no monitor serial qual ponto mudou e o estado crítico acima de 90%.
4. Com os tokens configurados, mostre a leitura do ponto correspondente na TagoIO e no app.
5. Volte esse sensor para 40 cm e aguarde as leituras de coleta provável.
6. Mostre o histórico e o relatório do ponto, explicando quais valores são simulação local e quais vieram da nuvem.

Não apresente SMS, e-mail ou push recebido no telefone sem comprovar o recebimento. Se não houver internet, use a demonstração local e identifique claramente esse modo.
