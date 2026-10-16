import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthFields } from '../src/components/auth-fields';

function inputs(mode: Parameters<typeof AuthFields>[0]['mode']) {
  return [
    ...renderToStaticMarkup(createElement(AuthFields, { mode })).matchAll(/<input\b[^>]*>/g),
  ].map(([tag]) =>
    Object.fromEntries(
      [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key.toLowerCase(), value]),
    ),
  );
}

test('Signup starts empty with two new-password inputs isolated from saved sign-in credentials', () => {
  const signup = inputs('signup'),
    signin = inputs('signin');
  assert.equal(signup.length, 3);
  assert.deepEqual(
    signup.map((input) => input.type),
    ['email', 'password', 'password'],
  );
  assert.equal(signup[0].autocomplete, 'off');
  for (const input of signup) {
    assert.equal(input.value, '');
    assert.ok(!signin.some((other) => other.id === input.id || other.name === input.name));
  }
  for (const input of signup.slice(1)) {
    assert.equal(input.autocomplete, 'new-password');
    assert.equal(input.minlength, '10');
    assert.equal(input.maxlength, '128');
  }
  assert.equal(signin[1].autocomplete, 'current-password');
});

test('Forgot-password and confirmation forms have their own blank email fields and no password', () => {
  const recovery = inputs('recovery'),
    confirmation = inputs('confirmation');
  for (const fields of [recovery, confirmation]) {
    assert.equal(fields.length, 1);
    assert.equal(fields[0].type, 'email');
    assert.equal(fields[0].value, '');
    assert.equal(fields[0].autocomplete, 'off');
  }
  assert.notEqual(recovery[0].name, confirmation[0].name);
});
