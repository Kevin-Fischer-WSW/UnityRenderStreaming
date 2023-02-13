export function unityFetch (endpoint, init) {
  let host = window.location.hostname
  let url = `http://${host}:4444${endpoint}`
  return fetch(url, init)
}
