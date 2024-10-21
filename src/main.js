import { calcPaymentFee } from '@beabee/beabee-common';
import { loadStripe } from '@stripe/stripe-js/pure';

function $(s, parentEl=document) {
  return parentEl.querySelector(s);
}

function $$(s, parentEl=document) {
  return Array.from(parentEl.querySelectorAll(s));
}

// URL to your beabee instance
const frontendUrl = 'https://your.beabee.instance.io'

const apiUrl = frontendUrl + '/api/1.0';
const completeUrl = frontendUrl + '/join/complete';

// Customise the appearance of the Stripe form
// https://docs.stripe.com/elements/appearance-api
const stripeAppearance = {
  theme: 'stripe',
  rules: {
    '.Input': {
      boxShadow: 'none'
    }
  }
};

const stepFormEls = $$('.js-form');

const feeEl = $('.js-fee');
const feeAmountEl = $('.js-fee-amount');
const feeOptInEl = $('.js-fee-opt-in');
const feeRequiredEl = $('.js-fee-required');
const feeInputEl = $('[name=pay_fee]');

/**
 * Get the current contribution data from form elements
 * @returns Object The current contribution state
 */
function getContribution() {
  const period = $('[name=period]:checked').value;

  // Get preset or custom amount
  let amount = $(`[name=amount_${period}]:checked`).value;
  if (amount === 'custom') {
    amount = $(`[name=custom_amount_${period}]`).value;
  }

  return {
    email: $('[name=email]').value,
    amount: Number(amount),
    period,
    paymentMethod: $('[name=payment_method]:checked').value,
    payFee: feeInputEl.checked,
    firstName: $('[name=first_name]').value,
    lastName: $('[name=last_name]').value,
  };
}

/**
 * Update the estimated fee based on the current amount, period and payment method
 */
function updateFee() {
  const contribution = getContribution();
  const fee = calcPaymentFee(contribution, 'eu');

  const forceFee = contribution.amount === 1;
  feeInputEl.disabled = forceFee;
  if (forceFee) {
    feeInputEl.checked = true;
  }

  feeEl.classList.toggle('d-none', contribution.period !== 'monthly');
  feeOptInEl.classList.toggle('d-none', forceFee);
  feeRequiredEl.classList.toggle('d-none', !forceFee);
  feeAmountEl.textContent = fee.toFixed(2);
}

// Calculate the new fee when the payment method changes
for (const el of $$('[name=payment_method]')) {
  el.addEventListener('change', updateFee);
}

/**
 * Show the amounts for the selected period in step 1, and the
 * custom amount field if the selected amount is "custom"
 */
function updateStep1() {
  const contribution = getContribution();

  for (let el of $$('.js-period-amounts')) {
    const isHidden = el.getAttribute('data-period') !== contribution.period;
    el.classList.toggle('d-none', isHidden);
    el.disabled = isHidden;

    // Show/hide custom amount input
    const isPreset = $('[name^=amount]:checked', el).value !== 'custom';
    const customAmountInputEl = $('[name^=custom_amount]', el);
    customAmountInputEl.classList.toggle('d-none', isPreset);
    customAmountInputEl.disabled = isPreset;
  }
};

stepFormEls[0].addEventListener('input', updateStep1);
stepFormEls[0].addEventListener('change', updateStep1);

/**
 * First step handler. Simply updates the fee display and loads the next step
 */
function handleStep1() {
  updateFee();
  return Promise.resolve(true);
}

// These globals are used to pass Stripe related state between steps 2 and 3
let stripe, stripeElements, stripeIsComplete = false;

/**
 * Second step handler. Starts the signup flow, either redirects to a URL
 * returned by the API or loads the Stripe payment form
 */
function handleStep2() {
  const contribution = getContribution();

  const data = {
    email: contribution.email,
    contribution: {
      amount: contribution.amount,
      period: contribution.period,
      // Only monthly contributions can opt to absorb the fee
      payFee: contribution.payFee && contribution.period === 'monthly',
      prorate: false,
      paymentMethod: contribution.paymentMethod,
      completeUrl
    },
    loginUrl: `${frontendUrl}/auth/login`,
    setPasswordUrl: `${frontendUrl}/auth/set-password`,
    confirmUrl: `${frontendUrl}/join/confirm-email`,
  };

  const request = new Request(`${apiUrl}/signup`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json"
    }
  });

  return fetch(request)
    .then(resp => resp.json())
    .then(respData => {
      if (respData.redirectUrl) {
        console.log(respData);
        // Redirect the user to a payment flow
        window.location.href = respData.redirectUrl;
        return false;
      } else {
        // Fetch public Stripe key
        return fetch(`${apiUrl}/content/join`, { headers: {"Content-Type": "application/json"} })
          .then(r => r.json())
          .then(joinData => {
            // ... then load Stripe payment form
            return loadStripe(joinData.stripePublicKey).then(_stripe => {
              stripe = _stripe;
              stripeElements = stripe.elements({
                clientSecret: respData.clientSecret,
                appearance: stripeAppearance
              });
              stripeIsComplete = false;

              const paymentElement = stripeElements.create('payment', {
                fields: { billingDetails: { email: 'never', name: 'never' } }
              });
              paymentElement.mount('.js-stripe');
              paymentElement.on('change', e => stripeIsComplete = e.complete);

              return new Promise(resolve => paymentElement.on('ready', () => resolve(true)));
            });
        });
      }
    });
}

/**
 * Third step handler. Just for Stripe payments. Confirms the setup intention
 * with Stripe, which will then trigger a redirect
 */
function handleStep3() {
  if (!stripe || !stripeElements || !stripeIsComplete) {
    return Promise.reject();
  };

  const contribution = getContribution();

  return stripe.confirmSetup({
    elements: stripeElements,
    confirmParams: {
      return_url: `${completeUrl}?firstName=${encodeURIComponent(contribution.firstName)}&lastName=${encodeURIComponent(contribution.lastName)}`,
      payment_method_data: {
        billing_details: {
          email: contribution.email,
          name: `${contribution.firstName} ${contribution.lastName}`
        },
      },
    }
  });
}

const stepHandlers = [handleStep1, handleStep2, handleStep3];

/**
 * Submit button handler for all steps. Handles any async processing
 * done by the step handler, then progresses the users to the next step
 * if the step handler has returned true
 */
function handleSubmit(e) {
  e.preventDefault();

  const stepNo = stepFormEls.indexOf(this);

  const nextStepEl = stepFormEls[stepNo + 1];

  const submitEl = e.submitter;
  submitEl.disabled = true;
  submitEl.classList.add('is-loading');

  stepHandlers[stepNo]()
    .then((showNextStep) => {
      if (showNextStep) {
        this.classList.add('d-none');
        nextStepEl.classList.remove('d-none');
        submitEl.disabled = false;
        submitEl.classList.remove('is-loading');
      }
    })
    .catch(() => {
      submitEl.disabled = false;
      submitEl.classList.remove('is-loading');
    });
}

/**
 * Back button handler. Go back one step!
 */
function handleBack(e) {
  if (!e.target.classList.contains('js-back')) {
    return;
  }

  e.preventDefault();

  const stepNo = stepFormEls.indexOf(this);
  const prevStepEl = stepFormEls[stepNo - 1];

  console.log(stepNo);

  this.classList.add('d-none');
  prevStepEl.classList.remove('d-none');
}

for (const el of stepFormEls) {
  el.addEventListener('submit', handleSubmit);
  el.addEventListener('click', handleBack);
}

// Update initial UI state (triggers handlers above)
updateStep1();
updateFee();
