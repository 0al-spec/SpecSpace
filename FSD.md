# FSD Rules For Web Application Development

## TL;DR

`Feature-Sliced Design` organizes frontend code by business meaning and responsibility, not by technical file types.

Preferred base structure:

```text
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
```

Main rule: keep code close to where it is used, and extract it only when there is a real architectural reason: reuse, independent business meaning, or a large composition boundary.

## Core Layers

| Layer | Responsibility |
|---|---|
| `app` | Application initialization: providers, router, global store setup, global styles |
| `pages` | Route/screen-level code |
| `widgets` | Large standalone UI composition blocks |
| `features` | User actions with business value: `login`, `add-to-cart`, `apply-promo-code` |
| `entities` | Business domain objects: `user`, `product`, `order`, `invoice` |
| `shared` | Generic infrastructure without product business logic: UI kit, API client, config, generic libs |

## Import Direction

Dependencies must go only from higher layers to lower layers:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Allowed examples:

```ts
// widgets can compose lower layers
import { AddToCartButton } from '@/features/add-to-cart';
import { ProductPrice } from '@/entities/product';
import { Button } from '@/shared/ui/button';
```

Forbidden examples:

```ts
// entities must not depend on features
import { AddToCartButton } from '@/features/add-to-cart';

// features must not depend on widgets
import { ProductCard } from '@/widgets/product-card';
```

Slices on the same layer should not import each other directly. If two features must work together, compose them above, usually in `widgets` or `pages`.

## Pages First

Start new functionality in `pages` when it is used by only one route:

```text
pages/product-details/
  ui/
  model/
  api/
```

Extract later:

- to `widgets` when a large UI block is reused or has a clear composition boundary;
- to `features` when there is a reusable user action with business value;
- to `entities` when there is a reusable business domain concept;
- to `shared` only for generic technical infrastructure without product-specific business meaning.

Do not create `features`, `entities`, or `widgets` prematurely.

## Naming Rules

Use business language.

Good:

```text
features/add-to-cart
features/change-email
features/apply-promo-code

entities/user
entities/product
entities/order
```

Avoid vague technical names:

```text
components/
hooks/
helpers/
utils/
modules/
stuff/
```

Inside a slice, prefer segments by responsibility:

```text
ui/
model/
api/
lib/
config/
```

Avoid slice segments such as `components`, `hooks`, `types`, and `utils` when `ui`, `model`, `api`, `lib`, or `config` describes the responsibility better.

## Public API

Every slice should expose a public API through `index.ts`.

Good:

```ts
import { ProductPrice, type Product } from '@/entities/product';
```

Bad:

```ts
import { ProductPrice } from '@/entities/product/ui/product-price';
```

Export only the intended contract:

```ts
export { AddToCartButton } from './ui/add-to-cart-button';
export { useAddToCart } from './model/use-add-to-cart';
```

Avoid blind wildcard exports:

```ts
export * from './model/store';
export * from './api/internal-api';
export * from './lib/internal-normalize';
```

## API Placement

Place API calls near the owner of the behavior.

```text
shared/api/client.ts                     # base HTTP client, interceptors, request factory
pages/catalog/api/get-catalog.ts         # request used only by the catalog page
features/add-to-cart/api/add-to-cart.ts  # request for the add-to-cart action
entities/product/api/get-product.ts      # reusable product-related request
```

Do not put every request into `shared/api`. `shared/api` is for transport-level infrastructure, not product-specific business operations.

## State Placement

FSD does not prescribe a state manager. `Redux`, `Zustand`, `Effector`, `MobX`, `TanStack Query`, `Apollo`, or local framework state are all acceptable.

Place state by ownership:

```text
app/store/                              # global store configuration
pages/catalog/model/use-catalog-query   # state/query needed only by catalog page
features/add-to-cart/model/             # state for the add-to-cart action
entities/cart/model/                    # state of cart as a business entity
shared/lib/storage/                     # generic persistence helpers
```

## Shared Layer Rules

`shared` must not contain product business logic.

Good:

```text
shared/ui/button
shared/ui/modal
shared/api/client
shared/lib/date
shared/lib/currency
shared/config/env
```

Bad:

```text
shared/product-utils
shared/order-hooks
shared/user-services
```

If code knows about `product`, `order`, `user`, `cart`, or another business concept, it usually belongs in `entities`, `features`, `widgets`, or `pages`, not in `shared`.

## Typical Mistakes

- Creating a `feature` for every small button or click handler.
- Putting all reusable code into `shared`.
- Importing internal files of a slice instead of its `index.ts`.
- Letting lower layers depend on higher layers.
- Creating too many slices before real reuse or business boundaries appear.
- Naming by technical type instead of domain responsibility.

## Practical Checklist

Before adding or moving code, check:

1. Is it used only by one route? Keep it in `pages`.
2. Is it a large reusable UI composition? Use `widgets`.
3. Is it a user action with business value? Use `features`.
4. Is it a business domain object? Use `entities`.
5. Is it generic infrastructure with no business meaning? Use `shared`.
6. Are imports going only downward through the layer hierarchy?
7. Are external imports going through the slice public API?

