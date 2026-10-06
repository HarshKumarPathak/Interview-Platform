import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.AUTH_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const email = `e2e-${Date.now()}@example.com`;
const password = "E2eTestPassword123!";
const displayName = "E2E Candidate";

function cookieFrom(response) {
  return (response.headers.getSetCookie?.() ?? [])
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

test("registration, login and logout work end to end", async () => {
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName, email, password }),
  });
  const registerBody = await register.json();
  assert.equal(register.status, 201, JSON.stringify(registerBody));
  assert.equal(registerBody.candidate.display_name, displayName);

  let cookie = cookieFrom(register);
  assert.match(cookie, /interview_session=/);

  const dashboardAfterRegister = await fetch(`${baseUrl}/dashboard`, { headers: { cookie } });
  assert.equal(dashboardAfterRegister.status, 200);
  assert.match(await dashboardAfterRegister.text(), /Good to see you/);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(logout.status, 200);
  cookie = cookieFrom(logout) || "interview_session=";

  const dashboardAfterLogout = await fetch(`${baseUrl}/dashboard`, { headers: { cookie } });
  assert.equal(dashboardAfterLogout.status, 200);
  assert.match(await dashboardAfterLogout.text(), /Sign in to see your interview progress/);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await login.json();
  assert.equal(login.status, 200, JSON.stringify(loginBody));
  cookie = cookieFrom(login);
  assert.match(cookie, /interview_session=/);

  const dashboardAfterLogin = await fetch(`${baseUrl}/dashboard`, { headers: { cookie } });
  assert.equal(dashboardAfterLogin.status, 200);
  assert.match(await dashboardAfterLogin.text(), /Good to see you/);
});
