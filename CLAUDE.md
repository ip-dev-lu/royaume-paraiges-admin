# CLAUDE.md - Royaume des Paraiges Admin

Interface d'administration du Royaume des Paraiges (app de fidélité gamifiée bière). Backend Supabase partagé avec les apps front, scanner, waiters.

## Stack

Next.js 16.1 (App Router) · React 19.2 · TypeScript 5.7 · Supabase 2.47 · Tailwind 3.4 · Radix/shadcn · Recharts.

## Documentation

- **Backend Supabase** : submodule `docs/docs/supabase/` (tables, functions, policies). Toujours consulter avant de toucher au schéma.
- **Types BDD** : `src/types/database.ts` (généré + extensions manuelles en bas du fichier).
- **Services** : `src/lib/services/*Service.ts` — un par domaine (coupons, quests, rewards, season, achievementBadge, content, analytics, user, receipt, template, period, level).

## Terminologie quêtes

- **défis** = quêtes **récurrentes** (weekly/monthly/yearly), seul modèle implémenté.
- **missions** = quêtes **ponctuelles** (à venir).
- Les noms BDD restent `quests`/`quest_progress`/etc. — la distinction est fonctionnelle.

## Règles produit en vigueur

- **Zéro euro côté client** : l'app Expo ne doit jamais afficher d'euros. Les quêtes monétaires utilisent `quest_type = 'cashback_earned'` (target en PdB, 1 PdB = 1 centime). Le type `amount_spent` est **déprécié** — retiré du formulaire de création mais conservé dans l'enum pour l'édition d'anciennes quêtes. L'admin/scanner/waiters peuvent afficher en €.
- **Refonte mécaniques de jeu (en prod)** : grille 25 niveaux, `cashback_coefficient = 100 + (level-1)*20` auto-maintenu par trigger sur `gains`, cycle de saison (snapshot → badges → reset) via `/rewards/season`.
- **Badges succès** : catégorie `achievement` sur `badge_types`, `criterion_type` paramétrable, attribution temps réel via hook dans `create_receipt` (step 12b) + cron nocturne 02:00 UTC pour les streaks. Soft-delete via `archived_at`. Cf. `docs/docs/supabase/functions/achievement_badges.md`.

## Conventions de code

### Validation runtime — Zod obligatoire

Tout service qui mute la BDD (RPC ou table-write) valide son input avec un schéma Zod dans `src/lib/schemas/`, appelé via `schema.parse(input)` au début. Schémas existants : `manualCouponSchema`, `questSchema`/`questUpdateSchema`, `achievementBadgeSchema`/`achievementBadgeUpdateSchema`, `distributeRewardsSchema`, `seasonClosureSchema`. Les schémas servent aussi de base aux forms UI.

### Forms — react-hook-form + zodResolver

Pattern : `useForm<FormInput>({ resolver: zodResolver(schema), defaultValues })` puis `form.handleSubmit(async values => ...)`. Le schéma UI peut différer du schéma service (inputs string pour les number, conversions €→centimes au submit).

- `register("name")` pour les `<Input>`, `<Controller>` pour les `<Select>`/`<Switch>` shadcn.
- Erreurs Zod : `errors.name?.message` avec `text-xs text-destructive`.
- Erreur serveur : state local `serverError`, bandeau au-dessus des actions.
- Toasts : `import { toast } from "sonner"` (pas le `useToast` shadcn).

Forms migrés : `coupons/create`, `rewards/achievements/_form/AchievementBadgeForm`, `quests/_form/QuestForm`.

**`/settings`** : simplifié (mai 2026). Header purgé du jargon BDD (`admin_settings`, "migration 020"). Descriptions des champs réécrites en français clair (plus de balises `<code>` exposant les noms d'enum quest_type). Lien vers `/quests/health` ajouté pour expliquer où les alertes apparaissent. Migration TanStack Query + sonner. Pattern : page = chargement queries + handoff vers `<SettingsForm>` enfant qui initialise son state depuis les props (évite la règle eslint `react-hooks/set-state-in-effect` de React 19).

**`/content/beers`** et **`/content/establishments`** : simplifiés (mai 2026). Cartes stats "Source: Supabase" supprimées (purement noise), `IBU moyen` retirée. Migration TanStack Query + sonner. Pages volontairement légères (lecture seule) : recherche + table + dialog réciproque (bières ↔ établissements).

**`/quests`** : simplifié (mai 2026). Toggles `showUpcoming`/`showArchives` remplacés par des pills mutually-exclusive *Actuelles / À venir / Archives*. Boutons CSV (template / export / import) regroupés dans un dropdown **Outils**. Migration TanStack Query + sonner au passage. Le dialog d'import et le `QuestConflictDialog` restent gérés dans la page.

**`/coupons/create`** : formulaire simplifié (mai 2026). Plus de notion de "mode template / custom" — toujours saisie directe : radios *Bonus cashback (€) / Coupon (%)* puis un seul champ. Les `coupon_templates` restent en BDD et continuent d'alimenter la distribution leaderboard (`/rewards/distribute`) ainsi que `/templates`, mais ne sont plus exposés dans le flux de création manuelle d'un coupon.

### Data fetching — TanStack React Query

`QueryProvider` dans `src/app/layout.tsx` (staleTime 30s, retry 1, no refetchOnWindowFocus). Query keys factories : `src/lib/queries/keys.ts` par domaine.

**Règle** : toute mutation qui change un listing **doit** invalider `xxxKeys.all` du domaine, sinon stale jusqu'à 30s.

Listings migrés : `rewards/achievements`, `rewards/tiers`, `coupons`, `users`, `templates`, `quests`, `content/beers`, `content/establishments`.

### Conversion target_value des quêtes — piège récurrent

Dans `QuestForm.submit` :
- `amount_spent` (déprécié) : `parseFloat(value) * 100` → centimes
- `cashback_earned` : `parseInt(value)` → PdB direct (saisie "50" = `target_value = 50`, **pas 5000**)
- Autres : `parseInt(value)` → unités directes

## Gotchas BDD

- Colonne `used` (pas `is_used`) dans `coupons`. Pas de `establishment_id` ni `used_at`.
- Pas de `total_xp` / `cashback_balance` dans `profiles` → vue matérialisée `user_stats`.
- `gains.establishment_id` est **nullable** (NULL pour bonus cashback directs).
- `receipts.employee_id` est **nullable** (NULL pour historique).
- RPC analytics (`get_analytics_revenue`/`_debts`/`_stock`) : avec filtre établissement/employé actif, PdB Récompenses + Bonus Coupons retournent 0.
- Catégorie « Bonus Coupons » existe encore en backend mais n'est plus affichée admin (reclassée en `bonus_cashback_leaderboard`).
- `badge_types.category` ∈ {`weekly`, `monthly`, `yearly`, `special`, `season_rank`, `quest`, `achievement`}.
- **Soft-delete des badges achievement** : la FK `user_badges.badge_id` est `ON DELETE CASCADE`, un hard-delete effacerait tous les badges déjà obtenus → toujours passer par `archived_at`.
- **Reset de saison** n'efface jamais : ni le solde PdB (`gains` intact), ni les badges (`user_badges`), ni les snapshots. Seul `cashback_coefficient` revient à 100.
- **`profiles.cashback_coefficient` est auto-maintenu** par trigger sur `gains` — ne JAMAIS le modifier manuellement (sauf via RPC `reset_season`).
- `level_thresholds` : 25 lignes (Écuyer I → Chevalier de la Table Ronde), à lire dynamiquement, jamais hardcoder.
- 17 quêtes désactivées (ids 10-26 sauf 27-28) — préservées pour l'historique de `quest_progress` / `quest_completion_logs`. **Ne pas DELETE**.
- 6 quêtes consumption hebdo créées mais désactivées par défaut (à activer une à une selon calendrier produit).

## Typage Supabase

- `(supabase.rpc as any)` pour les appels RPC (limitation typage).
- `(supabase.from("table") as any)` pour insert/update/delete.

## Types de quêtes

| Type | Unité | Notes |
|------|-------|-------|
| `xp_earned` | XP | |
| `cashback_earned` | PdB | Progression = SUM(`gains.cashback_money`) sur la période |
| `amount_spent` | Centimes BDD / € UI | **Déprécié**, conversion ×100 au submit |
| `establishments_visited` | Nombre | |
| `orders_count` | Nombre | |
| `quest_completed` | Nb sous-périodes | Méta-quête, incompatible avec `weekly` |
| `consumption_count` | Nombre | Requiert `quests.consumption_type` non-NULL |

ENUM `consumption_type` : `cocktail`, `biere`, `alcool`, `soft`, `boisson_chaude`, `restauration`.

Statuts `quest_progress.status` : `in_progress`, `completed`, `rewarded`, `expired` (via cron quotidien `expire_quest_progress()`).

## Cycle de saison (clôture annuelle)

UI : `/rewards/season` (manuelle pour an 1, cron à venir an 2+). Service : `seasonService.ts`.

3 étapes idempotentes via RPC :
1. `snapshot_season(year, source)` — fige les rangs dans `season_snapshots`
2. `award_season_rank_badges(year, source)` — distribue 6 badges saison (garde : snapshot fait)
3. `reset_season(year, source)` — `cashback_coefficient = 100` partout (garde : badges distribués)

`source` ∈ `'cron' | 'cron_fallback' | 'manual' | 'dry_run_aborted'`. Journal dans `season_closure_log`.

## Structure UI `/rewards`

Page hub (`/rewards/page.tsx`) = pure navigation (5 cartes, zéro fetch). Sous-routes :
- `/rewards/periods` — gestion des périodes
- `/rewards/tiers` — listing paliers leaderboard (TanStack Query) + section secondaire « Lore des badges » (toutes catégories de `badge_types`, édition via dialog inline — emplacement provisoire en attendant arbitrage UX)
- `/rewards/achievements` — badges succès (catégorie `achievement` uniquement)
- `/rewards/distribute` — distribution périodique
- `/rewards/season` — clôture annuelle

## Rôles utilisateurs

`admin` (complet) · `establishment` (limité) · `employee` (aucun accès admin) · `client` (aucun).

## Commandes

```bash
npm install
npm run dev          # port 3000
npm run build
npm run lint
npm run supabase:types
```

## Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=https://uflgfsoekkgegdgecubb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

## Liens

- Supabase Dashboard : https://app.supabase.com/project/uflgfsoekkgegdgecubb
