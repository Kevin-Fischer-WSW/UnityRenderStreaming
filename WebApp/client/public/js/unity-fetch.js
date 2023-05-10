export function unityFetch (endpoint, init) {
  return fetch(`/uapp${endpoint}`, init)
}
