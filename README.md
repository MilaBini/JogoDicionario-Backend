# Ap03DS870 - Gestor Médico - Parte 3

## AVISOS

- A aplicação a seguir deve ser enviada por e-mail para validação. 
- Deve ser desenvolvido em trios.
- Realizar o upload do projeto para o GitHub e enviar o link para download do projeto para o e-mail brawerman@ufpr.br Assunto: DS870 – Noite –Entrega 04
- Enviar até 23:59 de 21/06.
- Não esqueça de informar no e-mail nome completo e GRR dos alunos participantes.

## Especificações

![image](https://user-images.githubusercontent.com/56660237/120848375-1a561400-c54b-11eb-8072-4fa3bc90b164.png)

- Desenvolva a funcionalidade de autenticação para a entidade Physician de nosso sistema.

- [x] Use o bcrypt para calcular o hash da senha tanto na criação de um novo médico, quanto na verificação da senha no momento de autenticação.
    - [x] Faça validação de política de senha para contar no mínimo 8 caracteres, uma letra e um número, no momento de criar um novo médico.

- [x] Gere um tokenJWT para os usuários Physicians no momento de autenticação de usuário e inclua o token na response. 
    - [x] Não esqueça de incluir o id do Physician no token.

- [ ] Faça um middleware de validação do token e inclua em todas as rotas cabíveis do Physiciane Appointments.
