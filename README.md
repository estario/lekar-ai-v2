# Lekar AI v2

Синтетично демо за транскрипция и изготвяне на чернови на медицински документи, създадено в Lovable Cloud. BG/EN интерфейс, Soniox US и Luna през Lovable AI. Използвайте само измислени сценарии.

- [Публично демо](https://lekari-ai-bulgaria.lovable.app/)
- [Lovable проект](https://lovable.dev/projects/8edcb921-cddd-47da-b742-f78009807ab8)
- [Общ преглед на суровия код от Codex и Claude — 2026-10-05](reviews/2026-10-05/README.md)
- [Поправки и независими проверки — 2026-10-05](reviews/2026-10-05/FIXES.md)
- [Произход и граници на експорта](EXPORT.md)
- [Cloud настройка](SETUP.md)

Това е частно хранилище със снимка на публикувания код. **Автоматична синхронизация между това хранилище и Lovable не е настроена.** Cloud credentials, потребители и данни не са прехвърляни. `.env.example` съдържа само имена на променливи; постоянни ключове не се качват в GitHub.

Поправките от прегледа са приложени през Lovable. Историческият преглед описва първоначалната версия; текущите промени и границите на проверките са в FIXES.md. Локално на крайния код минават 48/48 теста, TypeScript и production build.

## Локална разработка

Използвайте Bun и Node.js. Lockfile е `bun.lock`.

```sh
git clone https://github.com/estario/lekar-ai-v2.git
cd lekar-ai-v2
bun install --frozen-lockfile --ignore-scripts
bun run test
node node_modules/typescript/bin/tsc --noEmit
bun run build
bun run dev
```

Build и unit тестовете могат да се изпълнят без реални ключове. Работещите Cloud/Auth/AI/Soniox функции изискват отделно конфигурирана среда; вижте SETUP.md. Стек: TanStack Start, React, TypeScript, Tailwind CSS и Supabase.
