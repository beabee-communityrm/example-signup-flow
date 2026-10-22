# Custom signup flows for beabee

Reference implementations of custom signup forms that talk directly to the
beabee API, for when the built-in join page at `/join` doesn't fit your
site's design or needs to live on another domain.

Which one to start from depends on the `hideContribution` setting of your
instance:

| Example | Instance setting | What the form does |
|---|---|---|
| [`contribution/`](contribution/README.md) | `hideContribution` off (default) | Period, amount, payment method and the payment provider handover via Stripe or GoCardless |
| [`no-contribution/`](no-contribution/README.md) | `hideContribution` on | Email address only, the API sends the confirmation email straight away |

Each example is self-contained with its own `package.json` and README. In
both cases everything after the signup, from email confirmation to account
setup, is handled by the beabee frontend.
