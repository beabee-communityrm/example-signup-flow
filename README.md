This is a reference implementation for creating a custom form for beabee's
signup flow

```
npm install
npm start
```

The form requirements are:
* Show different contribution amounts depending on the selected period
* Allow users to enter a custom amount instead of one of the presets
* Allow monthly users to opt-in to absorbing the transaction fee
   * Only shown if the instance has the absorb fee option enabled (enforced by API)
   * Force €1/month users to absorb the transaction fee (enforced by API)
* Disable fee opt-in for annual contributors (enforced by API)

The form loads the instance's settings from the API before use:
* `/content/join` for the minimum contribution amount and whether the absorb
  fee option is enabled
* `/content/payment` for the Stripe public key and the country used to
  estimate transaction fees

The API only accepts requests from origins listed in the instance's
`BEABEE_TRUSTEDORIGINS` setting, so the domain hosting the form must be added
there.

## How the form talks to beabee and Stripe

```mermaid
sequenceDiagram
    participant U as User
    participant F as Custom form
    participant API as beabee API
    participant S as Stripe
    participant GC as GoCardless
    participant FE as beabee frontend

    F->>API: GET /content/join, GET /content/payment
    API-->>F: min amount, absorb fee flag, Stripe key, fee country

    U->>F: Step 1: period and amount
    U->>F: Step 2: email, payment method, fee opt-in
    F->>API: POST /signup
    alt Stripe payment method
        API-->>F: clientSecret
        F->>S: Load Payment Element with clientSecret
        U->>F: Step 3: name and payment details
        F->>S: confirmSetup(return_url=/join/complete?firstName&lastName)
        S-->>FE: Redirect to /join/complete?setup_intent=...
    else Direct debit
        API-->>F: redirectUrl
        F->>GC: Redirect to GoCardless mandate page
        U->>GC: Enter bank details
        GC-->>FE: Redirect to /join/complete?redirect_flow_id=...
    end
    FE->>API: POST /signup/complete
    API-->>U: Confirmation email
    FE-->>U: /join/confirm-email
```

The custom form only handles the steps up to the payment provider. The
redirect back lands on the beabee frontend, which completes the signup and
asks the user to confirm their email address.
