# Lumen Planner — Refatoração

Este pacote contém o código do repositório `lumenplannerco` com as correções e
melhorias abaixo já aplicadas e testadas (build + testes + type-check passando).

## O que mudou

### 🔒 Segurança
- **`.env` removido do projeto.** Foi criado `.env.example` (com os campos vazios)
  como modelo. Copie ele pra `.env` e preencha com suas credenciais reais do
  Supabase antes de rodar o projeto.
- `.gitignore` atualizado pra nunca mais versionar `.env` / `.env.*`.
  **Importante:** isso só previne vazamentos futuros. O `.env` antigo já está no
  histórico do seu repositório no GitHub — se quiser removê-lo de lá também,
  me avise que te ajudo a limpar o histórico do git.

### 🧹 Código morto removido
- `src/lib/hash.ts` (PBKDF2/SHA-256) foi apagado — não era usado em nenhum
  lugar, já que a autenticação real é 100% feita pelo Supabase Auth.
- Campos órfãos `passwordHash`, `salt` e `sessionTokenHash` removidos da
  interface `User` em `src/store/types.ts`.

### 🏗️ Store gigante quebrado em slices
O antigo `src/store/useAppStore.ts` (686 linhas, tudo junto) virou:

```
src/store/
  core.ts              → cache local, uid(), sync com nuvem, helper de mutação
  useAppStore.ts        → composição dos slices (agora ~100 linhas)
  slices/
    authSlice.ts         → signup, login, logout, hidratação da nuvem
    tasksSlice.ts         → tarefas do dia
    habitsSlice.ts        → hábitos
    goalsSlice.ts          → metas e marcos
    projectsSlice.ts        → projetos e suas tarefas
    eventsSlice.ts            → eventos do calendário
    mindmapsSlice.ts           → mapas mentais
```

Cada slice cuida só do seu domínio. O comportamento é idêntico ao original —
mesmos nomes de função, mesma lógica — só a organização mudou. Nenhum
componente da UI precisa ser alterado.

### 🧪 Testes reais adicionados
`src/test/store.test.ts` — 12 testes cobrindo tasks, habits, goals e
mindmaps (CRUD, toggle, edge cases como "usuário deslogado" e "duplicar
mapa inexistente"). Rode com `npm run test`.

### 📡 Feedback de sincronização
Novo hook `src/hooks/use-cloud-sync-status.ts` — permite qualquer componente
mostrar um indicador de "não sincronizado" quando o save na nuvem falha
(antes só logava um `console.warn` silencioso). Ainda não está plugado em
nenhum componente visual — fica de sugestão pra próxima etapa.

## Como usar

```bash
npm install
cp .env.example .env      # preencha com suas credenciais do Supabase
npm run dev                # http://localhost:5173
npm run test                # roda os 13 testes
npm run build                 # build de produção
```

Build, testes e type-check (`tsc --noEmit`) foram todos validados antes de
empacotar isso — está pronto pra usar.

## O que ainda vale fazer (não incluído aqui)
- Plugar o `useCloudSyncStatus` num componente visual (ex: um badge no header).
- Resolver conflitos de edição concorrente (hoje é "last write wins" no blob
  JSONB — editar em dois dispositivos ao mesmo tempo pode sobrescrever dados).
- Code-splitting: o build gera um bundle único de ~1.3MB; dá pra dividir com
  `React.lazy()` por página.
