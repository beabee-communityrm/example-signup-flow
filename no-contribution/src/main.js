// URL to your beabee instance
const frontendUrl = 'https://your.beabee.instance.io';

const apiUrl = frontendUrl + '/api/1.0';

const formEl = document.querySelector('.js-form');
const errorEl = document.querySelector('.js-error');

/**
 * Start the signup. Without a contribution the API sends the confirmation
 * email straight away and responds with 204, so the only thing left to do is
 * send the user to the page that tells them to check their inbox.
 */
function startSignup(email) {
  const data = {
    email,
    loginUrl: `${frontendUrl}/auth/login`,
    setPasswordUrl: `${frontendUrl}/auth/set-password`,
    confirmUrl: `${frontendUrl}/join/confirm-email`,
  };

  return fetch(`${apiUrl}/signup`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(resp => {
    if (resp.status === 429) {
      throw new Error('Too many attempts, please try again in a minute');
    }
    if (!resp.ok) {
      throw new Error('Please check your email address and try again');
    }
    // A successful response has no body
    window.location.href = `${frontendUrl}/join/confirm-email`;
  });
}

formEl.addEventListener('submit', e => {
  e.preventDefault();

  const submitEl = e.submitter;
  submitEl.disabled = true;
  submitEl.classList.add('is-loading');
  errorEl.classList.add('d-none');

  startSignup(formEl.elements.email.value).catch(err => {
    errorEl.textContent = err.message;
    errorEl.classList.remove('d-none');
    submitEl.disabled = false;
    submitEl.classList.remove('is-loading');
  });
});
