This is a reference implementation for creating a custom form for beabee's
signup flow

```
npm install
npm start
```

The form requirements are:
* Show different contribution amounts depending on the selected period
* Allow users to enter a custom amount instead of one of the presets
* Allow monthly users to opt-in to abosrbing the transaction fee
   * Force €1/month users to absorb the transaction fee (enforced by API)
* Disable fee opt-in for annual contributors (enforced by API)
