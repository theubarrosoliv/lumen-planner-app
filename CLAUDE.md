# Lumen Planner — CLAUDE.md

Planner pessoal (tarefas, hábitos, metas, projetos, calendário, mapas mentais) como PWA instalável, com notificações push reais no iPhone. Nasceu como scaffold do Lovable, depois migrou pro Supabase próprio da equipe.

**Stack**: React 18 + Vite + TypeScript, Tailwind + shadcn/radix, Zustand, TanStack Query, React Router, Supabase (auth + Postgres + Edge Functions), Firebase (só FCM), `vite-plugin-pwa` (Workbox), Vitest.

## Comandos

```bash
npm run dev                                   # vite, porta 8080
npm run build
npm run test                                  # vitest run
npx tsc --noEmit --project tsconfig.app.json  # SEMPRE com --project — ver "Convenções" abaixo
```

## Estrutura do projeto

```
src/
  App.tsx                    rotas + providers globais (Query, Theme, Tooltip)
  main.tsx                   bootstrap, envolve <App/> num ErrorBoundary
  index.css                  tema "grafite & ouro" (variáveis HSL), Tailwind

  components/
    ui/                       primitivos shadcn/radix
    mindmap/                  FloatingEdge, MindNodeCard, MindMapThumbnail
    AppLayout/AppSidebar/BottomNav/AuthGuard
    NotifyField.tsx           campo de notificação por item (ver "Convenções")
    WeekdaySelector.tsx       seletor de dias da semana (tarefas + hábitos)
    FirstLaunchGateTEMP.tsx   PROVISÓRIO — instrução de remoção no topo do arquivo

  hooks/
    use-push-notifications.tsx   opt-in + registro de token FCM (ver seção de notificações)
    use-confirm-delete.tsx       diálogo de confirmação compartilhado (ver "Convenções")
    use-cloud-sync-status.ts     existe, mas NÃO está plugado em nenhum componente visual
    use-custom-options.ts        tags/categorias editáveis pelo usuário

  lib/                        lógica pura, sem estado — cada arquivo tem teste em src/test/
    date.ts                    recorrência de tarefas, chaves de data, dia-da-semana ISO
    habits.ts                  período/streak de hábitos (todas as frequências)
    tasks.ts                   poda de tarefas concluídas, split de recorrência multi-dia
    agenda.ts                  mescla tasks/events/projects/goals numa lista única
    mindmapLayout.ts           layout radial + cor por ramo do mapa mental
    localNotify.ts             notificação local instantânea (ver seção de notificações)
    deviceDetect.ts            isIOS / isStandalonePWA / isMobileDevice

  store/
    types.ts                  todas as entidades (Task, Habit, Goal, Project, CalEvent, MindMap...)
    core.ts                   cache localStorage + save na nuvem debounced (500ms)
    useAppStore.ts             composição dos slices + wiring do supabase.auth
    slices/                   auth, tasks, habits, goals, projects, events, mindmaps, notifications

  pages/                      uma por rota — Dashboard, Agenda, Calendar, Habits, Goals,
                               Projects, MindMaps/MindMap, Notifications, Settings, Profile,
                               Auth, ResetPassword

  integrations/
    supabase/                  client + types gerados
    firebase/                  client.ts — init lazy do Firebase Messaging

  test/                        vitest, um arquivo por módulo de lib

supabase/
  migrations/                 schema, RLS, pg_cron
  functions/send-notifications/  index.ts (orquestração), fcm.ts (FCM + OAuth2), habits.ts (mirror)

public/
  firebase-messaging-sw.js    service worker dedicado ao FCM — NÃO gerado pelo vite-plugin-pwa
```

## Convenções estabelecidas

- **Nunca `new Date("YYYY-MM-DD")`** para uma data pura — o construtor de string trata `"YYYY-MM-DD"` como UTC meia-noite; relida com `getFullYear()/getMonth()/getDate()` em qualquer fuso a oeste de UTC (Brasil incluso) vira o dia anterior. Sempre `dateStr.split("-").map(Number)` → `new Date(y, m-1, d)`. Vale para toda chave de data no app (`dayKey`, `monthKey`, `cycleKey` etc. em `src/lib/date.ts` e `src/lib/habits.ts`).
- **Nunca `Date#setMonth()`** pra recorrência/streak mensal — rollover de dia-do-mês perto do fim do mês (ex.: 31 de março menos 1 mês vira 3 de março, fevereiro não tem dia 31) quebra silenciosamente o cálculo. Sempre aritmética por índice de mês (`ano*12 + mês`).
- **Slices Zustand**: cada domínio (`src/store/slices/*.ts`) exporta `createXSlice(persist)(set, get, api)`; `persist` (definido em `useAppStore.ts`) roda a ação e depois grava o cache local + agenda o save na nuvem debounced. `mutate(state, fn)` (`core.ts`) aplica uma transformação só nos dados do usuário logado, no-op se deslogado.
- **`NotifyOverride`**: toda entidade notificável (task, event, habit, goal, milestone, project, project-task) compartilha `notify?/notifyLeadValue?/notifyLeadUnit?` + o componente `NotifyField` no dialog de criar/editar. Ao adicionar um novo tipo notificável, espelhar em: `types.ts`, a slice, o dialog da página, e `computeCandidates` na edge function.
- **Confirmação de exclusão sempre via `useConfirmDelete()`** (AlertDialog), nunca `confirm()`/`alert()` nativo — botões de editar/excluir ficam sempre visíveis no mobile (sem hover pra proteger contra toque acidental), então toda exclusão precisa confirmar.
- **Lógica duplicada cliente/servidor é proposital, não acidental**: Edge Functions rodam em Deno e não importam de `src/`, então cálculo de data/período que precisa bater dos dois lados (ex. `src/lib/habits.ts` ↔ `supabase/functions/send-notifications/habits.ts`) é copiado à mão, com comentário explícito apontando pro outro arquivo. Ao mudar um, espelhar no outro.
- **`npx tsc --noEmit` sozinho não checa nada neste repo** — o `tsconfig.json` raiz é "solution style" (`files: []` + `references`), então um `tsc --noEmit` sem `--project` usa a config raiz, vê zero arquivos e "passa" sem checar nada. Sempre `--project tsconfig.app.json` (ou `tsc --build`). Um `TS2304` real já vazou pra produção e apagou a tela de todo usuário logado enquanto isso "passava" — só depois disso ganhou o `ErrorBoundary` em `main.tsx`.
- Comentários em inglês no código, textos de UI e mensagens de commit em português.

## Mecanismo de notificações push (iPhone) — guia de reuso

Isso foi a parte mais difícil de acertar (~10 PRs de ida e volta). Documentado aqui em detalhe porque será reaproveitado em outros projetos.

### Peças e por que cada uma existe

**1. Dois service workers, escopos diferentes.** O SW do `vite-plugin-pwa` (Workbox, `registerType: "autoUpdate"`) já é dono do escopo `/` e se re-registra sozinho a cada ~60s. Um segundo SW pra push que tentasse registrar em `/` seria derrubado por essa re-registração — `getToken()` funcionaria, mas nenhuma notificação chegaria, sem erro nenhum. Por isso o SW do FCM (`public/firebase-messaging-sw.js`, servido cru da pasta `public/`, não gerado pelo Vite) registra num escopo próprio: `/firebase-cloud-messaging-push-scope` (constante `FCM_SW_SCOPE` em `src/hooks/use-push-notifications.tsx`).

**2. O SW do FCM NÃO carrega `firebase-messaging-compat`.** Aquele SDK auto-exibe qualquer push que tenha um bloco `notification`, E o app ainda chamava seu próprio handler — resultado: toda notificação aparecia duas vezes. `public/firebase-messaging-sw.js` é um handler cru (`self.addEventListener("push", ...)`) que chama `showNotification()` exatamente uma vez, lendo `payload.notification` OU `payload.data` (o que existir).

**3. iOS só mostra notificação via `ServiceWorkerRegistration.showNotification()`.** O construtor `new Notification()` não existe no Safari/iOS (16.4+, instalado como PWA) e lança erro. `src/lib/localNotify.ts` (notificação instantânea, local, sem servidor — usada ao concluir tarefa/hábito) sempre passa por `navigator.serviceWorker.ready` → `registration.showNotification()`; o construtor só fica como fallback pro caso raro de não ter SW.

**4. Requer iOS 16.4+ E instalado na tela de início** (PWA em modo standalone) — não funciona numa aba do Safari. `isStandalonePWA()`/`isIOS()` (`src/lib/deviceDetect.ts`) gatam tudo: registro de token, notificação local, e o gate de primeiro acesso (`FirstLaunchGateTEMP.tsx`) que ensina a instalar antes de tentar ativar notificações.

**5. O payload do FCM precisa ter um bloco `notification` no topo, senão o Web Push do Safari/iOS descarta silenciosamente uma mensagem só-`data`.** `supabase/functions/send-notifications/fcm.ts` sempre manda os dois: `notification: {title, body}` (garante a entrega no iOS) e `data: {title, body, link}` (link de clique + fallback que o SW lê). É seguro combinar isso com o item 2 (SW cru) sem duplicar.

**6. Token FCM instável precisa de chave de dedupe própria.** O token rotaciona (a cada nova instalação do SW, entre outras razões); sem uma chave estável por dispositivo, cada rotação inseria uma linha nova em `fcm_tokens` em vez de substituir — um único celular acumulava vários tokens válidos e recebia cada push N vezes. `getDeviceId()` gera um UUID e persiste em `localStorage`; o upsert em `fcm_tokens` usa `onConflict: "user_id,device_id"` (não `token`), então uma rotação sobrescreve a linha do próprio dispositivo. Tokens que o FCM reporta como `UNREGISTERED`/`NOT_FOUND` são apagados pela edge function a cada execução.

**7. VAPID key validada manualmente antes de usar.** Uma chave pública VAPID válida é um ponto EC P-256 não comprimido, em base64url: exatamente 65 bytes, primeiro byte `0x04`. `vapidKeyError()` em `use-push-notifications.tsx` checa isso e transforma o erro genérico do navegador ("applicationServerKey must contain a valid P-256 public key") numa mensagem que aponta a causa real (normalmente: aspas coladas junto do valor numa env var, ou variável truncada). `sanitizeEnvValue()` em `src/integrations/firebase/client.ts` já tira aspas/espaços acidentais de toda env var do Firebase antes de usar.

**8. Minting de access token OAuth2 pro FCM HTTP v1, feito à mão em Deno.** `supabase/functions/send-notifications/fcm.ts` importa a service account (`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` PEM + `FIREBASE_PROJECT_ID`), converte a chave PEM pra `CryptoKey` via `crypto.subtle.importKey("pkcs8", ..., "RSASSA-PKCS1-v1_5")`, assina um JWT (`https://deno.land/x/djwt`) com `scope: "https://www.googleapis.com/auth/firebase.messaging"`, troca por um access token em `oauth2.googleapis.com/token`, cacheia até ~1min antes de expirar. Sem biblioteca oficial do Firebase Admin em Deno — é reimplementado manualmente.

**9. Cron por minuto, com janela de graça.** `pg_cron` roda a cada minuto (`* * * * *`, não a cada 5) — leads curtos ("avisar 1 minuto antes") exigiriam isso mesmo. A chamada usa `net.http_post` (pg_net) direto pra URL da function, com o `service_role_key` puxado do Supabase Vault (`vault.decrypted_secrets`), nunca hardcoded na migration. `NOTIFY_GRACE_MINUTES = 2` em `index.ts` cobre o caso de um tick atrasar/pular.

**10. Dedupe só DEPOIS de confirmar o envio, nunca antes.** `notification_log` (chave única em `user_id+kind+entity_id+period_key`) marca "já notifiquei isso". A ordem importa: o access token é mintado ANTES de reivindicar a linha de dedupe (se a service account estiver mal configurada, estoura erro sem marcar como enviado); se a entrega falhar em TODOS os tokens do usuário, a linha de dedupe é apagada de novo, pro próximo tick tentar de novo. A causa raiz de "notificação agendada nunca chega" já foi exatamente o contrário disso (dedupe antes do envio, suprimindo pra sempre um candidato real após uma falha transitória).

### Variáveis de ambiente necessárias

Cliente (`.env`, ver `.env.example` — públicas, seguro embutir no bundle):
```
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID,
VITE_FIREBASE_VAPID_KEY   # Firebase Console > Project Settings > Cloud Messaging > Web Push certificate
```

Secrets da Edge Function (`supabase secrets set ...`, da service account do Firebase):
```
FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
```
(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente.)

### Tabelas envolvidas

- `fcm_tokens` (user_id, device_id, token, platform, user_agent, timestamps; único em `user_id+device_id`) — RLS restrita ao próprio usuário; `service_role` tem acesso total.
- `notification_log` (dedupe; único em `user_id+kind+entity_id+period_key`) — só o `service_role` toca; sem policy pra `authenticated`/`anon`, de propósito.

### Pra reaproveitar num projeto novo

1. Criar as duas tabelas acima + RLS (ver a migration `fcm_push_setup`).
2. Copiar `public/firebase-messaging-sw.js`, `src/lib/localNotify.ts`, `src/lib/deviceDetect.ts`, `src/hooks/use-push-notifications.tsx`, `src/integrations/firebase/client.ts` quase como estão — a lógica é genérica, não específica do Lumen.
3. Copiar `supabase/functions/send-notifications/fcm.ts` inteiro (minting OAuth2 + envio) — é o pedaço mais frágil e mais reutilizável.
4. Adaptar só `index.ts` (o `computeCandidates`) pras entidades notificáveis do novo projeto; manter o padrão de dedupe-depois-do-envio.
5. Testar o pipeline manualmente sem esperar o cron: inserir um candidato válido e invocar a function direto via `net.http_post` (ou `supabase functions invoke`), checar a resposta `{sent, skipped, pruned, sendErrors}`.

## Resumo do histórico (39 PRs mergeadas em `main`)

**Fundação**: scaffold inicial do Lovable → migração pro Supabase próprio da equipe; tema claro/escuro; remoção de `.env`/arquivos duplicados do versionamento.

**PWA/Mobile**: navegação por barra inferior + telas compactas; menu "Mais" (Projetos/Mapas); safe-area do iOS (notch); SW atualiza sem reinstalar e assume controle em todas as abas; roteamento SPA corrigido no Vercel; fonte trocada pra Inter; gate de primeiro acesso no Safari (instalar + ativar notificações num único fluxo).

**Notificações push**: implementação FCM completa — ver seção dedicada acima. Cerca de 10 PRs só nisso (registro de token, personalização por item, validação de VAPID key, correção de fuso/iOS, notificação duplicada, cron granular, instrumentação de diagnóstico).

**Tarefas/Agenda/Hábitos**: Cronograma (timeline), cores por prioridade, busca global flutuante, Configurações; confirmação de exclusão, múltiplas tags, prioridade, recorrência; Agenda mescla tarefas/eventos/metas/projetos numa lista só, com expiração automática de concluídas; correções de streak visual e remount de layout; recorrência livre (dias da semana específicos, a cada N dias, X vezes/semana) pra tarefas e hábitos, com correção de um bug de fuso-horário na âncora de ciclo e de um bug onde "terça e sexta" só mostrava um dia por vez.

**Outras telas**: fluxo de "esqueci minha senha"; aba de Perfil (editar nome, excluir conta); mapa mental reformulado (layout radial, cor por ramo, conexões flutuantes, toolbar tátil em vez de hover).

**Correções de robustez**: crash de tela preta pra usuário logado (referência JSX órfã não pega pelo `tsc` sem `--project` — ver "Convenções"); crash de busca global; cache de erro do service worker sendo servido como válido.

## O que já está implementado

Tudo do resumo acima está em `main`. Em detalhe por área — ver as seções de Convenções e Estrutura.

## O que falta / débito conhecido

- `useCloudSyncStatus` (hook já existe) não está plugado em nenhum componente visual — falha ao salvar na nuvem hoje só loga `console.warn`, invisível pro usuário.
- Sem resolução de conflito de edição concorrente — o blob `user_data` inteiro é last-write-wins; editar em dois dispositivos ao mesmo tempo pode sobrescrever dados.
- Bundle de produção é um chunk só (~1.3MB) — nenhum `React.lazy()` por rota.
- `FirstLaunchGateTEMP.tsx` é declaradamente provisório (instrução de remoção no topo do arquivo) — decidir quando ele "cumpriu seu papel".
- Frequência "X vezes por semana" não entra no gráfico de tendência do Dashboard (decisão de escopo deliberada — não tem eixo de período compartilhado entre hábitos com configurações diferentes, mas aparece normalmente no gráfico de streaks).
