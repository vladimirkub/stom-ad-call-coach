// Which start page this tab came from: the full workspace (/app) or the one-button page (/call).
// The call screen and the results page send the trainee back there. Kept per tab in sessionStorage.
const KEY = "coach:home";
export type Home = "/app" | "/call";

export function getHome(): Home {
  try {
    return sessionStorage.getItem(KEY) === "/call" ? "/call" : "/app";
  } catch {
    return "/app";
  }
}

export function setHome(home: Home) {
  try {
    sessionStorage.setItem(KEY, home);
  } catch {}
}
